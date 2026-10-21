import { describe, expect, it } from "vitest";
import { fabModeFor } from "./fabPlacement";

describe("floating CoachSide AI button placement", () => {
  it("hides during live game tracking", () => {
    expect(fabModeFor("/game/abc-123")).toBe("hidden");
  });

  it("hides on the in-game whiteboard", () => {
    expect(fabModeFor("/board")).toBe("hidden");
  });

  it("tucks against the edge in Play Maker and Drill Maker", () => {
    expect(fabModeFor("/plays/new")).toBe("edge");
    expect(fabModeFor("/plays/abc-123")).toBe("edge");
    expect(fabModeFor("/drills/new")).toBe("edge");
  });

  it("shows the full button on everyday coach pages", () => {
    for (const p of ["/dashboard", "/plays", "/drills", "/roster", "/lockerroom", "/calendar", "/stats", "/practice", "/settings", "/plays/abc-123/view"]) {
      expect(fabModeFor(p)).toBe("normal");
    }
  });
});
