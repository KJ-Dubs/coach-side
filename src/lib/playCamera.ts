import type { PlayFrame } from "./types";

/** Points this close to midcourt (in normalized x) never decide the camera. */
export const MIDCOURT_TOLERANCE = 0.05;

export type AutoCamera = "full" | "left" | "right";

/** Every camera a coach can save on a play (same set as the court's views). */
export type CourtView = "right" | "left" | "top" | "bottom" | "full";

export const COURT_VIEWS: readonly CourtView[] = ["right", "left", "top", "bottom", "full"];

export function isCourtView(value: unknown): value is CourtView {
  return typeof value === "string" && (COURT_VIEWS as readonly string[]).includes(value);
}

/**
 * Which displayed halves hold meaningful geometry. Offense tokens plus every
 * authored action path across all frames, mirrored like the canvas when the
 * play attacks the left basket. Defense only counts when a play has no offense
 * geometry at all.
 */
function occupiedSides(frames: PlayFrame[] | undefined, flip: boolean) {
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
  return { left, right };
}

/**
 * Pick the presentation camera for a whole play. Camera only: it reads saved
 * geometry and never changes it. Geometry on both sides of midcourt => full.
 */
export function autoPlayZoom(frames: PlayFrame[] | undefined, flip: boolean): AutoCamera {
  const { left, right } = occupiedSides(frames, flip);
  if (left && right) return "full";
  if (right) return "right";
  if (left) return "left";
  return "full";
}

/** Which displayed half a saved half-court view shows (Top/Bottom are rotated halves). */
export function viewHalf(view: CourtView): "left" | "right" | null {
  if (view === "right" || view === "bottom") return "right";
  if (view === "left" || view === "top") return "left";
  return null;
}

/**
 * The one camera rule for slideshow and MP4 export. A play's saved view wins
 * when everything meaningful fits inside it; a half view that would hide
 * authored geometry falls back to Full Court. Plays without a saved view use
 * the automatic fit.
 */
export function playCamera(
  frames: PlayFrame[] | undefined,
  flip: boolean,
  saved: string | null | undefined,
): CourtView {
  if (!isCourtView(saved)) return autoPlayZoom(frames, flip);
  const half = viewHalf(saved);
  if (!half) return "full";
  const sides = occupiedSides(frames, flip);
  const hidden = half === "right" ? sides.left : sides.right;
  return hidden ? "full" : saved;
}
