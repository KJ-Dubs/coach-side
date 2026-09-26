import { describe, expect, it } from "vitest";
import { aggregatePlayers, eventPoints, opponentLine, scoreFromEvents } from "./stats";
import type { Game, GameEvent } from "./types";

let n = 0;
const ev = (p: Partial<GameEvent> & { event_type: string }): GameEvent => ({
  id: `e${++n}`,
  game_id: "g",
  quarter: 1,
  clock_seconds: 400,
  player_id: null,
  x: null,
  y: null,
  result: null,
  points: 0,
  zone: null,
  current_lineup: [],
  related_event_id: null,
  context: {},
  created_at: new Date(Date.now() + n).toISOString(),
  ...p,
});
const game: Game = {
  id: "g", team_id: "t", opponent: "O", game_date: "", periods: 4, period_minutes: 8,
  status: "live", team_score: 0, opp_score: 0, quarter: 1, clock_seconds: 480, starting_five: [],
};
const P24 = "p24";
const underLeft = { x: 0.1, y: 0.5 };
const underFar = { x: 1.89, y: 0.5 }; // the far basket in full-court view
const deep = { x: 0.7, y: 0.5 };

describe("canonical scoring", () => {
  it("A: two 2s under the basket + two FTs = 6", () => {
    const events = [
      ev({ event_type: "MADE", player_id: P24, ...underLeft, points: 2 }),
      ev({ event_type: "MADE", player_id: P24, ...underFar, points: 3 }), // legacy bad row
      ev({ event_type: "FT_MADE", player_id: P24, points: 1 }),
      ev({ event_type: "FT_MADE", player_id: P24, points: 1 }),
    ];
    expect(scoreFromEvents(events)).toEqual({ team: 6, opp: 0 });
    expect(aggregatePlayers([game], events, []).get(P24)?.pts).toBe(6);
  });
  it("3pt make and FT make values", () => {
    expect(eventPoints(ev({ event_type: "MADE", ...deep }))).toBe(3);
    expect(eventPoints(ev({ event_type: "FT_MADE" }))).toBe(1);
    expect(eventPoints(ev({ event_type: "MISS", ...deep }))).toBe(0);
  });
  it("B: rapid back-to-back events all count", () => {
    const events = Array.from({ length: 10 }, () => ev({ event_type: "MADE", player_id: P24, ...underLeft }));
    expect(new Set(events.map((e) => e.id)).size).toBe(10);
    expect(scoreFromEvents(events).team).toBe(20);
  });
  it("C: opp miss + OREB", () => {
    const o = opponentLine([
      ev({ event_type: "OPP_MISS", ...underLeft }),
      ev({ event_type: "OPP_REBOUND", result: "OFF" }),
    ]);
    expect(o).toMatchObject({ pts: 0, oreb: 1, fg: { made: 0, att: 1 } });
  });
  it("D/E: opp 3 + FTs", () => {
    const events = [
      ev({ event_type: "OPP_MADE", ...deep, points: 3 }),
      ev({ event_type: "OPP_FT_MADE", points: 1 }),
      ev({ event_type: "OPP_FT_MISS" }),
    ];
    expect(scoreFromEvents(events)).toEqual({ team: 0, opp: 4 });
    expect(opponentLine(events).ft).toEqual({ made: 1, att: 2 });
  });
  it("F/G: edit, delete and undo recalculate", () => {
    let events = [ev({ event_type: "MADE", player_id: P24, ...underLeft, points: 2 }), ev({ event_type: "FT_MADE", player_id: P24, points: 1 })];
    events = events.map((e, i) => (i === 0 ? { ...e, event_type: "MISS", points: 0 } : e));
    expect(scoreFromEvents(events).team).toBe(1);
    events = events.slice(0, -1); // undo last / delete
    expect(scoreFromEvents(events).team).toBe(0);
    expect(aggregatePlayers([game], events, []).get(P24)?.fg).toEqual({ made: 0, att: 1 });
  });
  it("legacy OPP_SCORE still loads", () => {
    expect(scoreFromEvents([ev({ event_type: "OPP_SCORE", points: 2 })]).opp).toBe(2);
  });
  it("explicit shot-value override wins", () => {
    expect(eventPoints(ev({ event_type: "MADE", ...underLeft, context: { shot_value: 3 } }))).toBe(3);
  });
});
