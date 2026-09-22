import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BubbleButton, EmptyState, InfoPanel, Label, Panel, Pill, TextInput } from "@/components/Bubbles";
import { DrillCanvas } from "@/components/court/DrillCanvas";
import {
  DIFFICULTIES,
  DRILL_CATEGORIES,
  DRILL_STYLES,
  GROUP_SIZES,
  fetchDrillFrames,
  fetchDrillLibrary,
  type Drill,
} from "@/lib/drills";
import { searchScore } from "@/lib/playIndex";

const TIME_BUCKETS = ["Any", "Under 8 min", "8–12 min", "12+ min"] as const;

function inBucket(minutes: number, bucket: string) {
  if (bucket === "Under 8 min") return minutes < 8;
  if (bucket === "8–12 min") return minutes >= 8 && minutes <= 12;
  if (bucket === "12+ min") return minutes > 12;
  return true;
}

export function DrillFeed({ drills }: { drills?: Drill[] | undefined }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [group, setGroup] = useState("Any");
  const [time, setTime] = useState<string>("Any");
  const [difficulty, setDifficulty] = useState("Any");
  const [style, setStyle] = useState("Any");
  const [showFilters, setShowFilters] = useState(false);

  const library = useQuery({
    queryKey: ["drill-library"],
    queryFn: fetchDrillLibrary,
    enabled: !drills,
  });
  const list = drills ?? library.data ?? [];

  const shown = useMemo(
    () =>
      list.filter((d) => {
        if (category !== "All" && d.category !== category) return false;
        if (group !== "Any" && d.group_size !== group) return false;
        if (difficulty !== "Any" && d.difficulty !== difficulty) return false;
        if (style !== "Any" && d.style !== style) return false;
        if (!inBucket(d.duration_minutes, time)) return false;
        return (
          searchScore(
            {
              name: d.name,
              category: d.category,
              tags: [...(d.tags ?? []), ...(d.skill_focus ?? []), ...(d.equipment ?? [])],
            },
            query,
          ) > 0
        );
      }),
    [list, category, group, difficulty, style, time, query],
  );

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-2">
        <TextInput
          placeholder="Search drills — try “shooting with cones” or “defense closeout”"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <BubbleButton size="sm" tone={showFilters ? "grape" : "neutral"} onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? "Hide filters" : "Filters"}
          </BubbleButton>
          <Pill tone="muted" className="ml-auto">
            {shown.length} {shown.length === 1 ? "drill" : "drills"}
          </Pill>
        </div>
        {showFilters ? (
          <div className="flex flex-col gap-2">
            <Row label="Skill" options={["All", ...DRILL_CATEGORIES]} value={category} onPick={setCategory} />
            <Row label="Players" options={["Any", ...GROUP_SIZES]} value={group} onPick={setGroup} />
            <Row label="Time" options={TIME_BUCKETS} value={time} onPick={setTime} />
            <Row label="Difficulty" options={["Any", ...DIFFICULTIES]} value={difficulty} onPick={setDifficulty} />
            <Row label="Style" options={["Any", ...DRILL_STYLES]} value={style} onPick={setStyle} />
          </div>
        ) : (
          <InfoPanel>Every drill lists its time, players and equipment before you tap in.</InfoPanel>
        )}
      </Panel>

      {library.isLoading && !drills ? <EmptyState>Loading drills…</EmptyState> : null}
      {!shown.length && !library.isLoading ? <EmptyState>No drills match that search yet</EmptyState> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((d) => (
          <DrillCard key={d.id} drill={d} />
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label>{label}</Label>
      {options.map((o) => (
        <BubbleButton key={o} size="sm" tone={value === o ? "grape" : "neutral"} onClick={() => onPick(o)}>
          {o}
        </BubbleButton>
      ))}
    </div>
  );
}

export function DrillThumb({ drillId }: { drillId: string }) {
  const frames = useQuery({
    queryKey: ["drill-frames", drillId],
    queryFn: () => fetchDrillFrames(drillId),
    staleTime: 5 * 60 * 1000,
  });
  return (
    <div className="pointer-events-none overflow-hidden rounded-2xl">
      <DrillCanvas frame={frames.data?.[0]} />
    </div>
  );
}

export function DrillCard({ drill }: { drill: Drill }) {
  return (
    <Panel className="flex flex-col gap-3">
      <Link
        to="/drills/$drillId"
        params={{ drillId: drill.id }}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
        aria-label={`Open ${drill.name}`}
      >
        <DrillThumb drillId={drill.id} />
      </Link>
      <h3 className="text-center text-xl font-black leading-tight text-foreground">{drill.name}</h3>
      <InfoPanel className="py-2 text-center text-xs">
        {[drill.category, drill.group_size, `${drill.duration_minutes} min`, drill.difficulty].join(" • ")}
      </InfoPanel>
      {drill.equipment?.length ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {drill.equipment.slice(0, 3).map((e) => (
            <Pill key={e} tone="muted">
              {e}
            </Pill>
          ))}
        </div>
      ) : null}
      <Link to="/drills/$drillId" params={{ drillId: drill.id }} className="block w-full">
        <BubbleButton tone="flame" size="lg" className="min-h-14 w-full">
          ▶ Open Drill
        </BubbleButton>
      </Link>
    </Panel>
  );
}
