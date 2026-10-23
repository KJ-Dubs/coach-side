/**
 * Pure, read-only summary of how a coach used Live Game for one game.
 * Feeds the owner-only Game Usage Inspector. Never writes anything and
 * never invents numbers: a category whose tracking was off reads as
 * `null` ("Not tracked"), not zero.
 */
import { formatClock } from "./court";
import {
  FULL_TRACKING,
  computeCoverage,
  normalizeTracking,
  periodLabel,
  usesPaidTracking,
  type Coverage,
  type TrackingKey,
} from "./gameConfig";
import { eventPoints, isOppEvent, shotValueOf } from "./stats";
import type { Game, GameEvent, Player, Substitution } from "./types";

export type TrackingMode = "full" | "custom" | "scoreboard";

export const MODE_LABEL: Record<TrackingMode, string> = {
  full: "Full player stats",
  custom: "Custom stats",
  scoreboard: "Scoreboard only",
};

/** NULL config is the original full tracker (legacy games). */
export function trackingMode(raw: unknown): TrackingMode {
  if (raw == null) return "full";
  const cfg = normalizeTracking(raw);
  if (!usesPaidTracking(cfg)) return "scoreboard";
  const keys = (Object.keys(FULL_TRACKING) as TrackingKey[]).filter((k) => k !== "clock");
  return keys.every((k) => cfg[k]) ? "full" : "custom";
}

/** A count, or null when the category was never tracked and has no events. */
export type Tracked = number | null;

export type PostGameLog = { edited: number; added: number; deleted: number };

export type GameUsageSummary = {
  mode: TrackingMode;
  totalEvents: number;
  scoringEvents: number;
  fgMade: number;
  fgMissed: number;
  threesMade: number;
  ftMade: number;
  ftMissed: number;
  rebounds: Tracked;
  assists: Tracked;
  steals: Tracked;
  turnovers: Tracked;
  blocks: Tracked;
  fouls: Tracked;
  opponentEvents: number;
  opponentStatEvents: Tracked;
  opponentFouls: Tracked;
  substitutions: Tracked;
  playersWithEvents: number;
  locatedEvents: number;
  postGame: { edited: number; added: number; deleted: number; total: number };
  diagnostics: {
    courtLocationsUsed: boolean;
    substitutionsTracked: boolean;
    clockUsed: boolean;
    opponentStatsTracked: boolean;
    completed: boolean;
  };
  coverage: Record<TrackingKey, Coverage>;
};

const tracked = (cov: Coverage, n: number): Tracked => (cov.status !== "none" || n > 0 ? n : null);

export function summarizeGameUsage(
  game: Game,
  events: GameEvent[],
  subs: Substitution[],
  log: PostGameLog = { edited: 0, added: 0, deleted: 0 },
): GameUsageSummary {
  const coverage = computeCoverage(game, events);
  const cfg = normalizeTracking(game.stat_tracking_config);
  const count = (fn: (e: GameEvent) => boolean) => events.filter(fn).length;
  const ours = events.filter((e) => !isOppEvent(e));
  const ourCount = (t: string) => ours.filter((e) => e.event_type === t).length;

  const ctx = (e: GameEvent) => (e.context ?? {}) as Record<string, unknown>;
  const editedInEvents = count((e) => typeof ctx(e)["postgame_edited_at"] === "string" && ctx(e)["postgame"] !== true);
  const addedInEvents = count((e) => ctx(e)["postgame"] === true);
  // The activity log is authoritative for deletes; for edits/adds take the
  // larger of the log and what the saved events still show.
  const edited = Math.max(editedInEvents, log.edited);
  const added = Math.max(addedInEvents, log.added);

  const oppStatTypes = new Set(["OPP_MISS", "OPP_FT_MISS", "OPP_REBOUND", "OPP_TURNOVER"]);
  const opponentStatEvents = count((e) => oppStatTypes.has(String(e.event_type)));
  const opponentFouls = count((e) => e.event_type === "OPP_FOUL");
  const locatedEvents = ours.filter((e) => e.x != null && e.y != null).length;
  const subCov: Coverage = coverage.players;

  return {
    mode: trackingMode(game.stat_tracking_config),
    totalEvents: events.length,
    scoringEvents: count((e) => eventPoints(e) > 0),
    fgMade: ourCount("MADE"),
    fgMissed: ourCount("MISS"),
    threesMade: ours.filter((e) => e.event_type === "MADE" && shotValueOf(e) === 3).length,
    ftMade: ourCount("FT_MADE"),
    ftMissed: ourCount("FT_MISS"),
    rebounds: tracked(coverage.rebounds, ourCount("REBOUND")),
    assists: tracked(coverage.assists, ourCount("ASSIST")),
    steals: tracked(coverage.steals, ourCount("STEAL")),
    turnovers: tracked(coverage.turnovers, ourCount("TURNOVER")),
    blocks: tracked(coverage.blocks, ourCount("BLOCK")),
    fouls: tracked(coverage.fouls, ourCount("FOUL")),
    opponentEvents: count(isOppEvent),
    opponentStatEvents: tracked(coverage.opponent, opponentStatEvents),
    opponentFouls: tracked(coverage.oppFouls, opponentFouls),
    substitutions: tracked(subCov, subs.length),
    playersWithEvents: new Set(ours.map((e) => e.player_id).filter(Boolean)).size,
    locatedEvents,
    postGame: { edited, added, deleted: log.deleted, total: edited + added + log.deleted },
    diagnostics: {
      courtLocationsUsed: locatedEvents > 0,
      substitutionsTracked: subs.length > 0,
      clockUsed: cfg.clock,
      opponentStatsTracked: coverage.opponent.status !== "none" || opponentStatEvents > 0,
      completed: game.status === "final",
    },
    coverage,
  };
}

