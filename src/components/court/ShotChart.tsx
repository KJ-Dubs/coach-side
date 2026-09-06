import { useMemo, useState } from "react";
import { BubbleButton, Pill } from "@/components/Bubbles";
import { Court, toLocal, type CourtZoom } from "@/components/court/Court";
import { ZONE_LABEL, zoneOf, type Zone } from "@/lib/court";
import { STAT_LABELS, statColor } from "@/lib/statColors";
import type { GameEvent } from "@/lib/types";

const FILTERS = ["SHOTS", "MADE", "MISS", "REBOUND", "STEAL", "TURNOVER", "ALL"] as const;
type Filter = (typeof FILTERS)[number];

const LEGEND = ["MADE", "MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"];

/**
 * Season/aggregate location map. Same colour language as the live court,
 * review page and PDF: green makes, red misses, blue rebounds, etc.
 * Stored x is in half-court units (1 = half line, up to 2 in the backcourt),
 * so the chart can show the attacking half or the whole floor.
 */
export function ShotChart({ events, compact }: { events: GameEvent[]; compact?: boolean }) {
  const [filter, setFilter] = useState<Filter>("SHOTS");
  const [zoom, setZoom] = useState<CourtZoom>("left");

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
  const backcourt = useMemo(() => located.filter((e) => (e.x as number) > 1).length, [located]);

  const marks = useMemo(
    () =>
      plotted
        .map((e) => ({
          e,
          p: toLocal(zoom, { x: (e.x as number) / 2, y: e.y as number }),
        }))
        .filter((m) => m.p.x >= -0.02 && m.p.x <= 1.02),
    [plotted, zoom],
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
        <Pill tone="muted">{marks.length} plotted</Pill>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <BubbleButton size="sm" tone={zoom === "left" ? "flame" : "neutral"} onClick={() => setZoom("left")}>
          Half Court
        </BubbleButton>
        <BubbleButton size="sm" tone={zoom === "full" ? "flame" : "neutral"} onClick={() => setZoom("full")}>
          Full Court
        </BubbleButton>
        <Pill tone="muted">{backcourt} in the backcourt</Pill>
      </div>
      <Court
        variant="full"
        zoom={zoom}
        cursor="default"
        overlay={
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {marks.map(({ e, p }) => {
              const c = statColor(String(e.event_type));
              const hollow = e.event_type === "MISS" || e.event_type === "FT_MISS";
              return (
                <circle
                  key={e.id}
                  cx={`${p.x * 100}%`}
                  cy={`${p.y * 100}%`}
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
