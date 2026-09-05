// Court geometry helpers.
// Normalized coordinates: x 0..1 left -> right, y 0..1 top -> bottom.
// Half court is drawn in landscape: basket on the LEFT, half-line on the right.
// Court is 47ft (baseline -> half) x 50ft (sideline -> sideline).

export const HALF_W_FT = 47;
export const HALF_H_FT = 50;
export const BASKET_FT = { x: 5.25, y: 25 };
export const THREE_RADIUS_FT = 19.75; // high school arc
export const CORNER_INSET_FT = 5.25;
export const CORNER_BREAK_X_FT = 5.25; // where the arc meets the straight corner line

export type Zone =
  | "rim"
  | "paint"
  | "midrange"
  | "corner3"
  | "wing3"
  | "top3"
  | "deep3";

export function toFeet(x: number, y: number) {
  return { fx: x * HALF_W_FT, fy: y * HALF_H_FT };
}

export function distanceFt(x: number, y: number) {
  const { fx, fy } = toFeet(x, y);
  return Math.hypot(fx - BASKET_FT.x, fy - BASKET_FT.y);
}

export function isThree(x: number, y: number) {
  return distanceFt(x, y) > THREE_RADIUS_FT;
}

export function zoneOf(x: number, y: number): Zone {
  const { fx, fy } = toFeet(x, y);
  const dist = distanceFt(x, y);
  if (isThree(x, y)) {
    if (fx <= 14 && (fy <= 14 || fy >= HALF_H_FT - 14)) return "corner3";
    if (dist > 25) return "deep3";
    return Math.abs(fy - BASKET_FT.y) > 9 ? "wing3" : "top3";
  }
  if (dist <= 4.5) return "rim";
  const inPaint = fx <= 19 && Math.abs(fy - BASKET_FT.y) <= 8;
  if (inPaint) return "paint";
  return "midrange";
}

export const ZONE_LABEL: Record<Zone, string> = {
  rim: "Rim",
  paint: "Paint",
  midrange: "Mid-range",
  corner3: "Corner 3",
  wing3: "Wing 3",
  top3: "Top 3",
  deep3: "Deep 3",
};

export function shotValue(x: number, y: number) {
  return isThree(x, y) ? 3 : 2;
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
