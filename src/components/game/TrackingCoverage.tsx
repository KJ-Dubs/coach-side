/** Post-game disclosure of which stat categories were tracked, and when. */
import { useState } from "react";
import { Label, Panel, Pill } from "@/components/Bubbles";
import { COVERAGE_LABEL, TRACKING_LABELS, periodRanges, type Coverage, type TrackingKey } from "@/lib/gameConfig";

const SHOWN: TrackingKey[] = ["players", "shotLocations", "rebounds", "assists", "steals", "turnovers", "blocks", "fouls", "opponent", "oppRebounds", "oppTurnovers", "oppFouls", "clock"];

export function TrackingCoverageCard({ coverage, periods, className }: { coverage: Record<TrackingKey, Coverage>; periods: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const incomplete = SHOWN.filter((k) => coverage[k].status !== "full");
  return (
    <Panel className={className ?? "mb-3 flex min-w-0 max-w-full flex-col gap-2"}>
      <button type="button" className="flex min-h-11 flex-wrap items-center gap-2 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Label>Stat tracking coverage</Label>
        {incomplete.length ? <Pill tone="flame">{incomplete.length} incomplete</Pill> : <Pill tone="success">All full game</Pill>}
        <Pill tone="muted">{open ? "Hide" : "Details"}</Pill>
      </button>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="success">Scoring · Full game</Pill>
        {(open ? SHOWN : incomplete).map((k) => {
          const c = coverage[k];
          const label = TRACKING_LABELS.find((t) => t.key === k)?.label ?? k;
          const detail = c.status === "partial" && c.periods.length ? ` · ${periodRanges(c.periods, periods)} only` : "";
          return (
            <Pill key={k} tone={c.status === "full" ? "success" : c.status === "partial" ? "flame" : "muted"}>
              {label} · {COVERAGE_LABEL[c.status]}{detail}{c.note ? ` · ${c.note}` : ""}
            </Pill>
          );
        })}
      </div>
    </Panel>
  );
}

export function PartialBadge() {
  return <span className="ml-1 rounded-full bg-flame/25 px-1.5 py-0.5 text-[9px] font-black uppercase text-foreground">Partial</span>;
}
