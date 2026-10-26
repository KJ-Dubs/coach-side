/**
 * Attendance data access. Reads are RLS-scoped to the team's coaches; every
 * write goes through coach-checked database functions.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Game, Player, TeamEvent } from "./types";
import { sortPlayers } from "./data";
import type { AttendanceReason, AttendanceStatus, SavedAttendance } from "./attendanceRules";
import { DUE_WINDOW_DAYS } from "./attendanceRules";

export type AttendanceRow = SavedAttendance & {
  id: string;
  event_id: string;
  team_id: string;
  recorded_at: string;
  updated_at: string;
};

export type AttendanceIndex = {
  sessions: Map<string, "completed" | "skipped">;
  recorded: Set<string>;
};

async function indexFor(eventIds: string[]): Promise<AttendanceIndex> {
  const sessions = new Map<string, "completed" | "skipped">();
  const recorded = new Set<string>();
  if (!eventIds.length) return { sessions, recorded };
  const chunks: string[][] = [];
  for (let i = 0; i < eventIds.length; i += 150) chunks.push(eventIds.slice(i, i + 150));
  for (const ids of chunks) {
    const [s, r] = await Promise.all([
      supabase.from("event_attendance_sessions").select("event_id, status").in("event_id", ids),
      supabase.from("event_attendance").select("event_id").in("event_id", ids),
    ]);
    if (s.error) throw s.error;
    if (r.error) throw r.error;
    for (const row of s.data ?? []) sessions.set(row.event_id, row.status as "completed" | "skipped");
    for (const row of r.data ?? []) recorded.add(row.event_id);
  }
  return { sessions, recorded };
}

/** Everything the Home prompt needs for the coach's teams, recent window only. */
export async function fetchAttendanceOverview(teamIds: string[], now = Date.now()) {
  if (!teamIds.length) return { events: [] as TeamEvent[], games: [] as Game[], ...(await indexFor([])) };
  const since = new Date(now - (DUE_WINDOW_DAYS + 1) * 86_400_000).toISOString();
  const [ev, gm] = await Promise.all([
    supabase
      .from("team_events")
      .select("*")
      .in("team_id", teamIds)
      .in("event_type", ["practice", "game"])
      .gte("starts_at", since)
      .lte("starts_at", new Date(now).toISOString())
      .order("starts_at"),
    supabase
      .from("games")
      .select("id, team_id, opponent, status, created_at, ended_at")
      .in("team_id", teamIds)
      .eq("status", "final")
      .gte("created_at", since),
  ]);
  if (ev.error) throw ev.error;
  if (gm.error) throw gm.error;
  const events = (ev.data ?? []) as unknown as TeamEvent[];
  const games = (gm.data ?? []) as unknown as Game[];
  // Games already linked to an older calendar entry still need that entry's state.
  const linkedIds = games.map((g) => g.id).filter((id) => !events.some((e) => e.game_id === id));
  if (linkedIds.length) {
    const extra = await supabase.from("team_events").select("*").in("game_id", linkedIds);
    if (!extra.error) events.push(...((extra.data ?? []) as unknown as TeamEvent[]));
  }
  return { events, games, ...(await indexFor(events.map((e) => e.id))) };
}

/** Attendance state for every event on one team (calendar / Locker Room badges). */
export async function fetchTeamAttendanceIndex(teamId: string): Promise<AttendanceIndex> {
  const [s, r] = await Promise.all([
    supabase.from("event_attendance_sessions").select("event_id, status").eq("team_id", teamId),
    supabase.from("event_attendance").select("event_id").eq("team_id", teamId),
  ]);
  if (s.error) throw s.error;
  if (r.error) throw r.error;
  return {
    sessions: new Map((s.data ?? []).map((x) => [x.event_id, x.status as "completed" | "skipped"])),
    recorded: new Set((r.data ?? []).map((x) => x.event_id)),
  };
}

export type AttendanceSheet = {
  event: TeamEvent;
  teamName: string;
  players: Player[];
  saved: AttendanceRow[];
  session: "completed" | "skipped" | null;
  /** Players seen in the linked game's lineups or stats — a hint only. */
  usedInGame: Set<string>;
};

export async function fetchAttendanceSheet(eventId: string): Promise<AttendanceSheet | null> {
  const ev = await supabase.from("team_events").select("*").eq("id", eventId).maybeSingle();
  if (ev.error) throw ev.error;
  if (!ev.data) return null;
  const event = ev.data as unknown as TeamEvent;
  const [team, players, saved, session] = await Promise.all([
    supabase.from("teams").select("name").eq("id", event.team_id).maybeSingle(),
    supabase.from("players").select("*").eq("team_id", event.team_id),
    supabase.from("event_attendance").select("*").eq("event_id", eventId),
    supabase.from("event_attendance_sessions").select("status").eq("event_id", eventId).maybeSingle(),
  ]);
  if (players.error) throw players.error;
  if (saved.error) throw saved.error;

  const usedInGame = new Set<string>();
  if (event.game_id) {
    const [g, evs, subs] = await Promise.all([
      supabase.from("games").select("starting_five").eq("id", event.game_id).maybeSingle(),
      supabase.from("game_events").select("player_id, current_lineup").eq("game_id", event.game_id),
      supabase.from("substitutions").select("player_in").eq("game_id", event.game_id),
    ]);
    for (const id of (g.data?.starting_five as string[] | null) ?? []) usedInGame.add(id);
    for (const row of evs.data ?? []) {
      if (row.player_id) usedInGame.add(row.player_id);
      for (const id of (row.current_lineup as string[] | null) ?? []) usedInGame.add(id);
    }
    for (const row of subs.data ?? []) if (row.player_in) usedInGame.add(row.player_in);
  }

  return {
    event,
    teamName: team.data?.name ?? "",
    players: sortPlayers((players.data ?? []) as Player[]),
    saved: (saved.data ?? []) as AttendanceRow[],
    session: (session.data?.status as "completed" | "skipped" | undefined) ?? null,
    usedInGame,
  };
}

export async function saveAttendance(
  eventId: string,
  rows: { player_id: string; status: AttendanceStatus; reason: AttendanceReason | null; note: string | null }[],
): Promise<number> {
  const { data, error } = await supabase.rpc("save_event_attendance", { _event: eventId, _rows: rows });
  if (error) throw error;
  return Number((data as { saved?: number } | null)?.saved ?? rows.length);
}

export async function skipAttendance(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("skip_event_attendance", { _event: eventId });
  if (error) throw error;
}

/** Returns the game's calendar entry, creating a quiet one if the game had none. */
export async function ensureGameAttendanceEvent(gameId: string): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_game_attendance_event", { _game: gameId });
  if (error) throw error;
  return data as string;
}

export type AttendanceHistoryRow = AttendanceRow & {
  event: { title: string; event_type: string; starts_at: string; opponent: string | null } | null;
};

export async function fetchTeamAttendance(teamId: string): Promise<AttendanceHistoryRow[]> {
  const { data, error } = await supabase
    .from("event_attendance")
    .select("*, event:team_events(title, event_type, starts_at, opponent)")
    .eq("team_id", teamId);
  if (error) throw error;
  return ((data ?? []) as unknown as AttendanceHistoryRow[]).sort((a, b) =>
    (a.event?.starts_at ?? "").localeCompare(b.event?.starts_at ?? ""),
  );
}
