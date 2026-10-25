import { describe, expect, it } from "vitest";
import { boardMarkersFromTokens, boardZoomForCamera } from "./boardStore";

describe("loading play positions onto the Timeout Board", () => {
  const tokens = [
    { label: "1", x: 0.8, y: 0.5, team: "offense" as const },
    { label: "X1", x: 0.75, y: 0.4, team: "defense" as const },
    { label: "2", x: 0.9, y: 0.2 },
  ];
  it("creates one marker per player, keeping team and label", () => {
    const out = boardMarkersFromTokens(tokens, false);
    expect(out).toHaveLength(3);
    expect(out.map((o) => o.kind === "marker" && [o.team, o.label, o.x, o.y])).toEqual([
      ["offense", "1", 0.8, 0.5],
      ["defense", "X1", 0.75, 0.4],
      ["offense", "2", 0.9, 0.2],
    ]);
  });
  it("mirrors positions like the slideshow when the play attacks the left basket", () => {
    const [first] = boardMarkersFromTokens(tokens, true);
    expect(first?.kind === "marker" && [first.x, first.y]).toEqual([0.19999999999999996, 0.5]);
  });
  it("maps every play camera onto a Board view", () => {
    expect(["right", "bottom", "left", "top", "full"].map(boardZoomForCamera)).toEqual(["right", "right", "left", "left", "full"]);
  });
});
