import { describe, expect, it } from "vitest";
import { autoPlayZoom, playCamera } from "./playCamera";
import type { PlayAction, PlayFrame, PlayToken } from "./types";

const tok = (x: number, team: "offense" | "defense" = "offense"): PlayToken => ({
  id: `${team}-${x}`,
  label: "1",
  x,
  y: 0.5,
  ball: false,
  team,
});
const act = (...xs: number[]): PlayAction => ({
  id: `a-${xs.join("-")}`,
  type: "cut",
  seq: 1,
  points: xs.map((x) => ({ x, y: 0.5 })),
});
const frame = (tokens: PlayToken[], actions: PlayAction[] = [], idx = 0): PlayFrame => ({
  id: `f${idx}`,
  play_id: "p",
  idx,
  tokens,
  actions,
  note: null,
});

describe("autoPlayZoom", () => {
  it("zooms right when all offense and actions are on the right half", () => {
    expect(autoPlayZoom([frame([tok(0.7), tok(0.85)], [act(0.7, 0.9)])], false)).toBe("right");
  });

  it("zooms left when all offense and actions are on the left half", () => {
    expect(autoPlayZoom([frame([tok(0.2), tok(0.1)], [act(0.3, 0.05)])], false)).toBe("left");
  });

  it("mirrors the side when the play attacks the left basket", () => {
    expect(autoPlayZoom([frame([tok(0.7), tok(0.85)])], true)).toBe("left");
  });

  it("keeps full court when an action crosses midcourt", () => {
    expect(autoPlayZoom([frame([tok(0.3)], [act(0.3, 0.8)])], false)).toBe("full");
  });

  it("keeps full court when later frames use the other half", () => {
    expect(
      autoPlayZoom([frame([tok(0.2)], [], 0), frame([tok(0.8)], [], 1)], false),
    ).toBe("full");
  });

  it("ignores players standing near midcourt", () => {
    expect(autoPlayZoom([frame([tok(0.48), tok(0.8)])], false)).toBe("right");
  });

  it("does not let defenders alone force full court", () => {
    expect(autoPlayZoom([frame([tok(0.8), tok(0.2, "defense")])], false)).toBe("right");
  });

  it("stays full court for an empty play", () => {
    expect(autoPlayZoom([], false)).toBe("full");
  });
});

describe("playCamera (saved per-play court view)", () => {
  const rightPlay = [frame([tok(0.7), tok(0.85)], [act(0.7, 0.9)])];
  const leftPlay = [frame([tok(0.2), tok(0.3)], [act(0.3, 0.1)])];
  const fullCourt = [frame([tok(0.2)], [act(0.2, 0.8)])];

  it("A: saved Right shows the right half", () => {
    expect(playCamera(rightPlay, false, "right")).toBe("right");
  });
  it("B: saved Left shows the left half", () => {
    expect(playCamera(leftPlay, false, "left")).toBe("left");
  });
  it("C: Top is the rotated left half and Bottom the rotated right half", () => {
    expect(playCamera(leftPlay, false, "top")).toBe("top");
    expect(playCamera(rightPlay, false, "bottom")).toBe("bottom");
  });
  it("D: saved Full shows the full court", () => {
    expect(playCamera(rightPlay, false, "full")).toBe("full");
  });
  it("E: a true full-court action is never cropped by an old half preference", () => {
    for (const view of ["right", "left", "top", "bottom"] as const) {
      expect(playCamera(fullCourt, false, view)).toBe("full");
    }
  });
  it("never shows an empty half when the play lives on the other side", () => {
    expect(playCamera(leftPlay, false, "right")).toBe("full");
    expect(playCamera(rightPlay, false, "top")).toBe("full");
  });
  it("applies the attack-basket flip before deciding", () => {
    // Authored right, attacking left => displayed on the left half.
    expect(playCamera(rightPlay, true, "left")).toBe("left");
    expect(playCamera(rightPlay, true, "right")).toBe("full");
  });
  it("F: plays without a saved view keep the automatic fit", () => {
    expect(playCamera(rightPlay, false, null)).toBe("right");
    expect(playCamera(leftPlay, false, undefined)).toBe("left");
    expect(playCamera(fullCourt, false, "sideways")).toBe("full");
    expect(playCamera([], false, null)).toBe("full");
  });
});
