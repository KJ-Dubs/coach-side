// Single statistical source of truth: everything is derived from saved games,
// game_events and substitutions. Nothing here is stored back to the database.
import { distanceFt, isThree } from "./court";
import type { Game, GameEvent, Player, Substitution } from "./types";

export type Split = { made: number; att: number };

export type PlayerLine = {
  playerId: string;
  games: number;
  starts: number;
  seconds: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  pf: number;
  fg: Split;
  two: Split;
  three: Split;
  ft: Split;
  rim: Split;
};

export type TeamLine = {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pts: number;
  oppPts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  pf: number;
  oppFouls: number;
  fg: Split;
  two: Split;
  three: Split;
  ft: Split;
  rim: Split;
};

const emptySplit = (): Split => ({ made: 0, att: 0 });

export function emptyPlayerLine(playerId: string): PlayerLine {
  return {
    playerId,
    games: 0,
    starts: 0,
    seconds: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
    pf: 0,
    fg: emptySplit(),
    two: emptySplit(),
    three: emptySplit(),
    ft: emptySplit(),
    rim: emptySplit(),
  };
}

export function emptyTeamLine(): TeamLine {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pts: 0,
    oppPts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
    pf: 0,
    oppFouls: 0,
    fg: emptySplit(),
    two: emptySplit(),
    three: emptySplit(),
    ft: emptySplit(),
    rim: emptySplit(),
  };
}

/* ---------------- shot classification ---------------- */

export function isFieldGoal(e: GameEvent) {
  return e.event_type === "MADE" || e.event_type === "MISS";
}

export function isFreeThrow(e: GameEvent) {
  return e.event_type === "FT_MADE" || e.event_type === "FT_MISS";
}

export function isThreeAttempt(e: GameEvent) {
  if (e.event_type === "MADE" && e.points) return e.points === 3;
  if (e.result === "3PT") return true;
  if (e.result === "2PT") return false;
  if (e.x != null && e.y != null) return isThree(e.x, e.y);
  return false;
}

/** Layup / rim attempts: inside ~6ft of the basket. */
export function isRimAttempt(e: GameEvent) {
  if (e.zone === "rim") return true;
  if (e.x != null && e.y != null) return distanceFt(e.x, e.y) <= 6;
  return false;
}

export function pct(s: Split): number | null {
  if (!s.att) return null;
  return (s.made / s.att) * 100;
}

export function fmtPct(s: Split, digits = 1): string {
  const p = pct(s);
  return p == null ? "—" : `${p.toFixed(digits)}%`;
}

export function fmtSplit(s: Split) {
  return `${s.made}/${s.att}`;
}

export function fmtMinutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtPer(n: number, games: number, digits = 1) {
  if (!games) return "—";
  return (n / games).toFixed(digits);
}

/* ---------------- scores ---------------- */

export function scoreFromEvents(events: GameEvent[]) {
  let team = 0;
  let opp = 0;
  for (const e of events) {
    if (e.event_type === "OPP_SCORE") opp += e.points || 0;
    else team += e.points || 0;
  }
  return { team, opp };
}

/** Events win over the stored score, unless the game has no events at all. */
export function gameScore(game: Game, events: GameEvent[]) {
  if (!events.length) return { team: game.team_score, opp: game.opp_score };
  const s = scoreFromEvents(events);
  if (s.team === 0 && s.opp === 0 && (game.team_score || game.opp_score)) {
    return { team: game.team_score, opp: game.opp_score };
  }
  return s;
}

export function gameResult(game: Game, events: GameEvent[]): "W" | "L" | "T" | null {
  if (game.status !== "final") return null;
  const s = gameScore(game, events);
  if (s.team > s.opp) return "W";
  if (s.team < s.opp) return "L";
  return "T";
}

/* ---------------- minutes ---------------- */

function periodLength(game: Game, q: number) {
  const regulation = game.periods || 4;
  return q <= regulation ? (game.period_minutes || 8) * 60 : (game.overtime_minutes ?? 4) * 60;
}

/** Absolute elapsed seconds from tip-off for a (period, clock) pair. */
export function absoluteSeconds(game: Game, quarter: number, clock: number) {
  let t = 0;
  for (let q = 1; q < quarter; q++) t += periodLength(game, q);
  return t + Math.max(0, periodLength(game, quarter) - Math.max(0, clock));
}

/** Total seconds the game ran (final games only make sense here). */
export function gameLengthSeconds(game: Game, events: GameEvent[], subs: Substitution[]) {
  let end = absoluteSeconds(game, game.quarter || 1, game.clock_seconds ?? 0);
  // Never end before the last recorded action.
  for (const e of events) end = Math.max(end, absoluteSeconds(game, e.quarter, e.clock_seconds));
  for (const s of subs) end = Math.max(end, absoluteSeconds(game, s.quarter, s.clock_seconds));
  return end;
}

/**
 * Best-effort playing time per player from starting five + substitution log.
 * Games without a starting five and without subs produce no minutes (never invented).
 */
