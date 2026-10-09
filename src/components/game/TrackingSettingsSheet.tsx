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
  clockDefaults,
  onClockSetup,
}: {
  clockDefaults: { periodMinutes: number; otMinutes: number; clockSeconds: number; isOvertime: boolean };
  onClockSetup: (v: { periodMinutes: number; otMinutes: number; clockSeconds: number }) => void;
  tracking: TrackingConfig;
  rules: RulesConfig;
  onTracking: (next: TrackingConfig) => void;
  onRules: (next: RulesConfig) => void;
  onClose: () => void;
}) {
  const [confirmKey, setConfirmKey] = useState<TrackingKey | null>(null);
  const [clockSetup, setClockSetup] = useState(false);
  const [pm, setPm] = useState(String(clockDefaults.periodMinutes));
  const [om, setOm] = useState(String(clockDefaults.otMinutes));
  const [mm, setMm] = useState(String(Math.floor((clockDefaults.isOvertime ? clockDefaults.otMinutes : clockDefaults.periodMinutes))));
  const [ss, setSs] = useState("00");
  const pmN = Number(pm), omN = Number(om), mmN = Number(mm), ssN = Number(ss);
  const clockValid = pmN >= 1 && pmN <= 30 && omN >= 1 && omN <= 15 && Number.isInteger(mmN) && mmN >= 0 && mmN <= 30 && Number.isInteger(ssN) && ssN >= 0 && ssN <= 59;
  const set = (k: TrackingKey, v: boolean) => {
    setConfirmKey(null);
    onTracking({ ...tracking, [k]: v });
  };
  const tap = (k: TrackingKey) => {
    if (k === "clock" && !tracking.clock) return setClockSetup((v) => !v);
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
              {key === "clock" && clockSetup ? (
                <div className="flex flex-col gap-1.5 rounded-2xl border border-grape/50 bg-grape/10 p-2 text-xs font-bold">
                  <span>Clock starts now — earlier events keep no time. Set the time left on the clock.</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex flex-col gap-0.5">Period length (min)<input inputMode="numeric" value={pm} onChange={(e) => setPm(e.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm" /></label>
                    <label className="flex flex-col gap-0.5">Overtime length (min)<input inputMode="numeric" value={om} onChange={(e) => setOm(e.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm" /></label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="flex-1">Time left now</span>
                    <input aria-label="Minutes" inputMode="numeric" value={mm} onChange={(e) => setMm(e.target.value)} className="min-h-11 w-14 rounded-xl border border-border bg-background px-2 text-center text-sm" />
                    <span>:</span>
                    <input aria-label="Seconds" inputMode="numeric" value={ss} onChange={(e) => setSs(e.target.value)} className="min-h-11 w-14 rounded-xl border border-border bg-background px-2 text-center text-sm" />
                  </div>
                  <BubbleButton size="sm" tone="grape" className="min-h-11" disabled={!clockValid} onClick={() => {
                    onClockSetup({ periodMinutes: pmN, otMinutes: omN, clockSeconds: mmN * 60 + ssN });
                    setClockSetup(false);
                    set("clock", true);
                  }}>Start tracking clock</BubbleButton>
                </div>
              ) : null}
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

/** Edit the current period's clock only; past event times are never rewritten. */
export function ClockEditor({ seconds, onSave, onClose }: { seconds: number; onSave: (s: number) => void; onClose: () => void }) {
  const [mm, setMm] = useState(String(Math.floor(seconds / 60)));
  const [ss, setSs] = useState(String(seconds % 60).padStart(2, "0"));
  const m = Number(mm), s = Number(ss);
  const valid = mm !== "" && ss !== "" && Number.isInteger(m) && m >= 0 && m <= 99 && Number.isInteger(s) && s >= 0 && s <= 59;
  return (
    <Sheet title="Edit game clock" onClose={onClose}>
      <div className="flex justify-center"><Label>Current: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Label></div>
      <div className="flex items-center justify-center gap-2">
        <input aria-label="Minutes" inputMode="numeric" value={mm} onChange={(e) => setMm(e.target.value.replace(/\D/g, "").slice(0, 2))} className="min-h-12 w-20 rounded-2xl border border-border bg-background text-center text-2xl font-black" />
        <span className="rounded-full bg-surface-2 px-2 text-2xl font-black">:</span>
        <input aria-label="Seconds" inputMode="numeric" value={ss} onChange={(e) => setSs(e.target.value.replace(/\D/g, "").slice(0, 2))} className="min-h-12 w-20 rounded-2xl border border-border bg-background text-center text-2xl font-black" />
      </div>
      {!valid ? <div className="rounded-2xl border border-flame/50 bg-flame/10 px-3 py-2 text-center text-xs font-bold">Seconds must be 00–59</div> : null}
      <BubbleButton tone="grape" className="min-h-12" disabled={!valid} onClick={() => onSave(m * 60 + s)}>Save</BubbleButton>
    </Sheet>
  );
}
