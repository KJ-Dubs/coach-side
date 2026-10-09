import type { CourtZoom } from "../components/court/Court";
import type { PlayToken } from "./types";

/** Initial placement only: all positions remain normalized full-court coordinates. */
export function addHalfCourtDefense(
  tokens: PlayToken[],
  view: CourtZoom,
  flip: boolean,
  makeId: () => string,
  visibleTokens: PlayToken[] = tokens,
): PlayToken[] {
  // Preserve even partially populated legacy defenses, including object identity.
  if (tokens.some((token) => token.team === "defense")) return tokens;

  let displayRight = view === "right" || view === "bottom";
  if (view === "full") {
    let right = 0;
    let left = 0;
    for (const token of visibleTokens) {
      if (token.team === "defense" || !Number.isFinite(token.x)) continue;
      const x = flip ? 1 - token.x : token.x;
      if (x > 0.5) right += 1;
      if (x < 0.5) left += 1;
    }
    // Logical attack basket is right; the display flip presents it on the left.
    displayRight = right === left ? !flip : right > left;
  }

  const shell = [
    { x: 0.61, y: 0.5 }, // ball pressure
    { x: 0.70, y: 0.24 }, // wings
    { x: 0.70, y: 0.76 },
    { x: 0.83, y: 0.36 }, // lane help
    { x: 0.83, y: 0.64 },
  ];
  const defenders = shell.map((spot, i): PlayToken => {
    const displayX = displayRight ? spot.x : 1 - spot.x;
    return {
      id: makeId(),
      label: String(i + 1),
      x: flip ? 1 - displayX : displayX,
      y: flip ? 1 - spot.y : spot.y,
      ball: false,
      team: "defense",
    };
  });
  return [...tokens, ...defenders];
}