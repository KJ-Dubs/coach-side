/**
 * Pure attendance rules shared by the Home prompt, the entry sheet, the
 * calendar badges and the team summary — so they can never disagree.
 *
 * Absence is never inferred: an event with no saved rows is "untracked",
 * not "everyone was out".
 */

export const ATTENDANCE_STATUSES = ["early", "on_time", "late", "out"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_REASONS = ["sick", "hurt", "no_call_no_show", "other"] as const;
export type AttendanceReason = (typeof ATTENDANCE_REASONS)[number];

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  early: "Early",
  on_time: "On time",
  late: "Late",
  out: "Out",
};

export const REASON_LABEL: Record<AttendanceReason, string> = {
  sick: "Sick",
  hurt: "Hurt",
  no_call_no_show: "No call / no show",
  other: "Other",
};

/** Used when a practice or game has no end time. */
export const FALLBACK_DURATION_MS = 2 * 60 * 60 * 1000;
/** Only recent events prompt on Home; older ones stay reachable from the calendar. */
export const DUE_WINDOW_DAYS = 7;
export const NOTE_MAX = 280;

export type AttendanceState = "not_started" | "partial" | "completed" | "skipped";

export function needsReason(status: AttendanceStatus): boolean {
  return status === "late" || status === "out";
}

type EventLike = {
  id: string;
  team_id: string;
  title: string;
  event_type?: string | null;
  kind?: string | null;
  status?: string | null;
  starts_at: string;
  ends_at: string | null;
  game_id?: string | null;
  opponent?: string | null;
  home_away?: string | null;
};

type GameLike = {
  id: string;
  team_id: string;
  opponent: string;
  status: string;
  created_at?: string | null;
  ended_at?: string | null;
};

export function attendanceEventType(e: Pick<EventLike, "event_type" | "kind">): "practice" | "game" | null {
  const t = e.event_type || e.kind || "";
  return t === "practice" || t === "game" ? t : null;
}

/** Practices and games that were not cancelled. */
export function isAttendanceEvent(e: Pick<EventLike, "event_type" | "kind" | "status">): boolean {
  if (!attendanceEventType(e)) return false;
  const s = (e.status ?? "").toLowerCase();
  return s !== "cancelled" && s !== "canceled";
}

/**
 * When attendance becomes due: the event's end, else start + 2 hours.
 * A linked game that is already final makes it due at the final whistle.
 */
export function attendanceDueAt(
  e: Pick<EventLike, "starts_at" | "ends_at">,
  game?: Pick<GameLike, "status" | "ended_at"> | null,
): number {
  const start = new Date(e.starts_at).getTime();
  const end = e.ends_at ? new Date(e.ends_at).getTime() : start + FALLBACK_DURATION_MS;
  if (game && game.status === "final") {
    const final = game.ended_at ? new Date(game.ended_at).getTime() : start;
    return Math.min(end, final);
  }
  return end;
}

export function attendanceState(
  eventId: string,
  sessions: ReadonlyMap<string, "completed" | "skipped">,
  recorded: ReadonlySet<string>,
): AttendanceState {
  const s = sessions.get(eventId);
  if (s) return s;
  return recorded.has(eventId) ? "partial" : "not_started";
}

export type AttendanceQueueItem = {
  key: string;
  /** Null for a game started without a calendar entry (one is created on open). */
  eventId: string | null;
  gameId: string | null;
  teamId: string;
  title: string;
  eventType: "practice" | "game";
  startsAt: string;
  dueAt: number;
  state: AttendanceState;
};

export function buildAttendanceQueue(input: {
  events: EventLike[];
  games: GameLike[];
  sessions: ReadonlyMap<string, "completed" | "skipped">;
  recorded: ReadonlySet<string>;
  now: number;
  windowDays?: number;
}): AttendanceQueueItem[] {
  const { events, games, sessions, recorded, now } = input;
  const from = now - (input.windowDays ?? DUE_WINDOW_DAYS) * 86_400_000;
  const gameById = new Map(games.map((g) => [g.id, g]));
  const linkedGames = new Set(events.map((e) => e.game_id).filter(Boolean) as string[]);
  const items: AttendanceQueueItem[] = [];

  for (const e of events) {
    if (!isAttendanceEvent(e)) continue;
    const due = attendanceDueAt(e, e.game_id ? gameById.get(e.game_id) : null);
    if (due > now || due < from) continue;
    const state = attendanceState(e.id, sessions, recorded);
    if (state === "completed" || state === "skipped") continue;
    const type = attendanceEventType(e)!;
    items.push({
      key: `event:${e.id}`,
      eventId: e.id,
      gameId: e.game_id ?? null,
      teamId: e.team_id,
      title: type === "game" && e.opponent ? `${e.home_away === "away" ? "@" : "vs"} ${e.opponent}` : e.title,
      eventType: type,
      startsAt: e.starts_at,
      dueAt: due,
      state,
    });
  }

  for (const g of games) {
    if (g.status !== "final" || linkedGames.has(g.id)) continue;
    const at = g.ended_at ?? g.created_at;
    if (!at) continue;
    const due = new Date(at).getTime();
    if (due > now || due < from) continue;
    items.push({
      key: `game:${g.id}`,
      eventId: null,
      gameId: g.id,
      teamId: g.team_id,
      title: g.opponent ? `vs ${g.opponent}` : "Game",
      eventType: "game",
      startsAt: g.created_at ?? at,
      dueAt: due,
      state: "not_started",
    });
  }

  return items.sort((a, b) => a.dueAt - b.dueAt);
}

