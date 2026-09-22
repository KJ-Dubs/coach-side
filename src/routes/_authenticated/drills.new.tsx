import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDot, PackageOpen, Play, Save, Shield, TrafficCone, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Field, InfoPanel, Label, Panel, Pill, PrimaryCTA, SelectInput, TextInput } from "@/components/Bubbles";
import { DrillCanvas } from "@/components/court/DrillCanvas";
import type { CourtZoom } from "@/components/court/Court";
import { DIFFICULTIES, DRILL_CATEGORIES, DRILL_STYLES, EQUIPMENT_OPTIONS, GROUP_SIZES, SKILL_FOCUS, createDrill, saveDrillFrames, type DrillFrame, type DrillObject } from "@/lib/drills";
import { buildSteps, inferPassReceiver, nearestTokenAt, sampleTimeline, stateAtSequenceStart, DO_MS, SHOW_MS } from "@/lib/playAnimation";
import { simplifyPath, type Point } from "@/lib/playPath";
import type { PlayAction, PlayActionType, PlayFrame, PlayToken } from "@/lib/types";
import { uuid } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/drills/new")({
  head: () => ({ meta: [
    { title: "Drill Maker — CoachSide" },
    { name: "description", content: "Build and animate basketball drills with players, actions, equipment, and repeatable steps." },
    { property: "og:title", content: "Drill Maker — CoachSide" },
    { property: "og:description", content: "Build a basketball drill directly on the court." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DrillMakerPage,
});

type Tool = "player" | "pass" | "dribble" | "screen" | "shot" | "equipment" | "erase";
type EquipmentTool = DrillObject["type"];
type AnimMode = "idle" | "preview" | "replay";
const STEP_MS = SHOW_MS + DO_MS;
const uid = () => uuid();

const START_TOKENS: PlayToken[] = [
  { id: "drill-p1", label: "1", x: 0.58, y: 0.5, ball: true, team: "offense" },
  { id: "drill-p2", label: "2", x: 0.7, y: 0.24, ball: false, team: "offense" },
  { id: "drill-p3", label: "3", x: 0.7, y: 0.76, ball: false, team: "offense" },
];

function asPlayFrame(frame: DrillFrame): PlayFrame {
  return { id: frame.id, play_id: frame.drill_id, idx: frame.idx, tokens: frame.tokens, actions: frame.actions, note: frame.note };
}

function DrillMakerPage() {
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool>("player");
  const [equipmentTool, setEquipmentTool] = useState<EquipmentTool>("cone");
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [addingTeam, setAddingTeam] = useState<"offense" | "defense">("offense");
  const [zoom, setZoom] = useState<CourtZoom>("right");
  const [frame, setFrame] = useState<DrillFrame>({ id: "draft", drill_id: "draft", idx: 0, tokens: START_TOKENS, actions: [], objects: [], note: null });
  const [seqIdx, setSeqIdx] = useState(0);
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [dragObject, setDragObject] = useState<string | null>(null);
  const [mode, setMode] = useState<AnimMode>("idle");
  const [timeMs, setTimeMs] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const raf = useRef<number | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Shooting");
  const [groupSize, setGroupSize] = useState<string>("Team");
  const [minutes, setMinutes] = useState(10);
  const [difficulty, setDifficulty] = useState<string>("All levels");
  const [style, setStyle] = useState<string>("team");
  const [skills, setSkills] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState("");

  const playFrame = useMemo(() => asPlayFrame(frame), [frame]);
  const steps = useMemo(() => buildSteps(playFrame), [playFrame]);
  const seqCount = steps.length;
  const activeIdx = Math.min(seqIdx, seqCount);
  const activeStep = steps[activeIdx];
  const seqNumber = activeStep?.seq ?? (steps[seqCount - 1]?.seq ?? 0) + 1;
  const projected = useMemo(() => stateAtSequenceStart(playFrame, activeIdx), [playFrame, activeIdx]);
  const timeline = useMemo(() => ({ steps, totalMs: steps.length * STEP_MS }), [steps]);
  const rangeStart = mode === "preview" ? activeIdx * STEP_MS : 0;
  const rangeEnd = mode === "preview" ? (activeIdx + 1) * STEP_MS : timeline.totalMs;
  const live = mode === "idle" ? null : sampleTimeline(timeline, timeMs);
  const shownTokens = live?.sample.tokens ?? projected.tokens;
  const shownActions = live?.step.actions ?? activeStep?.actions ?? [];

  useEffect(() => {
    if (mode === "idle") return;
    let last = performance.now();
    const tick = (now: number) => {
      const nextDelta = now - last;
      last = now;
      setTimeMs((current) => {
        const next = current + nextDelta;
        if (next >= rangeEnd) {
          setMode("idle");
          return Math.max(rangeStart, rangeEnd - 1);
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [mode, rangeEnd, rangeStart]);

  const patch = (next: Partial<DrillFrame>) => setFrame((current) => ({ ...current, ...next }));
  const objectAt = (p: Point) => [...frame.objects].reverse().find((object) => Math.hypot(object.x - p.x, object.y - p.y) < 0.045);
  const actionAt = (p: Point) => [...frame.actions].reverse().find((action) => action.seq === seqNumber && action.points.some((point) => Math.hypot(point.x - p.x, point.y - p.y) < 0.045));
  const tokenAt = (p: Point) => nearestTokenAt(shownTokens, p);

  const onDown = (p: Point) => {
    if (mode !== "idle") setMode("idle");
    if (tool === "erase") {
      const object = objectAt(p);
      const action = actionAt(p);
      const token = tokenAt(p);
      if (object) patch({ objects: frame.objects.filter((item) => item.id !== object.id) });
      else if (action) patch({ actions: frame.actions.filter((item) => item.id !== action.id) });
      else if (token) patch({ tokens: frame.tokens.filter((item) => item.id !== token) });
      return;
    }
    if (tool === "equipment") {
      const existing = objectAt(p);
      if (existing) setDragObject(existing.id);
      else patch({ objects: [...frame.objects, { id: uid(), type: equipmentTool, x: p.x, y: p.y, ...(equipmentTool === "text" ? { label: "START" } : {}) }] });
      return;
    }
    setStroke([p]);
  };

  const onMove = (p: Point) => {
    if (dragObject) {
      patch({ objects: frame.objects.map((object) => object.id === dragObject ? { ...object, x: p.x, y: p.y } : object) });
      return;
    }
    if (stroke) setStroke([...stroke, p]);
  };

  const addPlayer = (p: Point) => {
    const sameTeam = frame.tokens.filter((token) => (token.team ?? "offense") === addingTeam);
    patch({ tokens: [...frame.tokens, { id: uid(), label: String(sameTeam.length + 1), x: p.x, y: p.y, ball: false, team: addingTeam }] });
    toast.success(addingTeam === "offense" ? "Player added" : "Defender added", { duration: 1400 });
  };

  const onUp = (p: Point) => {
    if (dragObject) { setDragObject(null); return; }
    const drawn = stroke ? simplifyPath([...stroke, p]) : null;
    setStroke(null);
    if (!drawn?.length) return;
    const first = drawn[0];
    if (!first) return;
    const distance = Math.hypot(p.x - first.x, p.y - first.y);
    const actor = tokenAt(first);
    if (tool === "player" && !actor && distance < 0.03) { addPlayer(p); return; }
    if (!actor) { toast.info("Start on a player, or tap empty court to add one."); return; }
    if (distance < 0.03) return;
    if (tool === "equipment" || tool === "erase") return;
    const type: PlayActionType = tool === "player" ? "move" : tool;
    const base: PlayAction = { id: uid(), type, seq: seqNumber, points: drawn, actor };
    if (type === "pass") {
      const receiver = inferPassReceiver(projected.tokens, frame.actions.filter((action) => action.seq === seqNumber), base);
      patch({ actions: [...frame.actions, receiver ? { ...base, target: receiver.id, transfersBall: true, passTo: "receiver" } : { ...base, passTo: "space", transfersBall: false }] });
      toast[receiver ? "success" : "info"](receiver ? `Pass linked to #${receiver.label}` : "Pass saved to open space", { duration: 1800 });
      return;
    }
    patch({ actions: [...frame.actions, base] });
  };

  const preview = () => { if (!activeStep) return; setTimeMs(activeIdx * STEP_MS); setMode("preview"); };
  const replay = () => { if (!steps.length) return; setSeqIdx(0); setTimeMs(0); setMode("replay"); };
  const reset = () => { setMode("idle"); setTimeMs(0); setSeqIdx(0); };
  const ready = name.trim().length > 0 && instructions.trim().length > 0;
  const toggle = (list: string[], value: string, setter: (next: string[]) => void) => setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const drill = await createDrill({ name: name.trim(), category, skill_focus: skills, group_size: groupSize, court_orientation: zoom, equipment, duration_minutes: minutes, repetitions: null, instructions: instructions.trim(), coaching_points: null, scoring_rules: result.trim() || null, difficulty, style, published_to_library: publish, published_at: publish ? new Date().toISOString() : null });
      await saveDrillFrames(drill.id, [{ idx: 0, tokens: frame.tokens, actions: frame.actions, objects: frame.objects, note: frame.note }]);
      return drill.id;
    },
    onSuccess: (id) => { toast.success("Drill saved"); navigate({ to: "/drills/$drillId", params: { drillId: id } }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const tools: { key: Tool; label: string }[] = [
    { key: "player", label: "Move / Player" }, { key: "pass", label: "Pass" }, { key: "dribble", label: "Dribble" }, { key: "screen", label: "Screen" }, { key: "shot", label: "Shot" }, { key: "equipment", label: "Equipment" }, { key: "erase", label: "Erase" },
  ];
  const equipmentChoices: { key: EquipmentTool; label: string }[] = [{ key: "cone", label: "Cone" }, { key: "chair", label: "Chair" }, { key: "spot", label: "Spot" }, { key: "ball", label: "Extra Ball" }, { key: "line", label: "Starting Line" }, { key: "text", label: "Text" }];

  return <AppShell title="Drill Maker" subtitle="Build on the court first" actions={<Link to="/drills"><BubbleButton size="sm" tone="ghost">My Drills</BubbleButton></Link>}>
    <div className="flex flex-col gap-3">
      <DrillCanvas frame={frame} zoom={zoom} tokens={shownTokens} actions={shownActions} ball={live?.sample.ball ?? projected.ball} ghost={stroke} onCourtPoint={onDown} onCourtPointerMove={onMove} onCourtPointerUp={onUp} />

      <Panel className="flex flex-col gap-2 p-2.5">
        <div className="flex items-center justify-between gap-2"><Label>Build tools</Label><Pill tone="grape">Step {activeIdx + 1}</Pill></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{tools.map((item) => <BubbleButton key={item.key} size="sm" tone={tool === item.key ? (item.key === "erase" ? "flame" : "grape") : "neutral"} className="shrink-0" onClick={() => { setTool(item.key); if (item.key === "equipment") setEquipmentOpen(true); }}>{item.label}</BubbleButton>)}</div>
        {tool === "player" ? <div className="flex flex-wrap items-center gap-2"><Pill tone="muted">Tap empty court to add</Pill><BubbleButton size="sm" tone={addingTeam === "offense" ? "grape" : "neutral"} onClick={() => setAddingTeam("offense")}><UserPlus className="h-4 w-4" /> Offense</BubbleButton><BubbleButton size="sm" tone={addingTeam === "defense" ? "flame" : "neutral"} onClick={() => setAddingTeam("defense")}><Shield className="h-4 w-4" /> Defense</BubbleButton></div> : null}
        {tool === "equipment" && equipmentOpen ? <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface-2/60 p-2">{equipmentChoices.map((item) => <BubbleButton key={item.key} size="sm" tone={equipmentTool === item.key ? "flame" : "neutral"} onClick={() => setEquipmentTool(item.key)}>{item.key === "cone" ? <TrafficCone className="h-4 w-4" /> : item.key === "ball" ? <CircleDot className="h-4 w-4" /> : <PackageOpen className="h-4 w-4" />}{item.label}</BubbleButton>)}</div> : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2"><BubbleButton size="sm" tone="flame" onClick={() => { setMode("idle"); setTimeMs(0); setSeqIdx(seqCount); }}>+ Add Step</BubbleButton>{steps.map((step, index) => <BubbleButton key={step.seq} size="sm" tone={index === activeIdx ? "grape" : "neutral"} onClick={() => { setMode("idle"); setSeqIdx(index); }}>{index + 1}</BubbleButton>)}<Pill tone="muted">{activeIdx === seqCount ? "New step from previous finish" : `${shownActions.length} action${shownActions.length === 1 ? "" : "s"}`}</Pill></div>
      </Panel>

      <Panel className="flex flex-wrap items-center justify-center gap-2 p-2.5"><BubbleButton size="sm" tone="flame" disabled={!activeStep} onClick={() => mode === "preview" ? setMode("idle") : preview()}><Play className="h-4 w-4" />{mode === "preview" ? "Pause" : "Preview Step"}</BubbleButton><BubbleButton size="sm" tone="grape" disabled={!steps.length} onClick={() => mode === "replay" ? setMode("idle") : replay()}>↻ {mode === "replay" ? "Pause" : "Replay Drill"}</BubbleButton><BubbleButton size="sm" tone="neutral" onClick={reset}>⟲ Reset</BubbleButton><div className="flex gap-1">{(["right", "left", "full"] as CourtZoom[]).map((view) => <BubbleButton key={view} size="sm" tone={zoom === view ? "grape" : "ghost"} onClick={() => setZoom(view)}>{view[0]?.toUpperCase()}{view.slice(1)}</BubbleButton>)}</div></Panel>

      {!showDetails ? <PrimaryCTA><BubbleButton tone="flame" size="lg" onClick={() => setShowDetails(true)}><Save className="h-5 w-5" /> Save & Add Details</BubbleButton></PrimaryCTA> : <Panel className="flex flex-col gap-4">
        <div className="text-center"><h2 className="text-2xl font-black text-foreground">Save drill</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Add the details coaches and players need.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Drill name"><TextInput placeholder="e.g. Drive, kick, relocate" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Skill"><SelectInput value={category} onChange={(event) => setCategory(event.target.value)}>{DRILL_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Players"><SelectInput value={groupSize} onChange={(event) => setGroupSize(event.target.value)}>{GROUP_SIZES.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Minutes"><TextInput type="number" min={1} value={minutes} onChange={(event) => setMinutes(Math.max(1, Number(event.target.value) || 1))} /></Field><Field label="Style"><SelectInput value={style} onChange={(event) => setStyle(event.target.value)}>{DRILL_STYLES.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field><Field label="Difficulty"><SelectInput value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>{DIFFICULTIES.map((item) => <option key={item}>{item}</option>)}</SelectInput></Field></div>
        <Field label="Skill focus"><div className="flex flex-wrap gap-2">{SKILL_FOCUS.map((item) => <BubbleButton key={item} size="sm" tone={skills.includes(item) ? "grape" : "neutral"} onClick={() => toggle(skills, item, setSkills)}>{item}</BubbleButton>)}</div></Field>
        <Field label="Equipment"><div className="flex flex-wrap gap-2">{EQUIPMENT_OPTIONS.map((item) => <BubbleButton key={item} size="sm" tone={equipment.includes(item) ? "grape" : "neutral"} onClick={() => toggle(equipment, item, setEquipment)}>{item}</BubbleButton>)}</div></Field>
        <Field label="How it runs"><textarea className="min-h-24 w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-2.5 font-semibold text-foreground outline-none focus:border-grape" placeholder="Explain the repetitions and rotations." value={instructions} onChange={(event) => setInstructions(event.target.value)} /></Field>
        <Field label="Intended result"><TextInput placeholder="What should improve or count as success?" value={result} onChange={(event) => setResult(event.target.value)} /></Field>
        {!ready ? <InfoPanel>Add a drill name and how it runs before saving.</InfoPanel> : null}
        <PrimaryCTA><BubbleButton tone="ghost" size="lg" onClick={() => setShowDetails(false)}>Back to Court</BubbleButton><BubbleButton tone="neutral" size="lg" disabled={!ready || save.isPending} onClick={() => save.mutate(false)}>Save Privately</BubbleButton><BubbleButton tone="flame" size="lg" disabled={!ready || save.isPending} onClick={() => save.mutate(true)}>{save.isPending ? "Saving…" : "Save & Publish"}</BubbleButton></PrimaryCTA>
      </Panel>}
    </div>
  </AppShell>;
}