export function minutesForGame(
  game: Game,
  events: GameEvent[],
  subs: Substitution[],
): Map<string, number> {
  const out = new Map<string, number>();
  const start = new Set<string>(game.starting_five ?? []);
  if (start.size === 0 && subs.length === 0) return out;

  const ordered = [...subs].sort(
    (a, b) =>
      absoluteSeconds(game, a.quarter, a.clock_seconds) -
        absoluteSeconds(game, b.quarter, b.clock_seconds) || a.created_at.localeCompare(b.created_at),
  );
  const end = gameLengthSeconds(game, events, subs);
  const onFloor = new Set<string>(start);
  let prev = 0;
  const credit = (until: number) => {
    const delta = Math.max(0, until - prev);
    if (!delta) return;
    for (const id of onFloor) out.set(id, (out.get(id) ?? 0) + delta);
  };
  for (const s of ordered) {
    const t = Math.min(end, absoluteSeconds(game, s.quarter, s.clock_seconds));
    credit(t);
    prev = Math.max(prev, t);
    if (s.player_out) onFloor.delete(s.player_out);
    if (s.player_in) onFloor.add(s.player_in);
  }
  credit(end);
  return out;
}

/* ---------------- aggregation ---------------- */

function addShot(line: { fg: Split; two: Split; three: Split; ft: Split; rim: Split }, e: GameEvent) {
  if (isFieldGoal(e)) {
    const made = e.event_type === "MADE";
    line.fg.att++;
    if (made) line.fg.made++;
    if (isThreeAttempt(e)) {
      line.three.att++;
      if (made) line.three.made++;
    } else {
      line.two.att++;
      if (made) line.two.made++;
    }
    if (isRimAttempt(e)) {
      line.rim.att++;
      if (made) line.rim.made++;
    }
  } else if (isFreeThrow(e)) {
    line.ft.att++;
    if (e.event_type === "FT_MADE") line.ft.made++;
  }
}

export function groupByGame<T extends { game_id: string }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.game_id);
    if (list) list.push(r);
    else m.set(r.game_id, [r]);
  }
  return m;
}

/** Per-player season line across the supplied games. */
export function aggregatePlayers(
  games: Game[],
  events: GameEvent[],
  subs: Substitution[],
): Map<string, PlayerLine> {
  const lines = new Map<string, PlayerLine>();
  const get = (id: string) => {
    let l = lines.get(id);
    if (!l) {
      l = emptyPlayerLine(id);
      lines.set(id, l);
    }
    return l;
  };
  const evByGame = groupByGame(events);
  const subByGame = groupByGame(subs);

  for (const g of games) {
    const ev = evByGame.get(g.id) ?? [];
    const sb = subByGame.get(g.id) ?? [];
    const played = new Set<string>(g.starting_five ?? []);
    for (const s of sb) {
      if (s.player_in) played.add(s.player_in);
    }
    for (const e of ev) if (e.player_id) played.add(e.player_id);

    for (const id of played) get(id).games++;
    for (const id of g.starting_five ?? []) get(id).starts++;
    for (const [id, secs] of minutesForGame(g, ev, sb)) get(id).seconds += secs;

    for (const e of ev) {
      if (!e.player_id) continue;
      const l = get(e.player_id);
      if (e.event_type !== "OPP_SCORE") l.pts += e.points || 0;
      switch (e.event_type) {
        case "REBOUND":
          l.reb++;
          break;
        case "ASSIST":
          l.ast++;
          break;
        case "STEAL":
          l.stl++;
          break;
        case "BLOCK":
          l.blk++;
          break;
        case "TURNOVER":
          l.to++;
          break;
        case "FOUL":
          l.pf++;
          break;
        default:
          break;
      }
      addShot(l, e);
    }
  }
  return lines;
}

/** Whole-team season line across the supplied games. */
export function aggregateTeam(games: Game[], events: GameEvent[]): TeamLine {
  const line = emptyTeamLine();
  const evByGame = groupByGame(events);
  for (const g of games) {
    const ev = evByGame.get(g.id) ?? [];
    line.games++;
    const s = gameScore(g, ev);
    line.pts += s.team;
    line.oppPts += s.opp;
    const r = gameResult(g, ev);
    if (r === "W") line.wins++;
    else if (r === "L") line.losses++;
    else if (r === "T") line.ties++;
    for (const e of ev) {
      switch (e.event_type) {
        case "REBOUND":
          line.reb++;
          break;
        case "ASSIST":
          line.ast++;
          break;
        case "STEAL":
          line.stl++;
          break;
        case "BLOCK":
          line.blk++;
          break;
        case "TURNOVER":
          line.to++;
          break;
        case "FOUL":
          line.pf++;
          break;
        case "OPP_FOUL":
          line.oppFouls++;
          break;
        default:
          break;
      }
      addShot(line, e);
    }
  }
  return line;
}

