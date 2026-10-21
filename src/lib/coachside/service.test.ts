import { beforeEach, describe, expect, it } from "vitest";
import {
  addPlayer,
  addPlayersBulk,
  createScheduleEvent,
  createTeam,
  getRoster,
  listSchedule,
  listTeams,
  updatePlayer,
  updateScheduleEvent,
  CoachSideError,
  MAX_BULK_PLAYERS,
} from "./service";
import { fakeDb, uid, type FakeState } from "./fakeDb.test-helper";

const USER = uid();
const ORG = uid();
const ALISO = uid();
const OTHER = uid(); // another program's team
const PLAYER_TEAM = uid(); // team where the user is only a player

let state: FakeState;

function coachAccess() {
  return {
    user_id: USER,
    org_memberships: [{ org_id: ORG, role: "head_coach" }],
    team_memberships: [{ team_id: PLAYER_TEAM, role: "player", player_id: uid() }],
    coach_team_ids: [ALISO],
    player_team_ids: [PLAYER_TEAM],
  };
}

beforeEach(() => {
  state = {
    access: coachAccess(),
    rpcCalls: [],
    tables: {
      profiles: [{ id: USER, org_id: ORG }],
      teams: [
        { id: ALISO, name: "Aliso Sophomores", season: "2026-27", level: "Sophomore", org_id: ORG, timezone: "America/Los_Angeles", is_practice: false },
        // Null-org team that broad team RLS can expose; must never be listed.
        { id: OTHER, name: "Rival Varsity", season: "2026-27", level: null, org_id: null, timezone: "America/New_York", is_practice: false },
        { id: PLAYER_TEAM, name: "Club Team", season: "2026", level: null, org_id: null, timezone: "America/Los_Angeles", is_practice: false },
      ],
      players: ["1", "3", "5", "11", "20", "24", "32", "33"].map((j) => ({
        id: uid(),
        team_id: ALISO,
        jersey: j,
        name: `Player ${j}`,
        position: null,
        active: true,
      })),
      team_events: [],
    },
  };
});

const db = () => fakeDb(state);
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof CoachSideError ? e.code : "OTHER";
  }
  return "NO_ERROR";
};

describe("team authorization", () => {
  it("list_teams returns only teams the user coaches", async () => {
    const { teams } = await listTeams(db());
    expect(teams.map((t) => t.name)).toEqual(["Aliso Sophomores"]);
    expect(teams[0]).toMatchObject({ season: "2026-27", level: "Sophomore", role: "head_coach" });
  });
  it("rejects a team the user does not coach", async () => {
    expect(await code(getRoster(db(), OTHER))).toBe("NO_ACCESS");
    expect(await code(addPlayer(db(), OTHER, { jersey: "9", name: "Sneaky" }))).toBe("NO_ACCESS");
    expect(state.tables["players"]!.some((p) => p["team_id"] === OTHER)).toBe(false);
  });
  it("rejects unknown or malformed team ids", async () => {
    expect(await code(getRoster(db(), uid()))).toBe("TEAM_NOT_FOUND");
    expect(await code(getRoster(db(), "not-a-uuid"))).toBe("TEAM_NOT_FOUND");
  });
  it("denies player-only accounts every tool, even on their own team", async () => {
    state.access = { ...coachAccess(), org_memberships: [], coach_team_ids: [] };
    expect(await code(listTeams(db()))).toBe("COACH_ONLY");
    expect(await code(getRoster(db(), PLAYER_TEAM))).toBe("COACH_ONLY");
    expect(await code(addPlayer(db(), PLAYER_TEAM, { jersey: "7", name: "Me" }))).toBe("COACH_ONLY");
  });
});

describe("roster", () => {
  it("get_roster returns active players sorted by jersey", async () => {
    state.tables["players"]!.push({ id: uid(), team_id: ALISO, jersey: "40", name: "Gone", position: null, active: false });
    const { players } = await getRoster(db(), ALISO);
    expect(players.map((p) => p.jersey)).toEqual(["1", "3", "5", "11", "20", "24", "32", "33"]);
  });
  it("add_player writes to the requested team", async () => {
    const { player } = await addPlayer(db(), ALISO, { jersey: "#4", name: "  John   Smith ", position: "G" });
    expect(player).toMatchObject({ jersey: "4", name: "John Smith", position: "G", active: true });
    expect(state.tables["players"]!.find((p) => p["id"] === player.id)?.["team_id"]).toBe(ALISO);
  });
  it("add_player rejects a jersey already in use", async () => {
    expect(await code(addPlayer(db(), ALISO, { jersey: "24", name: "Dup" }))).toBe("DUPLICATE_JERSEY");
  });
  it("add_players_bulk creates valid rows and reports rejected ones", async () => {
    const r = await addPlayersBulk(db(), ALISO, [
      { jersey: "4", name: "John Smith" },
      { jersey: "12", name: "Marcus Lee" },
      { jersey: "23", name: "Devon Hall" },
      { jersey: "12", name: "Twice" },
      { jersey: "24", name: "Taken" },
      { jersey: "abc", name: "Bad" },
    ]);
    expect(r.created.map((p) => p.jersey)).toEqual(["4", "12", "23"]);
    expect(r.rejected.map((x) => [x.index, x.code])).toEqual([
      [3, "DUPLICATE_JERSEY"],
      [4, "DUPLICATE_JERSEY"],
      [5, "INVALID_INPUT"],
    ]);
  });
  it(`add_players_bulk caps a batch at ${MAX_BULK_PLAYERS}`, async () => {
    const rows = Array.from({ length: MAX_BULK_PLAYERS + 1 }, (_, i) => ({ jersey: String(i), name: `P${i}` }));
    expect(await code(addPlayersBulk(db(), ALISO, rows))).toBe("INVALID_INPUT");
  });
  it("update_player edits only a player on that team", async () => {
    const target = state.tables["players"]![0]!;
    const r = await updatePlayer(db(), ALISO, String(target["id"]), { name: "New Name", position: "F" });
    expect(r.changed.sort()).toEqual(["name", "position"]);
    expect(await code(updatePlayer(db(), ALISO, String(target["id"]), { jersey: "24" }))).toBe("DUPLICATE_JERSEY");
    expect(await code(updatePlayer(db(), ALISO, uid(), { name: "X" }))).toBe("PLAYER_NOT_FOUND");
  });
});

