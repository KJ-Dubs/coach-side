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

/* ---------------- mid-game tracking history + coverage ---------------- */

export type TrackingKey = keyof TrackingConfig;

/** One append-only toggle record. Never rewritten once saved. */
export type TrackingChange = {
  category: TrackingKey;
  enabled: boolean;
  period: number;
  event_count: number;
  changed_at: string;
  changed_by?: string | null;
};

export type CoverageStatus = "full" | "partial" | "none";
export type CoverageOverride = Partial<Record<TrackingKey, { status: CoverageStatus; note?: string | null }>>;
export type Coverage = { status: CoverageStatus; periods: number[]; note: string | null; overridden: boolean };

export function normalizeHistory(raw: unknown): TrackingChange[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (h): h is TrackingChange =>
      !!h && typeof h === "object" && typeof (h as TrackingChange).category === "string" && typeof (h as TrackingChange).enabled === "boolean",
  );
}

export function normalizeOverride(raw: unknown): CoverageOverride {
  if (!raw || typeof raw !== "object") return {};
  const out: CoverageOverride = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = (v as { status?: unknown })?.status;
    if (k in FULL_TRACKING && (s === "full" || s === "partial" || s === "none")) {
      out[k as TrackingKey] = { status: s, note: ((v as { note?: unknown }).note as string) ?? null };
    }
  }
  return out;
}

/** Records for every category whose value differs between two configs. */
export function diffTracking(
  before: TrackingConfig,
  after: TrackingConfig,
  ctx: { period: number; eventCount: number; userId?: string | null },
): TrackingChange[] {
  const at = new Date().toISOString();
  return (Object.keys(after) as TrackingKey[])
    .filter((k) => before[k] !== after[k])
    .map((k) => ({ category: k, enabled: after[k], period: ctx.period, event_count: ctx.eventCount, changed_at: at, changed_by: ctx.userId ?? null }));
}

/** Effective on/off for a category: players gates every individual stat, opponent gates opp detail. */
function effectiveKeys(k: TrackingKey): TrackingKey[] {
  if (["shotLocations", "rebounds", "assists", "steals", "turnovers", "blocks", "fouls", "foulDetail"].includes(k)) return [k];
  if (["oppRebounds", "oppTurnovers"].includes(k)) return ["opponent", k];
  return [k];
}

/**
 * Which periods each category was tracked in. Toggles recorded before the
 * first event count as the starting configuration. Games without history
 * (legacy) are "full" for every category enabled in their config.
 */
export function computeCoverage(game: {
  stat_tracking_config?: unknown;
  tracking_history?: unknown;
  tracking_coverage_override?: unknown;
  periods?: number;
  quarter?: number;
}, events: { quarter: number }[] = []): Record<TrackingKey, Coverage> {
  const current = normalizeTracking(game.stat_tracking_config);
  const history = normalizeHistory(game.tracking_history);
  const override = normalizeOverride(game.tracking_coverage_override);
  const lastPeriod = Math.max(game.periods ?? 4, game.quarter ?? 1, ...events.map((e) => e.quarter || 1));
  const raw = {} as Record<TrackingKey, { on: Set<number>; full: Set<number> }>;
  for (const k of Object.keys(current) as TrackingKey[]) {
    const hist = history.filter((h) => h.category === k && h.event_count > 0);
    const pre = history.filter((h) => h.category === k && h.event_count <= 0);
    // State at tip-off: the value before the first in-game toggle, else the
    // last pre-game toggle, else the current value.
    let state = hist.length ? !hist[0]!.enabled : pre.length ? pre[pre.length - 1]!.enabled : current[k];
    const on = new Set<number>();
    const full = new Set<number>();
    for (let q = 1; q <= lastPeriod; q++) {
      const inQ = hist.filter((h) => (h.period || 1) === q);
      let anyOn = state;
      let allOn = state;
      for (const h of inQ) {
        state = h.enabled;
        if (state) anyOn = true;
        else allOn = false;
      }
      if (anyOn) on.add(q);
      if (allOn && anyOn) full.add(q);
    }
    raw[k] = { on, full };
  }
  const out = {} as Record<TrackingKey, Coverage>;
  for (const k of Object.keys(current) as TrackingKey[]) {
    const keys = effectiveKeys(k);
    const periods: number[] = [];
    let allFull = true;
    for (let q = 1; q <= lastPeriod; q++) {
      const on = keys.every((kk) => raw[kk].on.has(q));
      if (on) periods.push(q);
      if (!keys.every((kk) => raw[kk].full.has(q))) allFull = false;
    }
    const status: CoverageStatus = periods.length === 0 ? "none" : allFull ? "full" : "partial";
    const o = override[k];
    out[k] = o
      ? { status: o.status, periods: o.status === "full" ? Array.from({ length: lastPeriod }, (_, i) => i + 1) : o.status === "none" ? [] : periods, note: o.note ?? null, overridden: true }
      : { status, periods, note: null, overridden: false };
  }
  return out;
}

export function periodLabel(q: number, periods: number) {
  return q > periods ? `OT${q - periods}` : periods === 2 ? `H${q}` : `Q${q}`;
}

/** "Q1, Q3–Q4" style range text. */
export function periodRanges(list: number[], periods: number) {
  const parts: string[] = [];
  let i = 0;
  while (i < list.length) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j]! + 1) j++;
    parts.push(i === j ? periodLabel(list[i]!, periods) : `${periodLabel(list[i]!, periods)}–${periodLabel(list[j]!, periods)}`);
    i = j + 1;
  }
  return parts.join(", ");
}

export const COVERAGE_LABEL: Record<CoverageStatus, string> = { full: "Full game", partial: "Partial game", none: "Not tracked" };

/** Report-relevant categories (foulDetail/opponent master excluded from stat columns). */
export const STAT_CATEGORY_FOR: Record<string, TrackingKey> = {
  REB: "rebounds",
  AST: "assists",
  STL: "steals",
  TO: "turnovers",
  BLK: "blocks",
  PF: "fouls",
};
