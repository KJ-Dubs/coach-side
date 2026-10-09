/** Post-game correction of tracking coverage metadata. Never touches events. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BubbleButton, Label } from "@/components/Bubbles";
import { supabase } from "@/integrations/supabase/client";
import {
  COVERAGE_LABEL,
  TRACKING_LABELS,
  computeCoverage,
  normalizeOverride,
  type CoverageOverride,
  type CoverageStatus,
  type TrackingKey,
} from "@/lib/gameConfig";
import type { Game, GameEvent } from "@/lib/types";

const STATUSES: CoverageStatus[] = ["full", "partial", "none"];

export function CoverageEditor({ game, events }: { game: Game; events: GameEvent[] }) {
  const qc = useQueryClient();
  const [override, setOverride] = useState<CoverageOverride>(() => normalizeOverride(game.tracking_coverage_override));
  const computed = computeCoverage({ ...game, tracking_coverage_override: null }, events);
  const effective = computeCoverage({ ...game, tracking_coverage_override: override }, events);

  const save = async (next: CoverageOverride) => {
    setOverride(next);
    const value = Object.keys(next).length ? next : null;
    const { error } = await supabase.from("games").update({ tracking_coverage_override: value } as never).eq("id", game.id);
    if (error) return toast.error("Could not save coverage");
    qc.setQueryData(["game", game.id], (old: unknown) => (old ? { ...(old as object), tracking_coverage_override: value } : old));
  };
  const setStatus = (k: TrackingKey, status: CoverageStatus) => {
    const next = { ...override };
    if (status === computed[k].status && !override[k]?.note) delete next[k];
    else next[k] = { status, note: override[k]?.note ?? null };
    void save(next);
  };
  const setNote = (k: TrackingKey, note: string) => {
    const next = { ...override, [k]: { status: effective[k].status, note: note.trim() || null } };
    void save(next);
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-2/60 p-2">
      <Label>Tracking coverage</Label>
      {TRACKING_LABELS.filter((t) => t.key !== "foulDetail").map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1 rounded-2xl border border-border/60 p-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="min-w-0 flex-1 truncate px-1 text-xs font-bold">{label}</span>
            {STATUSES.map((s) => (
              <BubbleButton key={s} size="sm" tone={effective[key].status === s ? (s === "full" ? "grape" : "flame") : "ghost"} className="min-h-11 px-2 text-[11px]" onClick={() => setStatus(key, s)}>
                {COVERAGE_LABEL[s]}
              </BubbleButton>
            ))}
          </div>
          {effective[key].status === "partial" ? (
            <input
              defaultValue={override[key]?.note ?? ""}
              placeholder="Period notes, e.g. Q2–Q4 only"
              maxLength={80}
              onBlur={(e) => { if ((e.target.value.trim() || null) !== (override[key]?.note ?? null)) setNote(key, e.target.value); }}
              className="min-h-11 rounded-xl border border-border bg-background px-2 text-xs"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
