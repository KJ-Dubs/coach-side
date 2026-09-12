/**
 * Timeout Board (coach whiteboard) state.
 * Deliberately in-memory only: the board is instant and disposable, but it
 * survives navigating away and back inside the same browser session.
 */

export type BoardPoint = { x: number; y: number };

export type BoardObject =
  | { id: string; kind: "stroke"; color: string; width: number; pts: BoardPoint[] }
  | { id: string; kind: "arrow"; color: string; width: number; from: BoardPoint; to: BoardPoint }
  | {
      id: string;
      kind: "marker";
      color: string;
      team: "offense" | "defense";
      label: string;
      x: number;
      y: number;
    };

export type BoardSnapshot = {
  objects: BoardObject[];
  redo: BoardObject[][];
  zoom: "full" | "left";
};

let snapshot: BoardSnapshot = { objects: [], redo: [], zoom: "full" };

export function readBoard(): BoardSnapshot {
  return snapshot;
}

export function writeBoard(next: BoardSnapshot) {
  snapshot = next;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Squared distance from point p to segment ab, in normalized units. */
function segDist(p: BoardPoint, a: BoardPoint, b: BoardPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Hit test used by the eraser and by marker dragging. */
export function hitTest(o: BoardObject, p: BoardPoint, tol: number) {
  if (o.kind === "marker") return Math.hypot(o.x - p.x, (o.y - p.y) * 0.53) < tol * 1.6;
  if (o.kind === "arrow") return segDist(p, o.from, o.to) < tol;
  for (let i = 1; i < o.pts.length; i += 1) {
    if (segDist(p, o.pts[i - 1]!, o.pts[i]!) < tol) return true;
  }
  return o.pts.length === 1 && !!o.pts[0] && Math.hypot(o.pts[0].x - p.x, o.pts[0].y - p.y) < tol;
}
