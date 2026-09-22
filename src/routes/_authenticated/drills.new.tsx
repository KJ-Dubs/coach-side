import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  Field,
  InfoPanel,
  Label,
  Panel,
  Pill,
  PrimaryCTA,
  SelectInput,
  TextInput,
} from "@/components/Bubbles";
import { DrillCanvas } from "@/components/court/DrillCanvas";
import type { CourtZoom } from "@/components/court/Court";
import {
  DIFFICULTIES,
  DRILL_CATEGORIES,
  DRILL_STYLES,
  EQUIPMENT_OPTIONS,
  GROUP_SIZES,
  SKILL_FOCUS,
  createDrill,
  saveDrillFrames,
  type DrillFrame,
  type DrillObject,
} from "@/lib/drills";
import type { PlayToken } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/drills/new")({
  head: () => ({
    meta: [
      { title: "Drill Maker — CoachSide" },
      {
        name: "description",
        content:
          "Draw a basketball drill with players, cones, chairs and paths, then add the instructions, timing and coaching points.",
      },
      { property: "og:title", content: "Drill Maker — CoachSide" },
      { property: "og:description", content: "Build a full basketball drill on a real court diagram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DrillMakerPage,
});

type Tool = "offense" | "defense" | "cone" | "chair" | "spot" | "ball" | "erase";

const TOOLS: { key: Tool; label: string }[] = [
  { key: "offense", label: "Player" },
  { key: "defense", label: "Defender" },
  { key: "cone", label: "Cone" },
  { key: "chair", label: "Chair" },
  { key: "spot", label: "Spot" },
  { key: "ball", label: "Ball" },
  { key: "erase", label: "Erase" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

type Step = { tokens: PlayToken[]; objects: DrillObject[]; note: string };

function DrillMakerPage() {
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool>("offense");
  const [zoom, setZoom] = useState<CourtZoom>("right");
  const [steps, setSteps] = useState<Step[]>([{ tokens: [], objects: [], note: "" }]);
  const [stepIdx, setStepIdx] = useState(0);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Shooting");
  const [groupSize, setGroupSize] = useState<string>("Team");
  const [minutes, setMinutes] = useState(10);
  const [reps, setReps] = useState("");
  const [difficulty, setDifficulty] = useState<string>("All levels");
  const [style, setStyle] = useState<string>("team");
  const [skills, setSkills] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [points, setPoints] = useState("");
  const [scoring, setScoring] = useState("");

  const step = steps[stepIdx]!;
  const patchStep = (patch: Partial<Step>) =>
    setSteps((s) => s.map((x, i) => (i === stepIdx ? { ...x, ...patch } : x)));

  const toggle = (list: string[], v: string, set: (n: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const place = (p: { x: number; y: number }) => {
    if (tool === "erase") {
      const near = (a: { x: number; y: number }) => Math.hypot(a.x - p.x, a.y - p.y) < 0.035;
      patchStep({
        tokens: step.tokens.filter((t) => !near(t)),
        objects: step.objects.filter((o) => !near(o)),
      });
      return;
    }
    if (tool === "offense" || tool === "defense") {
      const count = step.tokens.filter((t) => (t.team ?? "offense") === tool).length;
      patchStep({
        tokens: [
          ...step.tokens,
          { id: uid(), label: String(count + 1), x: p.x, y: p.y, ball: false, team: tool },
        ],
      });
      return;
    }
    patchStep({
      objects: [...step.objects, { id: uid(), type: tool as DrillObject["type"], x: p.x, y: p.y }],
    });
  };

  const frame: DrillFrame = {
    id: "draft",
    drill_id: "draft",
    idx: stepIdx,
    tokens: step.tokens,
    actions: [],
    objects: step.objects,
    note: step.note || null,
  };

  const ready = name.trim().length > 0 && instructions.trim().length > 0;

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const drill = await createDrill({
        name: name.trim(),
        category,
        skill_focus: skills,
        group_size: groupSize,
        court_orientation: zoom,
        equipment,
        duration_minutes: minutes,
        repetitions: reps.trim() || null,
        instructions: instructions.trim(),
        coaching_points: points.trim() || null,
        scoring_rules: scoring.trim() || null,
        difficulty,
        style,
        published_to_library: publish,
        published_at: publish ? new Date().toISOString() : null,
      });
      await saveDrillFrames(
        drill.id,
        steps.map((s, i) => ({
          idx: i,
          tokens: s.tokens,
          actions: [],
          objects: s.objects,
          note: s.note || null,
        })),
      );
      return drill.id;
    },
    onSuccess: (id) => {
      toast.success("Drill saved");
      navigate({ to: "/drills/$drillId", params: { drillId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Drill Maker"
      subtitle="Draw it, then tell coaches how to run it"
      actions={
        <Link to="/drills">
          <BubbleButton size="sm" tone="ghost">
            My Drills
          </BubbleButton>
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <DrillCanvas frame={frame} zoom={zoom} onCourtPoint={place} />

        <Panel className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Label>Tools</Label>
            {TOOLS.map((t) => (
              <BubbleButton
                key={t.key}
                size="sm"
                tone={tool === t.key ? "flame" : "neutral"}
                onClick={() => setTool(t.key)}
              >
                {t.label}
              </BubbleButton>
            ))}
            <BubbleButton size="sm" tone="ghost" onClick={() => patchStep({ tokens: [], objects: [] })}>
              Clear step
            </BubbleButton>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Label>View</Label>
            {(["right", "left", "top", "bottom", "full"] as CourtZoom[]).map((z) => (
              <BubbleButton key={z} size="sm" tone={zoom === z ? "grape" : "neutral"} onClick={() => setZoom(z)}>
                {z === "full" ? "Full" : z[0]!.toUpperCase() + z.slice(1)}
              </BubbleButton>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Label>Steps</Label>
            {steps.map((_, i) => (
              <BubbleButton key={i} size="sm" tone={i === stepIdx ? "grape" : "neutral"} onClick={() => setStepIdx(i)}>
                {i + 1}
              </BubbleButton>
            ))}
            <BubbleButton
              size="sm"
              tone="neutral"
              onClick={() => {
                setSteps((s) => [...s, { tokens: step.tokens, objects: step.objects, note: "" }]);
                setStepIdx(steps.length);
              }}
            >
              + Step
            </BubbleButton>
          </div>
          <TextInput
            placeholder="What happens in this step"
            value={step.note}
            onChange={(e) => patchStep({ note: e.target.value })}
          />
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-2xl font-black leading-tight text-foreground">Drill details</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              These answers are what other coaches search by.
            </p>
          </div>

          <Field label="Drill name">
            <TextInput placeholder="e.g. Elbow Catch & Shoot" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Skill">
            <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
              {DRILL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Skill focus">
            <div className="flex flex-wrap justify-center gap-2">
              {SKILL_FOCUS.map((s) => (
                <BubbleButton
                  key={s}
                  size="sm"
                  tone={skills.includes(s) ? "grape" : "neutral"}
                  onClick={() => toggle(skills, s, setSkills)}
                >
                  {s}
                </BubbleButton>
              ))}
            </div>
          </Field>

          <Field label="Players">
            <div className="flex flex-wrap justify-center gap-2">
              {GROUP_SIZES.map((g) => (
                <BubbleButton key={g} size="sm" tone={groupSize === g ? "grape" : "neutral"} onClick={() => setGroupSize(g)}>
                  {g}
                </BubbleButton>
              ))}
            </div>
          </Field>

          <Field label="Minutes">
            <TextInput
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>

          <Field label="Reps">
            <TextInput placeholder="e.g. 10 makes each side" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>

          <Field label="Equipment">
            <div className="flex flex-wrap justify-center gap-2">
              {EQUIPMENT_OPTIONS.map((e) => (
                <BubbleButton
                  key={e}
                  size="sm"
                  tone={equipment.includes(e) ? "grape" : "neutral"}
                  onClick={() => toggle(equipment, e, setEquipment)}
                >
                  {e}
                </BubbleButton>
              ))}
            </div>
          </Field>

          <Field label="Difficulty">
            <div className="flex flex-wrap justify-center gap-2">
              {DIFFICULTIES.map((d) => (
                <BubbleButton key={d} size="sm" tone={difficulty === d ? "grape" : "neutral"} onClick={() => setDifficulty(d)}>
                  {d}
                </BubbleButton>
              ))}
            </div>
          </Field>

          <Field label="Style">
            <div className="flex flex-wrap justify-center gap-2">
              {DRILL_STYLES.map((s) => (
                <BubbleButton key={s} size="sm" tone={style === s ? "grape" : "neutral"} onClick={() => setStyle(s)}>
                  {s}
                </BubbleButton>
              ))}
            </div>
          </Field>

          <Field label="How it runs">
            <textarea
              className="min-h-28 w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-2.5 text-base font-semibold text-foreground outline-none focus:border-grape"
              placeholder="Step by step, as you would explain it in the gym."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>

          <Field label="Coaching points">
            <textarea
              className="min-h-20 w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-2.5 text-base font-semibold text-foreground outline-none focus:border-grape"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </Field>

          <Field label="Scoring">
            <TextInput placeholder="e.g. First group to 10 makes" value={scoring} onChange={(e) => setScoring(e.target.value)} />
          </Field>

          {!ready ? <InfoPanel>Add a name and the instructions before saving.</InfoPanel> : null}

          <PrimaryCTA>
            <BubbleButton
              tone="neutral"
              size="lg"
              disabled={!ready || save.isPending}
              onClick={() => save.mutate(false)}
            >
              Save privately
            </BubbleButton>
            <BubbleButton
              tone="flame"
              size="lg"
              disabled={!ready || save.isPending}
              onClick={() => save.mutate(true)}
            >
              {save.isPending ? "Saving…" : "Save & publish"}
            </BubbleButton>
          </PrimaryCTA>
          <div className="flex justify-center">
            <Pill tone="muted">Published drills are public in the CoachSide Drill Library</Pill>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
