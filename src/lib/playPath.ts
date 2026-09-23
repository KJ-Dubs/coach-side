// Shared play-path geometry. Normalized coords (0..1) everywhere on the way in
// and out; curve math happens in the 940x500 court pixel space so shapes are
// not distorted by the court aspect ratio.

export type Point = { x: number; y: number };

export const PW = 940;
export const PH = 500;

export const toPx = (p: Point): Point => ({ x: p.x * PW, y: p.y * PH });
export const toNorm = (p: Point): Point => ({ x: p.x / PW, y: p.y / PH });

/** Curl (curved) geometry in pixel space. */
export function curlGeom(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = Math.min(120, len * 0.45);
  const c1 = { x: a.x + dx * 0.25 + nx * bend, y: a.y + dy * 0.25 + ny * bend };
  const c2 = { x: a.x + dx * 0.8 + nx * bend * 0.55, y: a.y + dy * 0.8 + ny * bend * 0.55 };
  return {
    c1,
    c2,
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`,
    angle: Math.atan2(b.y - c2.y, b.x - c2.x),
    mid: {
      x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
      y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
    },
  };
}

export function bezierAt(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * a.x + w1 * c1.x + w2 * c2.x + w3 * b.x,
    y: w0 * a.y + w1 * c1.y + w2 * c2.y + w3 * b.y,
  };
}

/** Basketball-diagram dribble squiggle that follows the full drawn polyline. */
export function dribbleD(path: Point[]) {
  if (path.length < 2) return "";
  const total = pathLength(path);
  if (total === 0) return polyD(path);
  const waves = Math.max(2, Math.round(total / 28));
  const samples = waves * 4;
  const amplitude = Math.min(11, Math.max(6, total / 18));
  const waved: Point[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const center = getPointAlongPath(path, progress);
    const before = getPointAlongPath(path, Math.max(0, progress - 0.004));
    const after = getPointAlongPath(path, Math.min(1, progress + 0.004));
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = Math.sin(progress * waves * Math.PI * 2) * amplitude;
    waved.push({ x: center.x + (-dy / length) * offset, y: center.y + (dx / length) * offset });
  }
  return polyD(waved);
}

/** Smooth polyline path string (pixel space) for freehand drawn lines. */
export function polyD(pts: Point[]) {
  if (pts.length < 2) return "";
  const first = pts[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const n = pts[i + 1]!;
    d += ` Q ${p.x} ${p.y} ${(p.x + n.x) / 2} ${(p.y + n.y) / 2}`;
  }
  const last = pts[pts.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function pathLength(path: Point[]) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Distance-based interpolation along an arbitrary polyline.
 * progress 0 = start of the drawn line, 1 = end of the drawn line.
 */
export function getPointAlongPath(path: Point[], progress: number): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  const first = path[0]!;
  if (path.length === 1) return { ...first };
  const t = Math.min(1, Math.max(0, progress));
  const total = pathLength(path);
  if (total === 0) return { ...first };
  let target = total * t;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    if (target <= seg) {
      const k = target / seg;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    target -= seg;
  }
  return { ...path[path.length - 1]! };
}

/**
 * The polyline actually used for animation. Freehand drawings are used
 * verbatim; legacy two-point curls are expanded into their drawn curve.
 */
export function resolvePath(action: { type: string; points: Point[] }): Point[] {
  const pts = action.points ?? [];
  if (pts.length > 2) return pts;
  if (pts.length < 2) return pts;
  const a = pts[0]!;
  const b = pts[1]!;
  if (action.type !== "curl") return [a, b];
  const pa = toPx(a);
  const pb = toPx(b);
  const g = curlGeom(pa, pb);
  const out: Point[] = [];
  for (let i = 0; i <= 24; i++) out.push(toNorm(bezierAt(pa, g.c1, g.c2, pb, i / 24)));
  return out;
}

/** Simplify a freehand stroke so stored paths stay small but keep their shape. */
export function simplifyPath(pts: Point[], tolerance = 0.006): Point[] {
  if (pts.length <= 2) return pts;
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(p.x - last.x, p.y - last.y) >= tolerance) out.push(p);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