/* ---------------- timeline ---------------- */

export type TimelineItem = {
  id: string;
  kind: "event" | "sub";
  side: "us" | "opp";
  label: string;
  text: string;
  points: number;
  team: number;
  opp: number;
};

function shot(e: GameEvent) {
  return shotValueOf(e) === 3 ? "3PT" : "2PT";
}

export function describeEvent(e: GameEvent, jerseyOf: (id: string | null) => string | null): string {
  const t = String(e.event_type);
  const j = jerseyOf(e.player_id);
  const who = j ? `#${j}` : "Team";
  const detail = e.result && !/^(2PT|3PT|FT)$/.test(e.result) ? ` (${e.result.toLowerCase()})` : "";
  const reb = (r: string | null) => (r === "OFF" ? "offensive rebound" : r === "DEF" ? "defensive rebound" : "rebound");
  switch (t) {
    case "MADE": return `${who} made ${shot(e)}`;
    case "MISS": return `${who} missed ${shot(e)}`;
    case "FT_MADE": return `${who} made free throw`;
    case "FT_MISS": return `${who} missed free throw`;
    case "REBOUND": return `${who} ${reb(e.result)}`;
    case "ASSIST": return `${who} assist`;
    case "STEAL": return `${who} steal`;
    case "BLOCK": return `${who} block`;
    case "TURNOVER": return `${who} turnover${detail}`;
    case "FOUL": return `${who} foul${detail}`;
    case "OUT_OF_BOUNDS": return "Out of bounds";
    case "OPP_MADE": return `Opponent made ${shot(e)}`;
    case "OPP_MISS": return `Opponent missed ${shot(e)}`;
    case "OPP_FT_MADE": return "Opponent made free throw";
    case "OPP_FT_MISS": return "Opponent missed free throw";
    case "OPP_SCORE": return `Opponent scored ${eventPoints(e)}`;
    case "OPP_REBOUND": return `Opponent ${reb(e.result)}`;
    case "OPP_TURNOVER": return "Opponent turnover";
    case "OPP_FOUL": return "Opponent foul";
    default: return `${who} ${t.toLowerCase().replace(/_/g, " ")}`;
  }
}

/**
 * Chronological events and substitutions with a running score. With the
 * clock off, items are labeled by period and entry order — never a made-up
 * time.
 */
export function buildTimeline(
  game: Game,
  events: GameEvent[],
  subs: Substitution[],
  players: Pick<Player, "id" | "jersey">[],
): TimelineItem[] {
  const clockOn = normalizeTracking(game.stat_tracking_config).clock;
  const jersey = new Map(players.map((p) => [p.id, p.jersey]));
  const jerseyOf = (id: string | null) => (id ? (jersey.get(id) ?? "?") : null);
  type Row = { q: number; clock: number; at: string; ev?: GameEvent; sub?: Substitution };
  const rows: Row[] = [
    ...events.map((e) => ({ q: e.quarter || 1, clock: e.clock_seconds ?? 0, at: e.created_at, ev: e })),
    ...subs.map((s) => ({ q: s.quarter || 1, clock: s.clock_seconds ?? 0, at: s.created_at, sub: s })),
  ];
  rows.sort((a, b) => a.q - b.q || (clockOn ? b.clock - a.clock : 0) || a.at.localeCompare(b.at));
  let team = 0;
  let opp = 0;
  const perPeriod = new Map<number, number>();
  return rows.map((r) => {
    const n = (perPeriod.get(r.q) ?? 0) + 1;
    perPeriod.set(r.q, n);
    const label = clockOn
      ? `${periodLabel(r.q, game.periods || 4)} ${formatClock(r.clock)}`
      : `${periodLabel(r.q, game.periods || 4)} · #${n}`;
    if (r.sub) {
      const s = r.sub;
      const inJ = jerseyOf(s.player_in);
      const outJ = jerseyOf(s.player_out);
      return {
        id: `sub-${s.id}`,
        kind: "sub" as const,
        side: "us" as const,
        label,
        text: `Sub: ${inJ ? `#${inJ}` : "—"} in / ${outJ ? `#${outJ}` : "—"} out`,
        points: 0,
        team,
        opp,
      };
    }
    const e = r.ev!;
    const pts = eventPoints(e);
    const side = isOppEvent(e) ? ("opp" as const) : ("us" as const);
    if (side === "opp") opp += pts;
    else team += pts;
    return { id: e.id, kind: "event" as const, side, label, text: describeEvent(e, jerseyOf), points: pts, team, opp };
  });
}

/** Real time between two timestamps, in seconds, or null. */
export function elapsedSeconds(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / 1000;
  return Number.isFinite(d) && d >= 0 ? d : null;
}

export function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
