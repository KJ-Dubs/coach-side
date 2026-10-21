/**
 * CoachSide connector actions. Every function runs with a database client
 * scoped to the connected coach's OAuth token, so existing RLS still applies;
 * on top of that each team-scoped action re-checks coach membership from
 * `my_access` and never trusts a team id supplied by the caller alone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachSidePermission } from "./permissions";
import {
  currentSeasonLabel,
  parseDayStart,
  parseEventDateTime,
  safeTimeZone,
  todayIn,
  toLocalLabel,
  toLocalWallTime,
} from "./time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export type CoachSideErrorCode =
  | "NOT_CONNECTED"
  | "CONNECTION_REVOKED"
  | "PERMISSION_NOT_GRANTED"
  | "RATE_LIMITED"
  | "COACH_ONLY"
  | "NO_ACCESS"
  | "TEAM_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "DUPLICATE_JERSEY"
  | "DUPLICATE_TEAM"
  | "DUPLICATE_EVENT"
  | "INVALID_DATE"
  | "INVALID_INPUT"
  | "READ_ONLY_EVENT"
  | "SERVER_ERROR";

export class CoachSideError extends Error {
  constructor(
    readonly code: CoachSideErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CoachSideError";
  }
}

const CONNECTION_MESSAGES: Partial<Record<CoachSideErrorCode, string>> = {
  NOT_CONNECTED: "This app is not connected to a CoachSide account. Reconnect from ChatGPT.",
  CONNECTION_REVOKED: "The coach revoked this connection in CoachSide Settings. Reconnect to continue.",
  PERMISSION_NOT_GRANTED:
    "The coach did not grant this permission. Reconnect and allow it on the CoachSide consent screen.",
  RATE_LIMITED: "Too many CoachSide requests in the last minute. Wait a moment and try again.",
};

/** Connection, permission and rate-limit gate for every tool call. */
export async function beginCall(db: Db, permission: CoachSidePermission): Promise<void> {
  const { data, error } = await db.rpc("mcp_begin_call", { p_permission: permission });
  if (error) throw new CoachSideError("SERVER_ERROR", "Could not verify this CoachSide connection.");
  const result = (data ?? {}) as { ok?: boolean; code?: string };
  if (result.ok) return;
  const code = (result.code ?? "NOT_CONNECTED") as CoachSideErrorCode;
  throw new CoachSideError(code, CONNECTION_MESSAGES[code] ?? "This CoachSide connection is not active.");
}

/** Lightweight audit entry for a write. Never blocks the action itself. */
export async function logAction(
  db: Db,
  tool: string,
  teamId: string | null,
  targetId: string | null,
  summary: string,
) {
  try {
    await db.rpc("mcp_log_action", {
      p_tool: tool,
      p_team: teamId,
      p_target: targetId,
      p_summary: summary.slice(0, 500),
    });
  } catch {
    /* audit is best effort */
  }
}

/* ---------------- access ---------------- */

type CoachRole = "head_coach" | "assistant_coach";
export type CoachAccess = {
  isCoach: boolean;
  coachTeamIds: Set<string>;
  teamRoles: Map<string, CoachRole>;
  orgRoles: Map<string, CoachRole>;
};

export async function loadAccess(db: Db): Promise<CoachAccess> {
  const { data, error } = await db.rpc("my_access");
  if (error) throw new CoachSideError("SERVER_ERROR", "Could not load your CoachSide access.");
  const raw = (data ?? {}) as Record<string, unknown>;
  const teamRows = (raw["team_memberships"] ?? []) as { team_id: string; role: string }[];
  const orgRows = (raw["org_memberships"] ?? []) as { org_id: string; role: string }[];
  const teamRoles = new Map<string, CoachRole>();
  for (const m of teamRows) {
    if (m?.team_id && (m.role === "head_coach" || m.role === "assistant_coach")) {
      if (teamRoles.get(m.team_id) !== "head_coach") teamRoles.set(m.team_id, m.role);
    }
  }
  const orgRoles = new Map<string, CoachRole>();
  for (const o of orgRows) {
    if (o?.org_id && (o.role === "head_coach" || o.role === "assistant_coach")) orgRoles.set(o.org_id, o.role);
  }
  const coachTeamIds = new Set<string>([
    ...((raw["coach_team_ids"] ?? []) as string[]).filter(Boolean),
    ...teamRoles.keys(),
  ]);
  return { isCoach: coachTeamIds.size > 0 || orgRoles.size > 0, coachTeamIds, teamRoles, orgRoles };
}

