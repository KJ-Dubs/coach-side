/**
 * Team season actions. Every write goes through head-coach / coach-checked
 * database functions; nothing here deletes data.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CarryForward } from "./teamSeason";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

export async function endSeason(input: {
  teamId: string;
  startNext: boolean;
  nextName: string;
  nextSeason: string;
  carry: CarryForward;
}): Promise<{ archivedTeamId: string; newTeamId: string | null; players: number }> {
  const { data, error } = await rpc("end_team_season", {
    _team: input.teamId,
    _start_next: input.startNext,
    _next_name: input.nextName,
    _next_season: input.nextSeason,
    _carry: {
      branding: input.carry.branding,
      coaches: input.carry.coaches,
      playbook: input.carry.playbook,
      folders: input.carry.folders,
      plans: input.carry.plans,
      player_ids: input.carry.playerIds,
    },
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { archived_team_id?: string; new_team_id?: string | null; players?: number };
  return { archivedTeamId: r.archived_team_id ?? input.teamId, newTeamId: r.new_team_id ?? null, players: Number(r.players ?? 0) };
}

export async function reactivateSeason(teamId: string): Promise<void> {
  const { error } = await rpc("reactivate_team_season", { _team: teamId });
  if (error) throw new Error(error.message);
}

export async function setTrainingTeam(teamId: string, on: boolean): Promise<void> {
  const { error } = await rpc("set_team_training", { _team: teamId, _on: on });
  if (error) throw new Error(error.message);
}

export type SeasonReview = {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  leaders: { name: string; jersey: string; points: number }[];
  attendanceEvents: number;
  attendancePct: number | null;
  practicesDone: number;
  gamesScheduled: number;
  upcoming: number;
  plays: number;
  folders: number;
  plans: number;
};

/** Read-only wrap-up numbers for the End Season review step. */
export async function fetchSeasonReview(teamId: string): Promise<SeasonReview> {
  const { fetchEventsForGames, fetchSubsForGames, fetchTeamPlays, fetchPlaybookFolders, fetchPlayers } = await import("./data");
  const { aggregatePlayers } = await import("./stats");
  const nowIso = new Date().toISOString();
  const [bundle, plays, folders, players, events, attendance, plans] = await Promise.all([
    (async () => {
      const { data } = await supabase.from("games").select("*").eq("team_id", teamId).eq("status", "final");
      const games = (data ?? []) as unknown as import("./types").Game[];
      const ids = games.map((g) => g.id);
      const [events, subs] = await Promise.all([fetchEventsForGames(ids), fetchSubsForGames(ids)]);
      return { games, events, subs };
    })().catch(() => null),
    fetchTeamPlays(teamId).catch(() => []),
    fetchPlaybookFolders(teamId).catch(() => []),
    fetchPlayers(teamId).catch(() => []),
    supabase.from("team_events").select("event_type, kind, status, starts_at").eq("team_id", teamId),
    supabase.from("event_attendance").select("event_id, status").eq("team_id", teamId),
    supabase.from("practice_plans").select("id", { count: "exact", head: true }).eq("team_id", teamId),
  ]);

  const games = (bundle?.games ?? []).filter((g) => g.team_id === teamId);
  let wins = 0, losses = 0, ties = 0;
  for (const g of games) {
    const us = Number(g.team_score ?? 0), them = Number(g.opp_score ?? 0);
    if (us > them) wins++;
    else if (us < them) losses++;
    else ties++;
  }
  const lines = bundle ? aggregatePlayers(games, bundle.events, bundle.subs) : new Map();
  const leaders = players
    .map((p) => ({ name: p.name, jersey: p.jersey, points: Number((lines.get(p.id) as { pts?: number } | undefined)?.pts ?? 0) }))
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  const att = (attendance.data ?? []) as { event_id: string; status: string }[];
  const present = att.filter((r) => r.status !== "out").length;
  const ev = (events.data ?? []) as { event_type: string; kind: string; status: string; starts_at: string }[];
  const live = ev.filter((e) => !/cancel/i.test(e.status ?? ""));
  return {
    games: games.length,
    wins,
    losses,
    ties,
    leaders,
    attendanceEvents: new Set(att.map((r) => r.event_id)).size,
    attendancePct: att.length ? Math.round((present / att.length) * 100) : null,
    practicesDone: live.filter((e) => (e.event_type || e.kind) === "practice" && e.starts_at <= nowIso).length,
    gamesScheduled: live.filter((e) => (e.event_type || e.kind) === "game").length,
    upcoming: live.filter((e) => e.starts_at > nowIso).length,
    plays: plays.length,
    folders: folders.length,
    plans: plans.count ?? 0,
  };
}