/** One player's line for one game (box score row). */
export function playerGameLine(playerId: string, game: Game, events: GameEvent[], subs: Substitution[]) {
  const line = aggregatePlayers([game], events.filter((e) => e.game_id === game.id), subs.filter((s) => s.game_id === game.id)).get(playerId);
  return line ?? emptyPlayerLine(playerId);
}

export function sortByJersey<T extends { player: Player }>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      Number(a.player.jersey) - Number(b.player.jersey) ||
      a.player.jersey.localeCompare(b.player.jersey),
  );
}

export function seasonsOf(teams: { season: string }[]) {
  return Array.from(new Set(teams.map((t) => t.season).filter(Boolean))).sort().reverse();
}

/* ---------------- lineup / combination stats ---------------- */

/** Time slices of one game with the set of players on the floor. */
function onFloorSegments(game: Game, events: GameEvent[], subs: Substitution[]) {
  const start = new Set<string>(game.starting_five ?? []);
  const ordered = [...subs].sort(
    (a, b) =>
      absoluteSeconds(game, a.quarter, a.clock_seconds) -
        absoluteSeconds(game, b.quarter, b.clock_seconds) || a.created_at.localeCompare(b.created_at),
  );
  const end = gameLengthSeconds(game, events, subs);
  const segs: { start: number; end: number; on: Set<string> }[] = [];
  const on = new Set<string>(start);
  let prev = 0;
  for (const s of ordered) {
    const t = Math.min(end, absoluteSeconds(game, s.quarter, s.clock_seconds));
    if (t > prev) segs.push({ start: prev, end: t, on: new Set(on) });
    prev = Math.max(prev, t);
    if (s.player_out) on.delete(s.player_out);
    if (s.player_in) on.add(s.player_in);
  }
  if (end > prev) segs.push({ start: prev, end, on: new Set(on) });
  return segs;
}

export type LineupLine = {
  players: string[];
  games: number;
  seconds: number;
  pts: number;
  oppPts: number;
  reb: number;
  ast: number;
  stl: number;
  to: number;
  fg: Split;
  three: Split;
};

/**
 * How a group of players performs when they are all on the floor together.
 * Derived from the starting five + substitution log; games without that data
 * simply contribute nothing (numbers are never invented).
 */
export function lineupStats(
  games: Game[],
  events: GameEvent[],
  subs: Substitution[],
  playerIds: string[],
): LineupLine {
  const line: LineupLine = {
    players: playerIds,
    games: 0,
    seconds: 0,
    pts: 0,
    oppPts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    to: 0,
    fg: emptySplit(),
    three: emptySplit(),
  };
  if (playerIds.length === 0) return line;
  const evByGame = groupByGame(events);
  const subsByGame = groupByGame(subs);
  for (const g of games) {
    const ev = evByGame.get(g.id) ?? [];
    const sb = subsByGame.get(g.id) ?? [];
    if ((g.starting_five ?? []).length === 0 && sb.length === 0) continue;
    const segs = onFloorSegments(g, ev, sb).filter((s) => playerIds.every((p) => s.on.has(p)));
    if (segs.length === 0) continue;
    const together = segs.reduce((n, s) => n + (s.end - s.start), 0);
    if (together <= 0) continue;
    line.games++;
    line.seconds += together;
    for (const e of ev) {
      const t = absoluteSeconds(g, e.quarter, e.clock_seconds);
      if (!segs.some((s) => t >= s.start && t <= s.end)) continue;
      if (e.event_type === "OPP_SCORE") {
        line.oppPts += e.points || 0;
        continue;
      }
      line.pts += e.points || 0;
      if (e.event_type === "REBOUND") line.reb++;
      if (e.event_type === "ASSIST") line.ast++;
      if (e.event_type === "STEAL") line.stl++;
      if (e.event_type === "TURNOVER") line.to++;
      if (isFieldGoal(e)) {
        line.fg.att++;
        if (e.event_type === "MADE") line.fg.made++;
        if (isThreeAttempt(e)) {
          line.three.att++;
          if (e.event_type === "MADE") line.three.made++;
        }
      }
    }
  }
  return line;
}

/** Sum of several player lines (a selected group's combined production). */
export function sumPlayerLines(lines: PlayerLine[]): PlayerLine {
  const out = emptyPlayerLine("group");
  const addSplit = (a: Split, b: Split) => {
    a.made += b.made;
    a.att += b.att;
  };
  for (const l of lines) {
    out.games = Math.max(out.games, l.games);
    out.starts += l.starts;
    out.seconds += l.seconds;
    out.pts += l.pts;
    out.reb += l.reb;
    out.ast += l.ast;
    out.stl += l.stl;
    out.blk += l.blk;
    out.to += l.to;
    out.pf += l.pf;
    addSplit(out.fg, l.fg);
    addSplit(out.two, l.two);
    addSplit(out.three, l.three);
    addSplit(out.ft, l.ft);
    addSplit(out.rim, l.rim);
  }
  return out;
}
