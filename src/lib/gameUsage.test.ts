import { describe, expect, it } from "vitest";
import { FULL_TRACKING, SCORE_ONLY_TRACKING } from "./gameConfig";
import { buildTimeline, summarizeGameUsage, trackingMode } from "./gameUsage";
import type { Game, GameEvent, Substitution } from "./types";

const game = (over: Partial<Game> = {}): Game => ({
  id: "g1",
  team_id: "t1",
  opponent: "Central Catholic",
  game_date: "2026-10-23",
  periods: 4,
  period_minutes: 8,
  status: "live",
  team_score: 0,
  opp_score: 0,
  quarter: 1,
  clock_seconds: 480,
  starting_five: [],
  ...over,
});

let n = 0;
const ev = (event_type: string, over: Partial<GameEvent> = {}): GameEvent => ({
  id: `e${++n}`,
  game_id: "g1",
  quarter: 1,
  clock_seconds: 400,
  player_id: "p12",
  x: null,
  y: null,
  event_type,
  result: null,
  points: 0,
  zone: null,
  current_lineup: [],
  related_event_id: null,
  context: {},
  created_at: `2026-10-23T18:00:${String(n).padStart(2, "0")}Z`,
  ...over,
});

describe("Game Usage Inspector mode", () => {
  it("a game with no saved tracking settings is the full tracker", () => {
    expect(trackingMode(null)).toBe("full");
  });
  it("Score only settings read as Scoreboard only", () => {
    expect(trackingMode(SCORE_ONLY_TRACKING)).toBe("scoreboard");
  });
  it("player stats on but shot locations and opponent off is Custom", () => {
    expect(trackingMode({ ...FULL_TRACKING, shotLocations: false, opponent: false })).toBe("custom");
  });
});

describe("untracked categories are never shown as zero", () => {
  it("rebounds switched off with no rebounds reads Not tracked (null)", () => {
    const s = summarizeGameUsage(game({ stat_tracking_config: { ...FULL_TRACKING, rebounds: false } }), [], []);
    expect(s.rebounds).toBeNull();
  });
  it("rebounds switched on with no rebounds reads 0", () => {
    const s = summarizeGameUsage(game({ stat_tracking_config: FULL_TRACKING }), [], []);
    expect(s.rebounds).toBe(0);
  });
  it("a scoreboard-only game reports no substitutions tracking and no court locations", () => {
    const s = summarizeGameUsage(game({ stat_tracking_config: SCORE_ONLY_TRACKING }), [ev("MADE", { player_id: null })], []);
    expect(s.substitutions).toBeNull();
    expect(s.diagnostics.courtLocationsUsed).toBe(false);
  });
});

describe("post-game corrections", () => {
  it("counts edited, added and logged deleted stats separately", () => {
    const events = [
      ev("MADE", { context: { postgame_edited_at: "2026-10-24T00:00:00Z" } }),
      ev("REBOUND", { context: { postgame: true, postgame_edited_at: "2026-10-24T00:00:00Z" } }),
    ];
    const s = summarizeGameUsage(game({ status: "final" }), events, [], { edited: 0, added: 0, deleted: 2 });
    expect(s.postGame).toEqual({ edited: 1, added: 1, deleted: 2, total: 4 });
  });
});

describe("timeline", () => {
  it("with the clock off, labels use period and entry order, not invented times", () => {
    const t = buildTimeline(game({ stat_tracking_config: { ...FULL_TRACKING, clock: false } }), [ev("MADE", { x: 0.2, y: 0.5 })], [], [{ id: "p12", jersey: "12" }]);
    expect(t[0]!.label).toBe("Q1 · #1");
  });
  it("with the clock on, labels show period and game clock", () => {
    const t = buildTimeline(game({ stat_tracking_config: { ...FULL_TRACKING, clock: true } }), [ev("FT_MADE", { clock_seconds: 432 })], [], [{ id: "p12", jersey: "12" }]);
    expect(t[0]!.label).toBe("Q1 7:12");
    expect(t[0]!.team).toBe(1);
  });
  it("substitutions read as in / out with jerseys", () => {
    const sub: Substitution = { id: "s1", game_id: "g1", quarter: 1, clock_seconds: 390, player_in: "p5", player_out: "p21", lineup_after: [], created_at: "2026-10-23T18:01:00Z" };
    const t = buildTimeline(game(), [], [sub], [{ id: "p5", jersey: "5" }, { id: "p21", jersey: "21" }]);
    expect(t[0]!.text).toBe("Sub: #5 in / #21 out");
  });
});
