/**
 * Per-game stat tracking toggles and league rules. Stored as JSON on games
 * (stat_tracking_config / rules_config); NULL means the original full tracker.
 */
import type { GameEvent } from "@/lib/types";

export type TrackingConfig = {
  players: boolean;
  shotLocations: boolean;
  rebounds: boolean;
  assists: boolean;
  steals: boolean;
  turnovers: boolean;
  blocks: boolean;
  fouls: boolean;
  foulDetail: boolean;
  opponent: boolean;
  oppRebounds: boolean;
  oppTurnovers: boolean;
  oppFouls: boolean;
};

export const FULL_TRACKING: TrackingConfig = {
  players: true,
  shotLocations: true,
  rebounds: true,
  assists: true,
  steals: true,
  turnovers: true,
  blocks: true,
  fouls: true,
  foulDetail: true,
  opponent: true,
  oppRebounds: true,
  oppTurnovers: true,
  oppFouls: true,
};

export const SCORE_ONLY_TRACKING: TrackingConfig = {
  players: false,
  shotLocations: false,
  rebounds: false,
  assists: false,
  steals: false,
  turnovers: false,
  blocks: false,
  fouls: true,
  foulDetail: false,
  opponent: false,
  oppRebounds: false,
  oppTurnovers: false,
  oppFouls: true,
};

export const TRACKING_LABELS: { key: keyof TrackingConfig; label: string; group: "us" | "opp" }[] = [
  { key: "players", label: "Individual player stats", group: "us" },
  { key: "shotLocations", label: "Shot locations", group: "us" },
  { key: "rebounds", label: "Rebounds", group: "us" },
  { key: "assists", label: "Assists", group: "us" },
  { key: "steals", label: "Steals", group: "us" },
  { key: "turnovers", label: "Turnovers", group: "us" },
  { key: "blocks", label: "Blocks", group: "us" },
  { key: "fouls", label: "Fouls", group: "us" },
  { key: "foulDetail", label: "Foul type / detail", group: "us" },
  { key: "opponent", label: "Opponent stats", group: "opp" },
  { key: "oppRebounds", label: "Opponent rebounds", group: "opp" },
  { key: "oppTurnovers", label: "Opponent turnovers", group: "opp" },
  { key: "oppFouls", label: "Opponent fouls", group: "opp" },
];

export type BonusRule =
  | { mode: "none" }
  | { mode: "quarter"; bonus: number | null; double: number | null }
  | { mode: "half"; bonus: number | null; double: number | null };

export type RulesConfig = {
  foulLimit: number | null; // null = no limit
  bonus: BonusRule;
  timeoutsFull: number;
  timeouts30: number;
};

export const DEFAULT_RULES: RulesConfig = {
  foulLimit: 5,
  bonus: { mode: "half", bonus: 7, double: 10 },
  timeoutsFull: 0,
  timeouts30: 0,
};

export const BONUS_PRESETS: { key: string; label: string; rule: BonusRule }[] = [
  { key: "nfhs", label: "HS · 7 / 10 per half", rule: { mode: "half", bonus: 7, double: 10 } },
  { key: "q5", label: "5 per quarter = double", rule: { mode: "quarter", bonus: null, double: 5 } },
  { key: "none", label: "No bonus tracking", rule: { mode: "none" } },
];

export function normalizeTracking(raw: unknown): TrackingConfig {
  if (!raw || typeof raw !== "object") return { ...FULL_TRACKING };
  const r = raw as Record<string, unknown>;
  const out = { ...FULL_TRACKING };
  for (const k of Object.keys(out) as (keyof TrackingConfig)[]) {
    if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  }
  return out;
}

const n = (v: unknown, d: number | null) =>
  v === null ? null : typeof v === "number" && Number.isFinite(v) ? v : d;

export function normalizeRules(raw: unknown): RulesConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RULES };
  const r = raw as Record<string, unknown>;
  const b = (r["bonus"] ?? {}) as Record<string, unknown>;
  let bonus: BonusRule = DEFAULT_RULES.bonus;
  if (b["mode"] === "none") bonus = { mode: "none" };
  else if (b["mode"] === "quarter" || b["mode"] === "half")
    bonus = { mode: b["mode"], bonus: n(b["bonus"], null), double: n(b["double"], null) };
  return {
    foulLimit: "foulLimit" in r ? n(r["foulLimit"], 5) : 5,
    bonus,
    timeoutsFull: Math.max(0, Math.min(5, Number(r["timeoutsFull"] ?? 0) || 0)),
    timeouts30: Math.max(0, Math.min(5, Number(r["timeouts30"] ?? 0) || 0)),
  };
}

/** Quarters that share one foul count with the given period (OT joins the 2nd half). */
export function foulWindow(rule: BonusRule, quarter: number, periods: number): (q: number) => boolean {
  if (rule.mode === "half") {
    if (periods === 2) return (q) => (quarter >= 2 ? q >= 2 : q === quarter);
    const secondHalf = quarter >= 3;
    return (q) => (secondHalf ? q >= 3 : q <= 2);
  }
  return (q) => q === quarter;
}

export function countFouls(events: GameEvent[], type: "FOUL" | "OPP_FOUL", inWindow: (q: number) => boolean) {
  return events.filter((e) => e.event_type === type && inWindow(e.quarter)).length;
}

/** Status earned by the OTHER team when this team's fouls reach the thresholds. */
export function bonusLabel(rule: BonusRule, fouls: number): string | null {
  if (rule.mode === "none") return null;
  if (rule.double != null && fouls >= rule.double) return "DOUBLE BONUS";
  if (rule.bonus != null && fouls >= rule.bonus) return rule.mode === "half" ? "1 & 1" : "BONUS";
  return null;
}
