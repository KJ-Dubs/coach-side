import { useMemo, useState } from "react";
import { BubbleButton, Pill } from "@/components/Bubbles";
import { Court } from "@/components/court/Court";
import { ZONE_LABEL, zoneOf, type Zone } from "@/lib/court";
import { STAT_LABELS, statColor } from "@/lib/statColors";
import type { GameEvent } from "@/lib/types";

const FILTERS = ["SHOTS", "MADE", "MISS", "REBOUND", "ALL"] as const;
type Filter = (typeof FILTERS)[number];

const LEGEND = ["MADE", "MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"];

/**
 * Season/aggregate location map. Same colour language as the live court,
 * review page and PDF: green makes, red misses, blue rebounds, etc.
 */
export function ShotChart({ events, compact }: { events: GameEvent[]; compact?: boolean }) {
  const [filter, setFilter] = useState<Filter>("SHOTS");

  const located = useMemo(
    () => events.filter((e) => e.x != null && e.y != null && e.event_type !== "OPP_SCORE"),
    [events],
  );
  const plotted = useMemo(
    () =>
      located.filter((e) => {
        if (filter === "ALL") return true;
        if (filter === "SHOTS") return e.event_type === "MADE" || e.event_type === "MISS";
        return e.event_type === filter;
      }),
    [located, filter],
  );

  const zones = useMemo(() => {
    const m = new Map<Zone, { made: number; att: number }>();
    for (const e of located) {
      if (e.event_type !== "MADE" && e.event_type !== "MISS") continue;
      const z = zoneOf(e.x as number, e.y as number);
      const row = m.get(z) ?? { made: 0, att: 0 };
      row.att++;
      if (e.event_type === "MADE") row.made++;
      m.set(z, row);
    }
    return (Object.keys(ZONE_LABEL) as Zone[])
      .map((z) => ({ z, ...(m.get(z) ?? { made: 0, att: 0 }) }))
      .filter((r) => r.att > 0);
  }, [located]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <BubbleButton
            key={f}
            size="sm"
            tone={filter === f ? "grape" : "neutral"}
            onClick={() => setFilter(f)}
          >
            {f === "SHOTS" ? "Makes + misses" : f === "ALL" ? "Everything" : STAT_LABELS[f] ?? f}
          </BubbleButton>
        ))}
        <Pill tone="muted">{plotted.length} plotted</Pill>
      </div>
      <Court
        cursor="default"
        overlay={
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {plotted.map((e) => {
              const c = statColor(String(e.event_type));
              const hollow = e.event_type === "MISS" || e.event_type === "FT_MISS";
              return (
                <circle
                  key={e.id}
                  cx={`${(e.x as number) * 100}%`}
                  cy={`${(e.y as number) * 100}%`}
                  r={compact ? 5 : 7}
                  fill={hollow ? "transparent" : c}
                  stroke={c}
                  strokeWidth={2.5}
                  opacity={0.8}
                />
              );
            })}
          </svg>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        {LEGEND.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/70 px-3 py-1 text-xs font-semibold text-foreground"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: statColor(t) }} />
            {STAT_LABELS[t] ?? t}
          </span>
        ))}
      </div>
      {zones.length ? (
        <div className="flex flex-wrap gap-1.5">
          {zones.map((r) => (
            <Pill key={r.z} tone="grape">
              {ZONE_LABEL[r.z]}: {r.made}/{r.att} · {Math.round((r.made / r.att) * 100)}%
            </Pill>
          ))}
        </div>
      ) : (
        <Pill tone="muted">No located shots yet</Pill>
      )}
    </div>
  );
}
