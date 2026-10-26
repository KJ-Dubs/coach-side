import { describe, expect, it } from "vitest";
import {
  attendanceDueAt,
  attendanceState,
  buildAttendanceQueue,
  defaultEntries,
  entryProblem,
  isSnoozed,
  localDayKey,
  summarizePlayer,
  toSaveRows,
  withReason,
  withStatus,
} from "./attendanceRules";

const NOW = new Date("2026-10-26T23:00:00Z").getTime();
const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function ev(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    team_id: "t1",
    title: "Practice",
    event_type: "practice",
    status: "scheduled",
    starts_at: iso(NOW - 5 * H),
    ends_at: iso(NOW - 3 * H),
    game_id: null,
    ...over,
  };
}

const none = { sessions: new Map(), recorded: new Set<string>() };

describe("when attendance is due", () => {
  it("uses the end time", () => {
    expect(attendanceDueAt({ starts_at: iso(NOW - 5 * H), ends_at: iso(NOW - 3 * H) })).toBe(NOW - 3 * H);
  });
  it("falls back to start + 2 hours without an end time", () => {
    expect(attendanceDueAt({ starts_at: iso(NOW - 5 * H), ends_at: null })).toBe(NOW - 3 * H);
  });
  it("a final linked game makes it due at the final whistle", () => {
    const due = attendanceDueAt(
      { starts_at: iso(NOW - H), ends_at: iso(NOW + 2 * H) },
      { status: "final", ended_at: iso(NOW - 10 * 60_000) },
    );
    expect(due).toBe(NOW - 10 * 60_000);
  });
});

describe("attendance queue", () => {
  it("a past practice with no attendance is queued", () => {
    const q = buildAttendanceQueue({ events: [ev("a")], games: [], ...none, now: NOW });
    expect(q.map((i) => i.eventId)).toEqual(["a"]);
    expect(q[0]!.state).toBe("not_started");
  });

  it("future, cancelled and non-practice/game events are not queued", () => {
    const q = buildAttendanceQueue({
      events: [
        ev("future", { starts_at: iso(NOW + H), ends_at: iso(NOW + 3 * H) }),
        ev("cancel", { status: "cancelled" }),
        ev("meeting", { event_type: "meeting" }),
      ],
      games: [],
      ...none,
      now: NOW,
    });
    expect(q).toEqual([]);
  });

  it("completed and skipped events drop out; partial ones stay", () => {
    const sessions = new Map<string, "completed" | "skipped">([["done", "completed"], ["skip", "skipped"]]);
    const q = buildAttendanceQueue({
      events: [ev("done"), ev("skip"), ev("half")],
      games: [],
      sessions,
      recorded: new Set(["half", "done"]),
      now: NOW,
    });
    expect(q.map((i) => [i.eventId, i.state])).toEqual([["half", "partial"]]);
  });

  it("multiple overdue events queue oldest first", () => {
    const q = buildAttendanceQueue({
      events: [
        ev("new", { starts_at: iso(NOW - 4 * H), ends_at: iso(NOW - 2 * H) }),
        ev("old", { starts_at: iso(NOW - 50 * H), ends_at: iso(NOW - 48 * H) }),
      ],
      games: [],
      ...none,
      now: NOW,
    });
    expect(q.map((i) => i.eventId)).toEqual(["old", "new"]);
  });

  it("events older than the window stop prompting", () => {
    const q = buildAttendanceQueue({
      events: [ev("ancient", { starts_at: iso(NOW - 9 * 24 * H), ends_at: iso(NOW - 9 * 24 * H + H) })],
      games: [],
      ...none,
      now: NOW,
    });
    expect(q).toEqual([]);
  });

  it("a final game without a calendar entry is queued once; a linked one is not duplicated", () => {
    const games = [
      { id: "g1", team_id: "t1", opponent: "Mission Viejo", status: "final", created_at: iso(NOW - 3 * H), ended_at: iso(NOW - H) },
      { id: "g2", team_id: "t1", opponent: "Tesoro", status: "final", created_at: iso(NOW - 3 * H), ended_at: iso(NOW - H) },
      { id: "g3", team_id: "t1", opponent: "Live", status: "live", created_at: iso(NOW - H), ended_at: null },
    ];
    const q = buildAttendanceQueue({
      events: [ev("e2", { event_type: "game", game_id: "g2", starts_at: iso(NOW - 2 * H), ends_at: iso(NOW + H) })],
      games,
      ...none,
      now: NOW,
    });
    expect(q.map((i) => i.key).sort()).toEqual(["event:e2", "game:g1"]);
    expect(q.find((i) => i.key === "game:g1")!.eventId).toBeNull();
  });
});

describe("attendance state", () => {
  it("no rows and no marker is not started — never absent", () => {
    expect(attendanceState("x", new Map(), new Set())).toBe("not_started");
  });
});

describe("entry sheet", () => {
  it("every active player starts On time", () => {
    const e = defaultEntries(["p1", "p2"]);
    expect(e["p1"]!.status).toBe("on_time");
    expect(e["p2"]!.status).toBe("on_time");
  });

  it("saved rows win over the On time default", () => {
    const e = defaultEntries(["p1"], [{ player_id: "p1", status: "out", reason: "sick", note: null }]);
    expect(e["p1"]).toEqual({ status: "out", reason: "sick", note: "" });
  });

  it("Late and Out require a reason", () => {
    expect(entryProblem({ status: "late", reason: null, note: "" })).toBe("Pick a reason");
    expect(entryProblem({ status: "out", reason: null, note: "" })).toBe("Pick a reason");
    expect(entryProblem({ status: "out", reason: "hurt", note: "" })).toBeNull();
    expect(entryProblem({ status: "early", reason: null, note: "" })).toBeNull();
  });

  it("Other keeps a note; other reasons and present statuses drop it", () => {
    const other = withReason({ status: "late", reason: null, note: "Bus was late" }, "other");
    expect(toSaveRows(["p"], { p: other })[0]).toEqual({ player_id: "p", status: "late", reason: "other", note: "Bus was late" });
    expect(withReason(other, "sick").note).toBe("");
    expect(withStatus(other, "on_time")).toEqual({ status: "on_time", reason: null, note: "" });
  });

  it("saving writes one row per active player", () => {
    const rows = toSaveRows(["a", "b", "c"], defaultEntries(["a", "b", "c"]));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === "on_time" && r.reason === null)).toBe(true);
  });
});

describe("summary", () => {
  it("attendance % = (Early + On time + Late) / tracked events", () => {
    const s = summarizePlayer([{ status: "early" }, { status: "on_time" }, { status: "late" }, { status: "out" }]);
    expect(s).toEqual({ tracked: 4, early: 1, on_time: 1, late: 1, out: 1, pct: 75 });
  });

  it("untracked events are excluded — no rows means no percentage", () => {
    expect(summarizePlayer([]).pct).toBeNull();
    expect(summarizePlayer([{ status: "on_time" }]).pct).toBe(100);
  });
});

describe("Later snooze", () => {
  it("hides the prompt for the rest of the day only", () => {
    const today = localDayKey(NOW);
    expect(isSnoozed(today, NOW)).toBe(true);
    expect(isSnoozed(today, NOW + 24 * H)).toBe(false);
    expect(isSnoozed(null, NOW)).toBe(false);
  });
});
