import { describe, expect, it } from "vitest";
import {
  FULL_TRACKING,
  SCORE_ONLY_TRACKING,
  isPaidTrackingKey,
  stripPaidTracking,
  usesPaidTracking,
} from "./gameConfig";

describe("GameDay+ stat tracking rule", () => {
  it("Score only is a free game: it uses no GameDay+ category", () => {
    expect(usesPaidTracking(SCORE_ONLY_TRACKING)).toBe(false);
  });

  it("Full stats needs GameDay+", () => {
    expect(usesPaidTracking(FULL_TRACKING)).toBe(true);
  });

  it("individual player stats and shot locations are GameDay+", () => {
    expect(isPaidTrackingKey("players")).toBe(true);
    expect(isPaidTrackingKey("shotLocations")).toBe(true);
  });

  it("team fouls and the game clock stay free", () => {
    expect(isPaidTrackingKey("fouls")).toBe(false);
    expect(isPaidTrackingKey("oppFouls")).toBe(false);
    expect(isPaidTrackingKey("clock")).toBe(false);
  });

  it("stripping a free team's config keeps clock and team fouls but drops player stats", () => {
    const out = stripPaidTracking({ ...FULL_TRACKING, clock: true });
    expect(out.players).toBe(false);
    expect(out.shotLocations).toBe(false);
    expect(out.rebounds).toBe(false);
    expect(out.clock).toBe(true);
    expect(out.fouls).toBe(true);
    expect(usesPaidTracking(out)).toBe(false);
  });
});