export async function requireCoach(db: Db): Promise<CoachAccess> {
  const access = await loadAccess(db);
  if (!access.isCoach) {
    throw new CoachSideError(
      "COACH_ONLY",
      "CoachSide connectors are for coach accounts. Player and parent accounts cannot use these tools.",
    );
  }
  return access;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TeamRow = {
  id: string;
  name: string;
  season: string;
  level: string | null;
  org_id: string | null;
  timezone: string | null;
  is_practice: boolean | null;
};
const TEAM_COLUMNS = "id,name,season,level,org_id,timezone,is_practice";

function roleFor(access: CoachAccess, team: TeamRow): CoachRole {
  return access.teamRoles.get(team.id) ?? (team.org_id ? access.orgRoles.get(team.org_id) : undefined) ?? "assistant_coach";
}

/** Verifies the caller coaches this team before any team-scoped read/write. */
export async function requireCoachTeam(db: Db, teamId: string): Promise<{ access: CoachAccess; team: TeamRow }> {
  if (!UUID.test(teamId)) throw new CoachSideError("TEAM_NOT_FOUND", "That team id is not valid. Call list_teams first.");
  const access = await requireCoach(db);
  const { data, error } = await db.from("teams").select(TEAM_COLUMNS).eq("id", teamId).maybeSingle();
  if (error) throw new CoachSideError("SERVER_ERROR", "Could not load that team.");
  if (!data) throw new CoachSideError("TEAM_NOT_FOUND", "No CoachSide team with that id. Call list_teams first.");
  if (!access.coachTeamIds.has(teamId)) {
    throw new CoachSideError("NO_ACCESS", "You are not a coach on that team.");
  }
  return { access, team: data as TeamRow };
}

/* ---------------- validation ---------------- */

export function cleanJersey(value: string): string {
  const v = String(value ?? "").trim().replace(/^#/, "");
  if (!/^\d{1,3}$/.test(v)) throw new CoachSideError("INVALID_INPUT", `Jersey "${value}" must be 1–3 digits.`);
  return v;
}

function cleanName(value: string, label = "Name", max = 80): string {
  const v = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!v) throw new CoachSideError("INVALID_INPUT", `${label} is required.`);
  if (v.length > max) throw new CoachSideError("INVALID_INPUT", `${label} must be ${max} characters or fewer.`);
  return v;
}

function cleanOptional(value: string | null | undefined, label: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (v.length > max) throw new CoachSideError("INVALID_INPUT", `${label} must be ${max} characters or fewer.`);
  return v;
}

const jerseySort = (a: { jersey: string }, b: { jersey: string }) =>
  Number(a.jersey) - Number(b.jersey) || a.jersey.localeCompare(b.jersey);

/* ---------------- teams ---------------- */

export type TeamSummary = {
  id: string;
  name: string;
  season: string;
  level: string | null;
  role: CoachRole;
  timezone: string;
  is_practice_team: boolean;
};

const teamSummary = (access: CoachAccess, t: TeamRow): TeamSummary => ({
  id: t.id,
  name: t.name,
  season: t.season,
  level: t.level ?? null,
  role: roleFor(access, t),
  timezone: safeTimeZone(t.timezone),
  is_practice_team: !!t.is_practice,
});

export async function listTeams(db: Db): Promise<{ teams: TeamSummary[] }> {
  const access = await requireCoach(db);
  const ids = [...access.coachTeamIds];
  if (ids.length === 0) return { teams: [] };
  const { data, error } = await db.from("teams").select(TEAM_COLUMNS).in("id", ids).order("name");
  if (error) throw new CoachSideError("SERVER_ERROR", "Could not load your teams.");
  // Only teams this coach is staff on, whatever else RLS happens to expose.
  const rows = ((data ?? []) as TeamRow[]).filter((t) => access.coachTeamIds.has(t.id));
  return { teams: rows.map((t) => teamSummary(access, t)) };
}

export async function createTeam(
  db: Db,
  userId: string,
  input: { name: string; season?: string | null; level?: string | null },
): Promise<{ team: TeamSummary }> {
  const access = await requireCoach(db);
  const name = cleanName(input.name, "Team name", 80);
  const season = cleanOptional(input.season, "Season", 20) ?? currentSeasonLabel();
  const level = cleanOptional(input.level, "Level", 40);

  const { data: profile } = await db.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  const orgId = (profile as { org_id: string | null } | null)?.org_id ?? null;
  if (!orgId || !access.orgRoles.has(orgId)) {
    throw new CoachSideError("NO_ACCESS", "Only program coaches can create teams. Create the team in CoachSide first.");
  }
  const existing = await listTeams(db);
  const dup = existing.teams.find(
    (t) => t.name.toLowerCase() === name.toLowerCase() && t.season.toLowerCase() === season.toLowerCase(),
  );
  if (dup) throw new CoachSideError("DUPLICATE_TEAM", `You already have ${dup.name} for ${dup.season} (id ${dup.id}).`);

  const { data, error } = await db
    .from("teams")
    .insert({ name, season, level, org_id: orgId })
    .select(TEAM_COLUMNS)
    .single();
  if (error || !data) throw new CoachSideError("SERVER_ERROR", "Could not create the team.");
  const team = data as TeamRow;
  access.coachTeamIds.add(team.id);
  access.orgRoles.set(orgId, access.orgRoles.get(orgId)!);
  await logAction(db, "create_team", team.id, team.id, `Created team ${name} (${season})`);
  return { team: teamSummary(access, team) };
}

/* ---------------- roster ---------------- */

export type PlayerSummary = { id: string; jersey: string; name: string; position: string | null; active: boolean };
const PLAYER_COLUMNS = "id,team_id,jersey,name,position,active";
const playerSummary = (p: PlayerSummary): PlayerSummary => ({
  id: p.id,
  jersey: p.jersey,
  name: p.name,
  position: p.position ?? null,
  active: !!p.active,
});

async function activePlayers(db: Db, teamId: string): Promise<PlayerSummary[]> {
  const { data, error } = await db.from("players").select(PLAYER_COLUMNS).eq("team_id", teamId).eq("active", true);
  if (error) throw new CoachSideError("SERVER_ERROR", "Could not load the roster.");
  return (data ?? []) as PlayerSummary[];
}

export async function getRoster(
  db: Db,
  teamId: string,
  includeInactive = false,
): Promise<{ team: { id: string; name: string }; players: PlayerSummary[] }> {
  const { team } = await requireCoachTeam(db, teamId);
  let rows: PlayerSummary[];
  if (includeInactive) {
    const { data, error } = await db.from("players").select(PLAYER_COLUMNS).eq("team_id", teamId);
    if (error) throw new CoachSideError("SERVER_ERROR", "Could not load the roster.");
    rows = (data ?? []) as PlayerSummary[];
  } else rows = await activePlayers(db, teamId);
  return { team: { id: team.id, name: team.name }, players: rows.sort(jerseySort).map(playerSummary) };
}

export type PlayerInput = { jersey: string; name: string; position?: string | null };

export async function addPlayer(db: Db, teamId: string, input: PlayerInput): Promise<{ player: PlayerSummary }> {
  const { team } = await requireCoachTeam(db, teamId);
  const jersey = cleanJersey(input.jersey);
  const name = cleanName(input.name);
  const position = cleanOptional(input.position, "Position", 20);
  const taken = (await activePlayers(db, teamId)).find((p) => p.jersey === jersey);
  if (taken) throw new CoachSideError("DUPLICATE_JERSEY", `#${jersey} is already ${taken.name} on ${team.name}.`);
  const { data, error } = await db
    .from("players")
    .insert({ team_id: teamId, jersey, name, position })
    .select(PLAYER_COLUMNS)
    .single();
  if (error || !data) throw new CoachSideError("SERVER_ERROR", "Could not add the player.");
  const player = playerSummary(data as PlayerSummary);
  await logAction(db, "add_player", teamId, player.id, `Added #${jersey} ${name} to ${team.name}`);
  return { player };
}

export const MAX_BULK_PLAYERS = 50;

export type RejectedRow = { index: number; jersey: string; name: string; code: CoachSideErrorCode; message: string };

export async function addPlayersBulk(
  db: Db,
  teamId: string,
  rows: PlayerInput[],
): Promise<{ team: { id: string; name: string }; created: PlayerSummary[]; rejected: RejectedRow[] }> {
  if (!Array.isArray(rows) || rows.length === 0) throw new CoachSideError("INVALID_INPUT", "Provide at least one player.");
  if (rows.length > MAX_BULK_PLAYERS) {
    throw new CoachSideError("INVALID_INPUT", `Add at most ${MAX_BULK_PLAYERS} players at a time.`);
  }
  const { team } = await requireCoachTeam(db, teamId);
  const existing = new Map((await activePlayers(db, teamId)).map((p) => [p.jersey, p.name]));
  const seen = new Map<string, number>();
  const valid: { team_id: string; jersey: string; name: string; position: string | null }[] = [];
  const rejected: RejectedRow[] = [];

  rows.forEach((row, index) => {
    const raw = { jersey: String(row?.jersey ?? ""), name: String(row?.name ?? "") };
    try {
      const jersey = cleanJersey(raw.jersey);
      const name = cleanName(raw.name);
      const position = cleanOptional(row.position, "Position", 20);
      if (existing.has(jersey)) {
        throw new CoachSideError("DUPLICATE_JERSEY", `#${jersey} is already ${existing.get(jersey)} on ${team.name}.`);
      }
      if (seen.has(jersey)) {
        throw new CoachSideError("DUPLICATE_JERSEY", `#${jersey} appears more than once in this list (row ${seen.get(jersey)! + 1}).`);
      }
      seen.set(jersey, index);
      valid.push({ team_id: teamId, jersey, name, position });
    } catch (e) {
      const err = e instanceof CoachSideError ? e : new CoachSideError("INVALID_INPUT", "Invalid row.");
      rejected.push({ index, ...raw, code: err.code, message: err.message });
    }
  });

  let created: PlayerSummary[] = [];
  if (valid.length > 0) {
    const { data, error } = await db.from("players").insert(valid).select(PLAYER_COLUMNS);
    if (error) throw new CoachSideError("SERVER_ERROR", "Could not add these players. Nothing was saved.");
    created = ((data ?? []) as PlayerSummary[]).sort(jerseySort).map(playerSummary);
    await logAction(
      db,
      "add_players_bulk",
      teamId,
      null,
      `Added ${created.length} players to ${team.name}: ${created.map((p) => `#${p.jersey}`).join(", ")}`,
    );
  }
  return { team: { id: team.id, name: team.name }, created, rejected };
}

export type PlayerPatch = { jersey?: string; name?: string; position?: string | null; active?: boolean };

export async function updatePlayer(
  db: Db,
  teamId: string,
  playerId: string,
  patch: PlayerPatch,
): Promise<{ player: PlayerSummary; changed: string[] }> {
  const { team } = await requireCoachTeam(db, teamId);
  if (!UUID.test(playerId)) throw new CoachSideError("PLAYER_NOT_FOUND", "That player id is not valid. Call get_roster first.");
  const { data: current } = await db
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("id", playerId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!current) throw new CoachSideError("PLAYER_NOT_FOUND", `No player with that id on ${team.name}.`);
  const before = current as PlayerSummary;

  const next: Record<string, string | boolean | null> = {};
  if (patch.jersey !== undefined) next["jersey"] = cleanJersey(patch.jersey);
  if (patch.name !== undefined) next["name"] = cleanName(patch.name);
  if (patch.position !== undefined) next["position"] = cleanOptional(patch.position, "Position", 20);
  if (patch.active !== undefined) next["active"] = !!patch.active;
  const changed = Object.keys(next).filter((k) => next[k] !== (before as unknown as Record<string, unknown>)[k]);
  if (changed.length === 0) throw new CoachSideError("INVALID_INPUT", "Nothing to change for this player.");

  const jersey = (next["jersey"] as string | undefined) ?? before.jersey;
  const active = (next["active"] as boolean | undefined) ?? before.active;
  if (active && (changed.includes("jersey") || changed.includes("active"))) {
    const taken = (await activePlayers(db, teamId)).find((p) => p.jersey === jersey && p.id !== playerId);
    if (taken) throw new CoachSideError("DUPLICATE_JERSEY", `#${jersey} is already ${taken.name} on ${team.name}.`);
  }

  const { data, error } = await db
    .from("players")
    .update(next)
    .eq("id", playerId)
    .eq("team_id", teamId)
    .select(PLAYER_COLUMNS)
    .single();
  if (error || !data) throw new CoachSideError("SERVER_ERROR", "Could not update the player.");
  const player = playerSummary(data as PlayerSummary);
  await logAction(db, "update_player", teamId, playerId, `Updated #${player.jersey} ${player.name} (${changed.join(", ")})`);
  return { player, changed };
}

/* ---------------- schedule ---------------- */

export const EVENT_TYPES = ["game", "practice", "event"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const HOME_AWAY = ["home", "away", "neutral"] as const;

type EventRow = {
  id: string;
  team_id: string;
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  arrival_at: string | null;
  location: string | null;
  notes: string | null;
  opponent: string | null;
  home_away: string | null;
  status: string;
  source: string;
};
const EVENT_COLUMNS =
  "id,team_id,event_type,title,starts_at,ends_at,arrival_at,location,notes,opponent,home_away,status,source";

export type EventSummary = {
  id: string;
  event_type: string;
  title: string;
  starts_at: string;
  starts_local: string;
  starts_label: string;
  ends_at: string | null;
  ends_local: string | null;
  arrival_local: string | null;
  location: string | null;
  opponent: string | null;
  home_away: string | null;
  notes: string | null;
  status: string;
  read_only: boolean;
};

export function eventSummary(e: EventRow, tz: string): EventSummary {
  return {
    id: e.id,
    event_type: e.event_type,
    title: e.title,
    starts_at: new Date(e.starts_at).toISOString(),
    starts_local: toLocalWallTime(e.starts_at, tz),
    starts_label: toLocalLabel(e.starts_at, tz),
    ends_at: e.ends_at ? new Date(e.ends_at).toISOString() : null,
    ends_local: e.ends_at ? toLocalWallTime(e.ends_at, tz) : null,
    arrival_local: e.arrival_at ? toLocalWallTime(e.arrival_at, tz) : null,
    location: e.location ?? null,
    opponent: e.opponent ?? null,
    home_away: e.home_away ?? null,
    notes: e.notes ?? null,
    status: e.status,
    read_only: e.source !== "coachside",
  };
}

function eventTime(value: string, tz: string, label: string): string {
  const iso = parseEventDateTime(value, tz);
  if (!iso) {
    throw new CoachSideError(
      "INVALID_DATE",
      `${label} "${value}" is not a valid date-time. Use "YYYY-MM-DDTHH:mm" in the team's timezone (${tz}) or ISO 8601 with an offset.`,
    );
  }
  return iso;
}

function arrivalFrom(startsIso: string, minutes: number | null | undefined): string | null | undefined {
  if (minutes === undefined) return undefined;
  if (minutes === null) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
    throw new CoachSideError("INVALID_INPUT", "Arrival must be 0–240 minutes before the start.");
  }
  return new Date(Date.parse(startsIso) - minutes * 60_000).toISOString();
}

const MAX_RANGE_DAYS = 400;

export async function listSchedule(
  db: Db,
  input: { team_id: string; start_date?: string | null; end_date?: string | null; event_type?: EventType | null; now?: number },
): Promise<{ team: { id: string; name: string; timezone: string }; range: { start: string; end: string }; events: EventSummary[] }> {
  const { team } = await requireCoachTeam(db, input.team_id);
  const tz = safeTimeZone(team.timezone);
  const startDay = input.start_date?.trim() || todayIn(tz, input.now);
  const start = parseDayStart(startDay, tz);
  if (!start) throw new CoachSideError("INVALID_DATE", `start_date "${startDay}" is not a valid date (YYYY-MM-DD).`);
  let end: string | null;
  if (input.end_date?.trim()) {
    end = parseDayStart(input.end_date.trim(), tz, 1);
    if (!end) throw new CoachSideError("INVALID_DATE", `end_date "${input.end_date}" is not a valid date (YYYY-MM-DD).`);
  } else {
    end = new Date(Date.parse(start) + 60 * 86_400_000).toISOString();
  }
  if (Date.parse(end) <= Date.parse(start)) throw new CoachSideError("INVALID_DATE", "end_date must be on or after start_date.");
  if (Date.parse(end) - Date.parse(start) > MAX_RANGE_DAYS * 86_400_000) {
    throw new CoachSideError("INVALID_DATE", `Ask for at most ${MAX_RANGE_DAYS} days at a time.`);
  }

  let q = db
    .from("team_events")
    .select(EVENT_COLUMNS)
    .eq("team_id", team.id)
    .gte("starts_at", start)
    .lt("starts_at", end);
  if (input.event_type) q = q.eq("event_type", input.event_type);
  const { data, error } = await q.order("starts_at").limit(200);
  if (error) throw new CoachSideError("SERVER_ERROR", "Could not load the schedule.");
  return {
    team: { id: team.id, name: team.name, timezone: tz },
    range: { start, end },
    events: ((data ?? []) as EventRow[]).map((e) => eventSummary(e, tz)),
  };
}

export type NewEventInput = {
  team_id: string;
  event_type: EventType;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  opponent?: string | null;
  home_away?: (typeof HOME_AWAY)[number] | null;
  location?: string | null;
  notes?: string | null;
  arrival_minutes_before?: number | null;
};

export async function createScheduleEvent(db: Db, userId: string, input: NewEventInput): Promise<{ event: EventSummary }> {
  const { team } = await requireCoachTeam(db, input.team_id);
  const tz = safeTimeZone(team.timezone);
  if (!EVENT_TYPES.includes(input.event_type)) throw new CoachSideError("INVALID_INPUT", "event_type must be game, practice or event.");
  const title = cleanName(input.title, "Title", 120);
  const starts = eventTime(input.starts_at, tz, "starts_at");
  const ends = input.ends_at ? eventTime(input.ends_at, tz, "ends_at") : null;
  if (ends && Date.parse(ends) <= Date.parse(starts)) throw new CoachSideError("INVALID_DATE", "ends_at must be after starts_at.");
  if (input.home_away && !HOME_AWAY.includes(input.home_away)) throw new CoachSideError("INVALID_INPUT", "home_away must be home, away or neutral.");

  const { data: clash } = await db
    .from("team_events")
    .select("id,title")
    .eq("team_id", team.id)
    .eq("starts_at", starts)
    .eq("event_type", input.event_type)
    .eq("status", "scheduled");
  const same = ((clash ?? []) as { id: string; title: string }[]).find((e) => e.title.toLowerCase() === title.toLowerCase());
  if (same) {
    throw new CoachSideError("DUPLICATE_EVENT", `"${title}" already exists at ${toLocalLabel(starts, tz)} (id ${same.id}).`);
  }

  const row = {
    team_id: team.id,
    event_type: input.event_type,
    kind: input.event_type,
    title,
    starts_at: starts,
    ends_at: ends,
    arrival_at: arrivalFrom(starts, input.arrival_minutes_before) ?? null,
    opponent: cleanOptional(input.opponent, "Opponent", 80),
    home_away: input.home_away ?? null,
    location: cleanOptional(input.location, "Location", 160),
    notes: cleanOptional(input.notes, "Notes", 2000),
    timezone: tz,
    visibility: "team",
    status: "scheduled",
    created_by: userId,
    last_modified_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("team_events").insert(row).select(EVENT_COLUMNS).single();
  if (error || !data) throw new CoachSideError("SERVER_ERROR", "Could not create the event.");
  const event = eventSummary(data as EventRow, tz);
  await logAction(db, "create_schedule_event", team.id, event.id, `Added ${event.event_type} "${title}" on ${event.starts_label}`);
  return { event };
}

export type EventPatch = {
  title?: string;
  event_type?: EventType;
  starts_at?: string;
  ends_at?: string | null;
  opponent?: string | null;
  home_away?: (typeof HOME_AWAY)[number] | null;
  location?: string | null;
  notes?: string | null;
  arrival_minutes_before?: number | null;
  status?: "scheduled" | "cancelled";
};

export async function updateScheduleEvent(
  db: Db,
  input: { team_id: string; event_id: string; patch: EventPatch },
): Promise<{ event: EventSummary; changed: string[] }> {
  const { team } = await requireCoachTeam(db, input.team_id);
  const tz = safeTimeZone(team.timezone);
  if (!UUID.test(input.event_id)) throw new CoachSideError("EVENT_NOT_FOUND", "That event id is not valid. Call list_schedule first.");
  const { data: current } = await db
    .from("team_events")
    .select(EVENT_COLUMNS)
    .eq("id", input.event_id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!current) throw new CoachSideError("EVENT_NOT_FOUND", `No event with that id on ${team.name}'s schedule.`);
  const before = current as EventRow;
  if (before.source !== "coachside") {
    throw new CoachSideError("READ_ONLY_EVENT", "This event is imported from a synced calendar and can only be changed there.");
  }

  const p = input.patch ?? {};
  const next: Record<string, string | null> = {};
  if (p.title !== undefined) next["title"] = cleanName(p.title, "Title", 120);
  if (p.event_type !== undefined) {
    if (!EVENT_TYPES.includes(p.event_type)) throw new CoachSideError("INVALID_INPUT", "event_type must be game, practice or event.");
    next["event_type"] = p.event_type;
    next["kind"] = p.event_type;
  }
  if (p.opponent !== undefined) next["opponent"] = cleanOptional(p.opponent, "Opponent", 80);
  if (p.home_away !== undefined) {
    if (p.home_away && !HOME_AWAY.includes(p.home_away)) throw new CoachSideError("INVALID_INPUT", "home_away must be home, away or neutral.");
    next["home_away"] = p.home_away ?? null;
  }
  if (p.location !== undefined) next["location"] = cleanOptional(p.location, "Location", 160);
  if (p.notes !== undefined) next["notes"] = cleanOptional(p.notes, "Notes", 2000);
  if (p.status !== undefined) {
    if (p.status !== "scheduled" && p.status !== "cancelled") throw new CoachSideError("INVALID_INPUT", "status must be scheduled or cancelled.");
    next["status"] = p.status;
  }

  const oldStart = Date.parse(before.starts_at);
  const starts = p.starts_at !== undefined ? eventTime(p.starts_at, tz, "starts_at") : new Date(oldStart).toISOString();
  const delta = Date.parse(starts) - oldStart;
  if (p.starts_at !== undefined) next["starts_at"] = starts;
  // Moving an event keeps its length and arrival lead unless told otherwise.
  if (p.ends_at !== undefined) next["ends_at"] = p.ends_at ? eventTime(p.ends_at, tz, "ends_at") : null;
  else if (delta !== 0 && before.ends_at) next["ends_at"] = new Date(Date.parse(before.ends_at) + delta).toISOString();
  const arrival = arrivalFrom(starts, p.arrival_minutes_before);
  if (arrival !== undefined) next["arrival_at"] = arrival;
  else if (delta !== 0 && before.arrival_at) next["arrival_at"] = new Date(Date.parse(before.arrival_at) + delta).toISOString();

  const endIso = next["ends_at"] !== undefined ? next["ends_at"] : before.ends_at;
  if (endIso && Date.parse(endIso) <= Date.parse(starts)) throw new CoachSideError("INVALID_DATE", "ends_at must be after starts_at.");

  const norm = (k: string, v: string | null) => (v && /_at$/.test(k) ? new Date(v).toISOString() : v);
  const changed = Object.keys(next).filter(
    (k) => k !== "kind" && norm(k, next[k] ?? null) !== norm(k, ((before as unknown as Record<string, string | null>)[k] ?? null)),
  );
  if (changed.length === 0) throw new CoachSideError("INVALID_INPUT", "Nothing to change for this event.");

  const { data, error } = await db
    .from("team_events")
    .update({ ...next, last_modified_at: new Date().toISOString() })
    .eq("id", before.id)
    .eq("team_id", team.id)
    .select(EVENT_COLUMNS)
    .single();
  if (error || !data) throw new CoachSideError("SERVER_ERROR", "Could not update the event.");
  const event = eventSummary(data as EventRow, tz);
  await logAction(db, "update_schedule_event", team.id, event.id, `Updated "${event.title}" (${changed.join(", ")})`);
  return { event, changed };
}