describe("teams", () => {
  it("create_team creates in the coach's program and blocks duplicates", async () => {
    const { team } = await createTeam(db(), USER, { name: "East High JV", season: "2026-27", level: "JV" });
    expect(team).toMatchObject({ name: "East High JV", season: "2026-27", level: "JV" });
    expect(state.tables["teams"]!.find((t) => t["id"] === team.id)?.["org_id"]).toBe(ORG);
    state.access = { ...coachAccess(), coach_team_ids: [ALISO, team.id] };
    expect(await code(createTeam(db(), USER, { name: "east high jv", season: "2026-27" }))).toBe("DUPLICATE_TEAM");
  });
});

describe("schedule", () => {
  it("create_schedule_event stores local wall time in the team's timezone", async () => {
    const { event } = await createScheduleEvent(db(), USER, {
      team_id: ALISO,
      event_type: "practice",
      title: "Practice",
      starts_at: "2026-10-22T16:30",
      ends_at: "2026-10-22T18:00",
      arrival_minutes_before: 15,
    });
    expect(event.starts_at).toBe("2026-10-22T23:30:00.000Z"); // PDT = UTC-7
    expect(event.starts_local).toBe("2026-10-22T16:30");
    expect(event.arrival_local).toBe("2026-10-22T16:15");
    const stored = state.tables["team_events"]![0]!;
    expect(stored).toMatchObject({ team_id: ALISO, kind: "practice", visibility: "team", created_by: USER });
  });
  it("create_schedule_event rejects bad dates and duplicates", async () => {
    const base = { team_id: ALISO, event_type: "game" as const, title: "vs Mission Viejo", starts_at: "2026-10-24T19:00" };
    expect(await code(createScheduleEvent(db(), USER, { ...base, starts_at: "next friday" }))).toBe("INVALID_DATE");
    expect(await code(createScheduleEvent(db(), USER, { ...base, starts_at: "2026-02-30T10:00" }))).toBe("INVALID_DATE");
    expect(await code(createScheduleEvent(db(), USER, { ...base, ends_at: "2026-10-24T18:00" }))).toBe("INVALID_DATE");
    await createScheduleEvent(db(), USER, base);
    expect(await code(createScheduleEvent(db(), USER, base))).toBe("DUPLICATE_EVENT");
  });
  it("list_schedule returns events in the requested local date range", async () => {
    for (const [day, title] of [["2026-10-26", "Mon practice"], ["2026-10-30", "Fri game"], ["2026-11-05", "Later"]] as const) {
      await createScheduleEvent(db(), USER, { team_id: ALISO, event_type: "game", title, starts_at: `${day}T19:00` });
    }
    const r = await listSchedule(db(), { team_id: ALISO, start_date: "2026-10-26", end_date: "2026-11-01" });
    expect(r.events.map((e) => e.title)).toEqual(["Mon practice", "Fri game"]);
    expect(await code(listSchedule(db(), { team_id: ALISO, start_date: "2026-13-01" }))).toBe("INVALID_DATE");
    expect(await code(listSchedule(db(), { team_id: OTHER }))).toBe("NO_ACCESS");
  });
  it("update_schedule_event moves the start and keeps the length", async () => {
    const { event } = await createScheduleEvent(db(), USER, {
      team_id: ALISO, event_type: "practice", title: "Practice", starts_at: "2026-10-30T16:00", ends_at: "2026-10-30T18:00",
    });
    const r = await updateScheduleEvent(db(), { team_id: ALISO, event_id: event.id, patch: { starts_at: "2026-10-30T17:00" } });
    expect(r.event.starts_local).toBe("2026-10-30T17:00");
    expect(r.event.ends_local).toBe("2026-10-30T19:00");
    expect(r.changed.sort()).toEqual(["ends_at", "starts_at"]);
  });
  it("update_schedule_event refuses imported calendar events and other teams", async () => {
    const id = uid();
    state.tables["team_events"]!.push({
      id, team_id: ALISO, event_type: "practice", title: "Synced", starts_at: "2026-10-30T23:00:00Z", ends_at: null,
      arrival_at: null, location: null, notes: null, opponent: null, home_away: null, status: "scheduled", source: "google",
    });
    expect(await code(updateScheduleEvent(db(), { team_id: ALISO, event_id: id, patch: { title: "X" } }))).toBe("READ_ONLY_EVENT");
    expect(await code(updateScheduleEvent(db(), { team_id: OTHER, event_id: id, patch: { title: "X" } }))).toBe("NO_ACCESS");
  });
});
