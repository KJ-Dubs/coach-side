import type { PlayFrame } from "./types";

/** Points this close to midcourt (in normalized x) never decide the camera. */
export const MIDCOURT_TOLERANCE = 0.05;

export type AutoCamera = "full" | "left" | "right";

/**
 * Pick the presentation camera for a whole play. Camera only: it reads saved
 * geometry and never changes it.
 *
 * Uses offense tokens plus every authored action path across all frames,
 * mirrored like the canvas when the play attacks the left basket, so the choice
 * matches what the coach actually sees. Defense only counts when a play has no
 * offense geometry at all. Geometry on both sides of midcourt => full court.
 */
export function autoPlayZoom(frames: PlayFrame[] | undefined, flip: boolean): AutoCamera {
  const xs: number[] = [];
  const defenseXs: number[] = [];
  for (const f of frames ?? []) {
    for (const t of f.tokens ?? []) {
      if ((t.team ?? "offense") === "offense") xs.push(t.x);
      else defenseXs.push(t.x);
    }
    for (const a of f.actions ?? []) for (const p of a.points ?? []) xs.push(p.x);
  }
  const source = xs.length ? xs : defenseXs;
  let left = false;
  let right = false;
  for (const raw of source) {
    if (!Number.isFinite(raw)) continue;
    const x = flip ? 1 - raw : raw;
    if (x < 0.5 - MIDCOURT_TOLERANCE) left = true;
    else if (x > 0.5 + MIDCOURT_TOLERANCE) right = true;
  }
  if (left && right) return "full";
  if (right) return "right";
  if (left) return "left";
  return "full";
}