export type AttendanceEntry = {
  status: AttendanceStatus;
  reason: AttendanceReason | null;
  note: string;
};

export type SavedAttendance = {
  player_id: string;
  status: string;
  reason: string | null;
  note: string | null;
};

/** Everyone starts On time on screen; saved rows win. Nothing is written until Save. */
export function defaultEntries(
  playerIds: string[],
  saved: SavedAttendance[] = [],
): Record<string, AttendanceEntry> {
  const byPlayer = new Map(saved.map((r) => [r.player_id, r]));
  const out: Record<string, AttendanceEntry> = {};
  for (const id of playerIds) {
    const r = byPlayer.get(id);
    out[id] = r
      ? {
          status: (ATTENDANCE_STATUSES as readonly string[]).includes(r.status)
            ? (r.status as AttendanceStatus)
            : "on_time",
          reason: (r.reason as AttendanceReason | null) ?? null,
          note: r.note ?? "",
        }
      : { status: "on_time", reason: null, note: "" };
  }
  return out;
}

/** Applies a status tap; reasons/notes only survive where they still apply. */
export function withStatus(entry: AttendanceEntry, status: AttendanceStatus): AttendanceEntry {
  if (!needsReason(status)) return { status, reason: null, note: "" };
  return { ...entry, status };
}

export function withReason(entry: AttendanceEntry, reason: AttendanceReason): AttendanceEntry {
  return { ...entry, reason, note: reason === "other" ? entry.note : "" };
}

export function entryProblem(entry: AttendanceEntry): string | null {
  if (needsReason(entry.status) && !entry.reason) return "Pick a reason";
  if (entry.note.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters`;
  return null;
}

export function toSaveRows(
  playerIds: string[],
  entries: Record<string, AttendanceEntry>,
): { player_id: string; status: AttendanceStatus; reason: AttendanceReason | null; note: string | null }[] {
  return playerIds.map((id) => {
    const e = entries[id] ?? { status: "on_time" as const, reason: null, note: "" };
    const reason = needsReason(e.status) ? e.reason : null;
    const note = reason === "other" && e.note.trim() ? e.note.trim().slice(0, NOTE_MAX) : null;
    return { player_id: id, status: e.status, reason, note };
  });
}

export type PlayerAttendanceSummary = {
  tracked: number;
  early: number;
  on_time: number;
  late: number;
  out: number;
  /** (Early + On time + Late) / tracked events; null when nothing is tracked. */
  pct: number | null;
};

/** Untracked events never count — only saved rows do. */
export function summarizePlayer(rows: Pick<SavedAttendance, "status">[]): PlayerAttendanceSummary {
  const s = { tracked: 0, early: 0, on_time: 0, late: 0, out: 0 };
  for (const r of rows) {
    if (!(ATTENDANCE_STATUSES as readonly string[]).includes(r.status)) continue;
    s.tracked += 1;
    s[r.status as AttendanceStatus] += 1;
  }
  const present = s.early + s.on_time + s.late;
  return { ...s, pct: s.tracked ? Math.round((present / s.tracked) * 100) : null };
}

/** Home prompt heading, e.g. "Attendance from today's practice". */
export function promptHeading(item: Pick<AttendanceQueueItem, "eventType" | "startsAt">, now: number): string {
  const when = new Date(item.startsAt);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  const kind = item.eventType === "game" ? "game" : "practice";
  if (when.toDateString() === today.toDateString()) return `Attendance from today's ${kind}`;
  if (when.toDateString() === yesterday.toDateString()) return `Attendance from yesterday's ${kind}`;
  const day = when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `Attendance from ${day} ${kind}`;
}

/** "Later" hides the prompt until the next local day. */
export function localDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isSnoozed(stored: string | null, now: number): boolean {
  return !!stored && stored === localDayKey(now);
}
