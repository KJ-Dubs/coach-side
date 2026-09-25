import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  InfoPanel,
  Label,
  Panel,
  Pill,
  PrimaryCTA,
  StatTile,
} from "@/components/Bubbles";
import { fetchPlays } from "@/lib/data";
import { fetchDrillLibrary, fetchMyDrills, type Drill } from "@/lib/drills";
import {
  BLOCK_LABEL,
  CUSTOM_BLOCKS,
  deletePracticePlan,
  fetchPracticeBlocks,
  fetchPracticePlan,
  savePracticeBlocks,
  updatePracticePlan,
  type PracticeBlock,
} from "@/lib/practice";

export const Route = createFileRoute("/_authenticated/practice/$planId")({
  head: () => ({
    meta: [
      { title: "Practice Plan — CoachSide" },
      { name: "description", content: "A timed practice plan built from drills, plays and custom blocks." },
      { property: "og:title", content: "Practice Plan — CoachSide" },
      { property: "og:description", content: "Run practice from a timed CoachSide plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PracticePlanPage,
  errorComponent: () => <EmptyState>That plan could not be loaded.</EmptyState>,
  notFoundComponent: () => <EmptyState>That plan does not exist.</EmptyState>,
});

type Draft = Pick<PracticeBlock, "block_type" | "ref_id" | "title" | "minutes" | "notes" | "completed">;

function PracticePlanPage() {
  const { planId } = Route.useParams();
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ["practice-plan", planId], queryFn: () => fetchPracticePlan(planId) });
  const blocks = useQuery({ queryKey: ["practice-blocks", planId], queryFn: () => fetchPracticeBlocks(planId) });
  const myDrills = useQuery({ queryKey: ["my-drills"], queryFn: fetchMyDrills });
  const libraryDrills = useQuery({ queryKey: ["drill-library"], queryFn: fetchDrillLibrary });
  const plays = useQuery({ queryKey: ["plays"], queryFn: fetchPlays });

  const [draft, setDraft] = useState<Draft[]>([]);
  const [picker, setPicker] = useState<"drills" | "plays" | "custom">("drills");

  useEffect(() => {
    if (blocks.data) setDraft(blocks.data.map(({ block_type, ref_id, title, minutes, notes, completed }) => ({ block_type, ref_id, title, minutes, notes, completed })));
  }, [blocks.data]);

  const used = useMemo(() => draft.reduce((s, b) => s + b.minutes, 0), [draft]);
  const total = plan.data?.total_minutes ?? 0;
  const left = total - used;

  const save = useMutation({
    mutationFn: () => savePracticeBlocks(planId, draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["practice-blocks", planId] });
      toast.success("Plan saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const share = useMutation({
    mutationFn: (shared: boolean) => updatePracticePlan(planId, { shared_to_locker: shared }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["practice-plan", planId] });
      toast.success("Sharing updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deletePracticePlan(planId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["practice-plans"] });
      toast.success("Plan deleted");
      window.history.back();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const add = (b: Draft) => setDraft((d) => [...d, b]);
  const addDrill = (d: Drill) =>
    add({ block_type: "drill", ref_id: d.id, title: d.name, minutes: d.duration_minutes, notes: null, completed: false });
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d];
      const j = i + dir;
      if (j < 0 || j >= next.length) return d;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const fillGap = () => {
    if (left <= 0) return;
    add({ block_type: "scrimmage", title: "Scrimmage", minutes: left, notes: null, ref_id: null, completed: false });
  };

  const allDrills = [...(myDrills.data ?? []), ...(libraryDrills.data ?? [])];

  return (
    <AppShell
      title={plan.data?.title ?? "Practice Plan"}
      subtitle={plan.data ? `${plan.data.plan_date} • ${plan.data.total_minutes} minutes` : "Loading…"}
      backTo="/practice"
      backLabel="All plans"
      actions={
        <Link to="/practice">
          <BubbleButton size="sm" tone="ghost">
            ← All plans
          </BubbleButton>
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <Panel className="grid grid-cols-3 gap-2">
          <StatTile label="Planned" value={`${used}m`} />
          <StatTile label="Total" value={`${total}m`} tone="grape" />
          <StatTile label={left >= 0 ? "Left" : "Over"} value={`${Math.abs(left)}m`} tone="flame" />
        </Panel>

        <Panel className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Label>Add from</Label>
            {(["drills", "plays", "custom"] as const).map((p) => (
              <BubbleButton key={p} size="sm" tone={picker === p ? "grape" : "neutral"} onClick={() => setPicker(p)}>
                {p[0]!.toUpperCase() + p.slice(1)}
              </BubbleButton>
            ))}
            {left > 0 ? (
              <BubbleButton size="sm" tone="flame" onClick={fillGap}>
                Fill {left}m
              </BubbleButton>
            ) : null}
          </div>
          <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
            {picker === "drills"
              ? allDrills.map((d) => (
                  <BubbleButton key={d.id} size="sm" tone="neutral" onClick={() => addDrill(d)}>
                    + {d.name} · {d.duration_minutes}m
                  </BubbleButton>
                ))
              : null}
            {picker === "plays"
              ? (plays.data ?? []).map((p) => (
                  <BubbleButton
                    key={p.id}
                    size="sm"
                    tone="neutral"
                    onClick={() =>
                      add({ block_type: "play", ref_id: p.id, title: `Install: ${p.name}`, minutes: 8, notes: null, completed: false })
                    }
                  >
                    + {p.name} · 8m
                  </BubbleButton>
                ))
              : null}
            {picker === "custom"
              ? CUSTOM_BLOCKS.map((c) => (
                  <BubbleButton
                    key={c.title}
                    size="sm"
                    tone="neutral"
                    onClick={() => add({ block_type: c.type, ref_id: null, title: c.title, minutes: c.minutes, notes: null, completed: false })}
                  >
                    + {c.title} · {c.minutes}m
                  </BubbleButton>
                ))
              : null}
          </div>
        </Panel>

        {!draft.length ? <EmptyState>Nothing planned yet — add drills, plays or a custom block.</EmptyState> : null}

        <div className="flex flex-col gap-2">
          {draft.map((b, i) => (
            <Panel key={`${b.title}-${i}`} className="flex flex-wrap items-center gap-2">
              <Pill tone="muted">{BLOCK_LABEL[b.block_type] ?? "Block"}</Pill>
              <span className="text-base font-black text-foreground">{b.title}</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={b.minutes}
                  onChange={(e) =>
                    setDraft((d) =>
                      d.map((x, j) => (j === i ? { ...x, minutes: Math.max(1, Number(e.target.value) || 1) } : x)),
                    )
                  }
                  className="w-20 rounded-2xl border border-input bg-surface-2/70 px-3 py-2 text-center text-sm font-bold text-foreground outline-none focus:border-grape"
                  aria-label={`Minutes for ${b.title}`}
                />
                <BubbleButton
                  size="sm"
                  tone={b.completed ? "grape" : "neutral"}
                  onClick={() => setDraft((d) => d.map((x, j) => (j === i ? { ...x, completed: !x.completed } : x)))}
                >
                  {b.completed ? "✓ Done" : "Mark done"}
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </BubbleButton>
                <BubbleButton size="sm" tone="danger" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
                  Remove
                </BubbleButton>
              </div>
            </Panel>
          ))}
        </div>

        <InfoPanel>Players only see this plan once you share it to the Locker Room.</InfoPanel>

        <PrimaryCTA>
          <BubbleButton tone="flame" size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save plan"}
          </BubbleButton>
          <BubbleButton
            tone={plan.data?.shared_to_locker ? "grape" : "neutral"}
            size="lg"
            onClick={() => share.mutate(!plan.data?.shared_to_locker)}
          >
            {plan.data?.shared_to_locker ? "Shared to Locker Room" : "Share to Locker Room"}
          </BubbleButton>
          <BubbleButton tone="danger" size="lg" onClick={() => remove.mutate()}>
            Delete
          </BubbleButton>
        </PrimaryCTA>
      </div>
    </AppShell>
  );
}
