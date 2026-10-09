/**
 * Live Tracking Settings: edit per-game stat toggles and league rules mid-game.
 * Applies immediately; the caller appends history so reports stay honest.
 */
import { useState } from "react";
import { BubbleButton, Label } from "@/components/Bubbles";
import { Sheet } from "@/components/game/LiveTileEditor";
import {
  BONUS_PRESETS,
  TRACKING_LABELS,
  type RulesConfig,
  type TrackingConfig,
  type TrackingKey,
} from "@/lib/gameConfig";
import { cn } from "@/lib/utils";

/** Turning these off loses data coaches usually care about — ask once. */
const CONFIRM_OFF: TrackingKey[] = ["players", "shotLocations", "rebounds", "assists", "opponent"];

export function TrackingSettingsSheet({
  tracking,
  rules,
  onTracking,
  onRules,
  onClose,
}: {
  tracking: TrackingConfig;
  rules: RulesConfig;
  onTracking: (next: TrackingConfig) => void;
  onRules: (next: RulesConfig) => void;
  onClose: () => void;
}) {
  const [confirmKey, setConfirmKey] = useState<TrackingKey | null>(null);
  const set = (k: TrackingKey, v: boolean) => {
    setConfirmKey(null);
    onTracking({ ...tracking, [k]: v });
  };
  const tap = (k: TrackingKey) => {
    if (tracking[k] && CONFIRM_OFF.includes(k) && confirmKey !== k) return setConfirmKey(k);
    set(k, !tracking[k]);
  };
  const bonusKey = BONUS_PRESETS.find((p) => JSON.stringify(p.rule) === JSON.stringify(rules.bonus))?.key ?? null;
  const step = (v: number, d: number, min: number, max: number) => Math.max(min, Math.min(max, v + d));

  return (
    <Sheet title="Live Tracking Settings" onClose={onClose}>
      <Label>Track stats</Label>
      <div className="flex flex-col gap-1">
        {TRACKING_LABELS.map(({ key, label, group }) => {
          const disabled = (group === "opp" && key !== "opponent" && key !== "oppFouls" && !tracking.opponent);
          const label2 = TRACKING_LABELS.find((t) => t.key === key)?.label ?? label;
          return (
            <div key={key} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => tap(key)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-2 rounded-2xl border px-3 text-left text-sm font-bold",
                  tracking[key] ? "border-grape/60 bg-grape/20" : "border-border bg-surface-2/60 text-muted-foreground",
                  disabled && "opacity-40",
                )}
                aria-pressed={tracking[key]}
              >
                <span className="truncate">{label2}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-black", tracking[key] ? "bg-grape text-primary-foreground" : "bg-surface-2")}>{tracking[key] ? "ON" : "OFF"}</span>
              </button>
              {confirmKey === key ? (
                <div className="flex items-center gap-2 rounded-2xl border border-flame/50 bg-flame/10 p-2 text-xs">
                  <span className="min-w-0 flex-1">Existing {label2.toLowerCase()} stay. New ones won't be recorded.</span>
                  <BubbleButton size="sm" tone="ghost" className="min-h-11" onClick={() => setConfirmKey(null)}>Keep</BubbleButton>
                  <BubbleButton size="sm" tone="flame" className="min-h-11" onClick={() => set(key, false)}>Turn Off</BubbleButton>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Label>Game rules</Label>
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-border bg-surface-2/60 px-3 text-sm font-bold">
        <span>Player foul limit</span>
        <div className="flex items-center gap-1">
          <BubbleButton size="sm" tone="ghost" className="h-11 w-11 px-0" aria-label="Lower foul limit" onClick={() => onRules({ ...rules, foulLimit: rules.foulLimit == null ? 6 : step(rules.foulLimit, -1, 1, 10) })}>−</BubbleButton>
          <span className="w-12 rounded-full bg-surface px-2 py-1 text-center">{rules.foulLimit ?? "None"}</span>
          <BubbleButton size="sm" tone="ghost" className="h-11 w-11 px-0" aria-label="Raise foul limit" onClick={() => onRules({ ...rules, foulLimit: rules.foulLimit == null ? 5 : step(rules.foulLimit, 1, 1, 10) })}>+</BubbleButton>
          <BubbleButton size="sm" tone={rules.foulLimit == null ? "grape" : "ghost"} className="min-h-11 px-2 text-xs" onClick={() => onRules({ ...rules, foulLimit: rules.foulLimit == null ? 5 : null })}>No limit</BubbleButton>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {BONUS_PRESETS.map((p) => (
          <BubbleButton key={p.key} size="sm" tone={bonusKey === p.key ? "grape" : "neutral"} className="min-h-11 text-xs" onClick={() => onRules({ ...rules, bonus: p.rule })}>{p.label}</BubbleButton>
        ))}
      </div>
      {(["timeoutsFull", "timeouts30"] as const).map((k) => (
        <div key={k} className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-border bg-surface-2/60 px-3 text-sm font-bold">
          <span>{k === "timeoutsFull" ? "Full timeouts" : "30s timeouts"}</span>
          <div className="flex items-center gap-1">
            <BubbleButton size="sm" tone="ghost" className="h-11 w-11 px-0" aria-label="Fewer" onClick={() => onRules({ ...rules, [k]: step(rules[k], -1, 0, 5) })}>−</BubbleButton>
            <span className="w-8 rounded-full bg-surface px-2 py-1 text-center">{rules[k]}</span>
            <BubbleButton size="sm" tone="ghost" className="h-11 w-11 px-0" aria-label="More" onClick={() => onRules({ ...rules, [k]: step(rules[k], 1, 0, 5) })}>+</BubbleButton>
          </div>
        </div>
      ))}
      <BubbleButton tone="grape" className="min-h-12" onClick={onClose}>Done</BubbleButton>
    </Sheet>
  );
}
