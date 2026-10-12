import type { Team } from "./types";

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim();
  if (/^#[\da-f]{3}$/i.test(hex)) return `#${hex.slice(1).split("").map((c) => c + c).join("")}`.toUpperCase();
  return /^#[\da-f]{6}$/i.test(hex) ? hex.toUpperCase() : null;
}
function channels(hex: string) { return [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16)); }
export function luminance(hex: string): number {
  return channels(hex).map((c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
}
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function mix(hex: string, target: number, amount: number) {
  return `#${channels(hex).map((c) => Math.round(c + (target - c) * amount).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
/** Keep hue while constraining UI luminance; stored brand colors remain unchanged. */
export function safeAccent(value: string): string {
  const hex = normalizeHex(value);
  if (!hex) throw new Error("Choose a valid hex color, such as #1D4ED8");
  const light = luminance(hex);
  if (light >= 0.18 && light <= 0.38) return hex;
  const target = light < 0.18 ? 255 : 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const l = luminance(mix(hex, target, mid));
    if (target === 255 ? l < 0.22 : l > 0.32) lo = mid; else hi = mid;
  }
  return mix(hex, target, hi);
}
export function readableForeground(hex: string) { return contrast(hex, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#111111"; }
export function similarColors(a: string, b: string) {
  const x = normalizeHex(a), y = normalizeHex(b);
  return !!x && !!y && Math.sqrt(channels(x).reduce((sum, c, i) => sum + (c - (channels(y)[i] ?? 0)) ** 2, 0)) < 65;
}
export function teamThemeVariables(team: Pick<Team, "primary_color" | "secondary_color"> | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  const primary = normalizeHex(team?.primary_color), secondary = normalizeHex(team?.secondary_color);
  if (primary) {
    const color = safeAccent(primary);
    for (const key of ["grape", "primary", "ring", "sidebar-primary", "chart-1"]) vars[`--${key}`] = color;
    vars["--primary-foreground"] = readableForeground(color);
    vars["--sidebar-primary-foreground"] = readableForeground(color);
    vars["--grape-soft"] = `color-mix(in oklab, ${color} 40%, var(--background))`;
    vars["--grape-bright"] = `color-mix(in oklab, ${color} 70%, var(--foreground))`;
  }
  if (secondary) {
    const color = safeAccent(secondary);
    for (const key of ["flame", "accent", "chart-2"]) vars[`--${key}`] = color;
    vars["--accent-foreground"] = readableForeground(color);
    vars["--flame-soft"] = `color-mix(in oklab, ${color} 40%, var(--background))`;
  }
  return vars;
}

/** Only these paths opt out; this never grants access or changes active team state. */
export function teamThemeEnabled(path: string) {
  return !/^\/(auth|library|coach|kpi|launch-qa)(\/|$)/.test(path) && path !== "/";
}

export function defaultPickerColors(): [string, string] {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return ["", ""];
  const css = getComputedStyle(document.documentElement);
  return ["--coachside-grape", "--coachside-flame"].map((key) => {
    ctx.fillStyle = css.getPropertyValue(key).trim(); ctx.fillRect(0, 0, 1, 1);
    return `#${Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }) as [string, string];
}