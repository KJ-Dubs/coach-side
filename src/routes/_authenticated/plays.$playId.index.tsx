import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Pause, Play, Undo2 } from "lucide-react";
import {
  BALL_ACTIONS,
  DO_MS,
  SHOW_MS,
  buildSteps,
  defaultBranchSelection,
  findChainConflicts,
  findPassWarnings,
  inferPassReceiver,
  listOptionGroups,
  nearestTokenAt,
  resolveLegacyActors,
  sampleStep,
  sampleTimeline,
  scorePassReceivers,
  stateAtSequenceStart,
  type BranchSelection,
} from "@/lib/playAnimation";

import { simplifyPath, type Point } from "@/lib/playPath";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { CreateMyVersion } from "@/components/CreateMyVersion";
import { fitZoom, outsideCount, type CourtZoom } from "@/components/court/Court";
import { PlayIndexSheet } from "@/components/PlayIndexSheet";
import { EMPTY_INDEX, suggestFromFrames, type PlayIndex } from "@/lib/playIndex";
import { fetchFrames, fetchPlay, saveFrames, updatePlay } from "@/lib/data";
import { useMe } from "@/lib/useMe";
import { fetchCoachLabel, isPlayOwner } from "@/lib/playOwnership";

import {
  PLAY_CATEGORIES,
  normalizeCategory,
  type PlayAction,
  type PlayActionType,
  type PlayFrame,
  type PlayToken,
} from "@/lib/types";

import { uuid } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/plays/$playId/")({
  head: () => ({
    meta: [
      { title: "Play Designer — CoachSide" },
      {
        name: "description",
        content:
          "Place players, mark the ball handler, and draw passes, cuts and screens across multiple frames.",
      },
      { property: "og:title", content: "Play Designer — CoachSide" },
      {
        property: "og:description",
        content: "Place players and draw passes, cuts and screens frame by frame.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayDesignerPage,
});

type Tool = "move" | "ball" | PlayActionType;

type AnimMode = "idle" | "preview" | "replay";

const STEP_MS = SHOW_MS + DO_MS;
const PLAYMAKER_VIEW_KEY = "coachside.playmaker-view";

const DEFAULT_TOKENS: PlayToken[] = [
  { id: "p1", label: "1", x: 0.5, y: 0.5, ball: true, team: "offense" },
  { id: "p2", label: "2", x: 0.62, y: 0.14, ball: false, team: "offense" },
  { id: "p3", label: "3", x: 0.62, y: 0.86, ball: false, team: "offense" },
  { id: "p4", label: "4", x: 0.74, y: 0.32, ball: false, team: "offense" },
  { id: "p5", label: "5", x: 0.74, y: 0.68, ball: false, team: "offense" },
];

/** Offense inbounding against a full court press (attacking right). */
const PRESS_OFFENSE: PlayToken[] = [
  { id: "o1", label: "1", x: 0.12, y: 0.35, ball: true, team: "offense" },
  { id: "o2", label: "2", x: 0.12, y: 0.68, ball: false, team: "offense" },
  { id: "o3", label: "3", x: 0.28, y: 0.16, ball: false, team: "offense" },
  { id: "o4", label: "4", x: 0.3, y: 0.85, ball: false, team: "offense" },
  { id: "o5", label: "5", x: 0.45, y: 0.5, ball: false, team: "offense" },
];

/** 1-2-1-1 full court press defense. */
const PRESS_DEFENSE: PlayToken[] = [
  { id: "d1", label: "1", x: 0.16, y: 0.5, ball: false, team: "defense" },
  { id: "d2", label: "2", x: 0.28, y: 0.24, ball: false, team: "defense" },
  { id: "d3", label: "3", x: 0.28, y: 0.76, ball: false, team: "defense" },
  { id: "d4", label: "4", x: 0.45, y: 0.5, ball: false, team: "defense" },
  { id: "d5", label: "5", x: 0.68, y: 0.5, ball: false, team: "defense" },
];

function blankFrame(playId: string, idx: number): PlayFrame {
  return {
    id: uuid(),
    play_id: playId,
    idx,
    tokens: DEFAULT_TOKENS.map((t) => ({ ...t })),
    actions: [],
    note: null,
  };
}


function PlayDesignerPage() {
  const { playId } = Route.useParams();
  const play = useQuery({ queryKey: ["play", playId], queryFn: () => fetchPlay(playId) });
  const framesQ = useQuery({ queryKey: ["frames", playId], queryFn: () => fetchFrames(playId) });
  const me = useMe();
  const canEdit = play.data ? isPlayOwner(play.data, me.user?.id ?? null) : false;
  const authorLabel = useQuery({
    queryKey: ["coach-label", play.data?.created_by],
    queryFn: () => fetchCoachLabel(play.data?.created_by),
    enabled: !!play.data?.created_by && !canEdit,
  });


  const [frames, setFrames] = useState<PlayFrame[]>([]);
  const [current, setCurrent] = useState(0);
  const [tool, setTool] = useState<Tool>("move");
  const [flip, setFlip] = useState(false);
  const [zoom, setZoom] = useState<CourtZoom>("right");
  const [seqIdx, setSeqIdx] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [mode, setMode] = useState<AnimMode>("idle");
  const [previewComplete, setPreviewComplete] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const courtControlsRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Offense");
  const [saving, setSaving] = useState(false);
  const [index, setIndex] = useState<PlayIndex>(EMPTY_INDEX);
  /** Which option branch is shown for each decision point. */
  const [branch, setBranch] = useState<BranchSelection>({});
  /** A new outcome that clashes with an outcome already in this sequence. */
  const [pendingOption, setPendingOption] = useState<{
    action: PlayAction;
    seq: number;
    rivalId: string;
  } | null>(null);


  useEffect(() => {
    if (framesQ.data) {
      setFrames(
        (framesQ.data.length ? framesQ.data : [blankFrame(playId, 0)]).map((f) =>
          resolveLegacyActors(f),
        ),
      );
    }
  }, [framesQ.data, playId]);

  useEffect(() => {
    if (play.data) {
      setName(play.data.name);
      setCategory(normalizeCategory(play.data.category));
      setFlip(play.data.attack_basket === "left");
      setIndex({
        situation: play.data.situation ?? null,
        defense_faced: play.data.defense_faced ?? null,
        outcome: play.data.outcome ?? null,
        primary_actions: play.data.primary_actions ?? [],
        time_pressure: play.data.time_pressure ?? null,
        tags: play.data.tags ?? [],
      });
    }
  }, [play.data]);

  useEffect(() => {
    const saved = window.localStorage.getItem(PLAYMAKER_VIEW_KEY);
    if (saved === "right" || saved === "left" || saved === "top" || saved === "bottom" || saved === "full") {
      setZoom(saved);
    }
  }, []);

  const chooseZoom = (next: CourtZoom) => {
    setZoom(next);
    window.localStorage.setItem(PLAYMAKER_VIEW_KEY, next);
  };

  const frame = frames[current];
  const toCoords = (p: { x: number; y: number }) => (flip ? { x: 1 - p.x, y: 1 - p.y } : p);

  const patchFrame = (fn: (f: PlayFrame) => PlayFrame) =>
    setFrames((prev) => prev.map((f, i) => (i === current ? fn(f) : f)));

  /* ---- deterministic engine state ---- */

  const optionGroups = useMemo(() => listOptionGroups(frame), [frame]);
  const activeBranch = useMemo<BranchSelection>(
    () => ({ ...defaultBranchSelection(frame), ...branch }),
    [frame, branch],
  );
  const steps = useMemo(() => buildSteps(frame, activeBranch), [frame, activeBranch]);
  const passWarnings = useMemo(() => findPassWarnings(frame, activeBranch), [frame, activeBranch]);
  const seqCount = steps.length;
  const activeIdx = Math.min(seqIdx, seqCount);
  const activeStep = steps[activeIdx];
  const seqNumber = activeStep ? activeStep.seq : (steps[seqCount - 1]?.seq ?? 0) + 1;

  /** Exact court state this sequence begins from. */
  const projected = useMemo(
    () => stateAtSequenceStart(frame, activeIdx, activeBranch),
    [frame, activeIdx, activeBranch],
  );


  const timeline = useMemo(() => ({ steps, totalMs: steps.length * STEP_MS }), [steps]);
  const rangeEnd = mode === "preview" ? (activeIdx + 1) * STEP_MS : timeline.totalMs;
  const live = mode === "idle"
    ? previewComplete && activeStep
      ? { step: activeStep, index: activeIdx, phase: "do" as const, sample: sampleStep(activeStep, "do", 1) }
      : null
    : sampleTimeline(timeline, timeMs);

  useEffect(() => {
    setPreviewComplete(false);
  }, [frame, activeIdx, activeBranch]);

  useEffect(() => {
    setSeqIdx((i) => Math.min(i, seqCount));
  }, [seqCount]);

  useEffect(() => {
    if (mode === "idle") return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setTimeMs((prev) => {
        const next = prev + dt;
        if (next >= rangeEnd) {
          setMode("idle");
          if (mode === "preview") setPreviewComplete(true);
          return rangeEnd - 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, rangeEnd, seqCount]);

  const previewSequence = () => {
    if (!activeStep) return;
    const court = courtControlsRef.current;
    if (court) {
      const bounds = court.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        court.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }
    setPreviewComplete(false);
    setTimeMs(activeIdx * STEP_MS);
    setMode("preview");
  };
  const replayPlay = () => {
    if (seqCount === 0) return;
    setPreviewComplete(false);
    setSeqIdx(0);
    setTimeMs(0);
    setMode("replay");
  };
  const resetPlay = () => {
    setPreviewComplete(false);
    setMode("idle");
    setTimeMs(0);
    setSeqIdx(0);
  };

  /** Tokens the coach can actually see and drag right now. */
  const liveTokens = live ? live.sample.tokens : projected.tokens;

  const bindToken = (p: { x: number; y: number }) => nearestTokenAt(liveTokens, p);

  /* ---- action authoring ---- */

  const OPTION_LABELS = ["Option A", "Option B", "Option C", "Option D", "Option E", "Option F"];

  const addAction = (action: PlayAction, seq: number) => {
    // Two outcomes by the same ball handler in one sequence cannot both happen.
    const rival = (frame?.actions ?? []).find(
      (a) =>
        a.seq === seq &&
        BALL_ACTIONS.has(a.type) &&
        BALL_ACTIONS.has(action.type) &&
        a.actor === action.actor &&
        a.id !== action.id,
    );
    if (rival) {
      setPendingOption({ action, seq, rivalId: rival.id });
      return;
    }
    const conflict = (frame?.actions ?? []).some(
      (a) =>
        a.seq === seq &&
        BALL_ACTIONS.has(a.type) &&
        BALL_ACTIONS.has(action.type) &&
        (a.target === action.actor || a.actor === action.target),
    );
    if (!conflict) {
      patchFrame((f) => ({ ...f, actions: [...f.actions, action] }));
      setSelectedActionId(action.id);
      return;
    }

    const label = liveTokens.find((t) => t.id === action.actor)?.label ?? "that player";
    toast.warning(`#${label} has to receive the ball before this can happen.`, {
      duration: 12000,
      action: {
        label: "Move to next sequence",
        onClick: () => {
          patchFrame((f) => ({
            ...f,
            actions: [
              ...f.actions.map((a) => (a.seq > seq ? { ...a, seq: a.seq + 1 } : a)),
              { ...action, seq: seq + 1 },
            ],
          }));
          setSelectedActionId(action.id);
          setSeqIdx((i) => i + 1);
        },
      },
    });
  };

  const onDown = (raw: { x: number; y: number }) => {
    const p = toCoords(raw);
    if (!frame) return;
    if (mode !== "idle") setMode("idle");
    if (tool === "move") {
      if (activeIdx > 0) {
        toast.info("Go to Sequence 1 to move players into their starting spots.");
        return;
      }
      setDragId(bindToken(p));
      return;
    }
    if (tool === "ball") {
      if (activeIdx > 0) {
        toast.info("Set the starting ball handler on Sequence 1.");
        return;
      }
      const id = bindToken(p);
      if (id) patchFrame((f) => ({ ...f, tokens: f.tokens.map((t) => ({ ...t, ball: t.id === id })) }));
      return;
    }
    setStroke([p]);
  };

  const onMove = (raw: { x: number; y: number }) => {
    const p = toCoords(raw);
    if (dragId) {
      patchFrame((f) => ({
        ...f,
        tokens: f.tokens.map((t) => (t.id === dragId ? { ...t, x: p.x, y: p.y } : t)),
      }));
    } else if (stroke) {
      setStroke([...stroke, p]);
    }
  };

  const onUp = (raw: { x: number; y: number }) => {
    const p = toCoords(raw);
    if (dragId) {
      setDragId(null);
      return;
    }
    if (stroke && tool !== "move" && tool !== "ball") {
      const pts = simplifyPath([...stroke, p]);
      const first = pts[0]!;
      const dist = Math.hypot(p.x - first.x, p.y - first.y);
      setStroke(null);
      if (dist <= 0.03 || !frame) return;
      const actorId = bindToken(first);
      if (!actorId) {
        toast.info("Start the line on a player so CoachSide knows who is doing it.");
        return;
      }
      if (tool === "handoff") {
        const targetId = bindToken(p);
        if (!targetId) {
          toast.info("End a handoff on the player who takes the ball.");
          return;
        }
        addAction(
          {
            id: uuid(),
            type: tool,
            seq: seqNumber,
            points: pts,
            actor: actorId,
            target: targetId,
            transfersBall: true,
          },
          seqNumber,
        );
        return;
      }
      if (tool === "pass") {
        const base: PlayAction = {
          id: uuid(),
          type: tool,
          seq: seqNumber,
          points: pts,
          actor: actorId,
        };
        const receiver = inferPassReceiver(
          projected.tokens,
          frame.actions.filter((action) => action.seq === seqNumber),
          base,
        );
        addAction(
          receiver
            ? { ...base, target: receiver.id, transfersBall: true, passTo: "receiver" }
            : { ...base, transfersBall: false, passTo: "space" },
          seqNumber,
        );
        if (receiver) toast.success(`Pass linked to #${receiver.label}`, { duration: 1800 });
        else toast.info("Pass saved to open space. Possession stays with the passer.", { duration: 3000 });
        return;
      }
      addAction(
        { id: uuid(), type: tool, seq: seqNumber, points: pts, actor: actorId },
        seqNumber,
      );
    }
  };

  const selectedPass = useMemo(
    () => frame?.actions.find((action) => action.id === selectedActionId && action.type === "pass") ?? null,
    [frame?.actions, selectedActionId],
  );
  const selectedPassChoices = useMemo(
    () =>
      selectedPass
        ? scorePassReceivers(
            projected.tokens,
            (frame?.actions ?? []).filter((action) => action.seq === selectedPass.seq),
            selectedPass,
          )
        : [],
    [selectedPass, projected.tokens, frame?.actions],
  );

  const retargetPass = (receiverId: string | null) => {
    if (!selectedPass) return;
    patchFrame((currentFrame) => ({
      ...currentFrame,
      actions: currentFrame.actions.map((action) => {
        if (action.id !== selectedPass.id) return action;
        if (receiverId) {
          return { ...action, target: receiverId, transfersBall: true, passTo: "receiver" };
        }
        const { target: _target, ...withoutTarget } = action;
        return { ...withoutTarget, transfersBall: false, passTo: "space" };
      }),
    }));
  };

  /** Keep both outcomes as labelled options from the same shared state. */
  const commitAsOption = () => {
    const pending = pendingOption;
    const current = frame;
    if (!pending || !current) return;
    setPendingOption(null);
    const rival = current.actions.find((a) => a.id === pending.rivalId);
    const group = rival?.option?.group ?? uuid();
    const keyIdx = rival?.option
      ? new Set(
          current.actions.filter((a) => a.option?.group === group).map((a) => a.option!.key),
        ).size
      : 1;
    const key = String.fromCharCode(97 + keyIdx);
    const next: PlayAction = {
      ...pending.action,
      option: { group, key, label: OPTION_LABELS[keyIdx] ?? `Option ${keyIdx + 1}` },
    };
    patchFrame((f) => ({
      ...f,
      actions: [
        ...f.actions.map((a) =>
          a.id === pending.rivalId && !a.option
            ? { ...a, option: { group, key: "a", label: OPTION_LABELS[0]! } }
            : a,
        ),
        next,
      ],
    }));
    setBranch((b) => ({ ...b, [group]: key }));
    setSelectedActionId(pending.action.id);
  };


  const commitAsReplacement = () => {
    const pending = pendingOption;
    if (!pending) return;
    setPendingOption(null);
    patchFrame((f) => ({
      ...f,
      actions: [...f.actions.filter((a) => a.id !== pending.rivalId), pending.action],
    }));
    setSelectedActionId(pending.action.id);
  };


  /** Commit the play's end state as the frame's new starting positions. */
  const applyEndState = () => {
    const last = steps[steps.length - 1];
    if (!last) return;
    patchFrame((f) => ({ ...f, tokens: last.endTokens.map((t) => ({ ...t })), actions: [] }));
    resetPlay();
    toast.success("Ending positions saved as the new setup");
  };

  const addFrame = (duplicate: boolean) => {
    setFrames((prev) => {
      const base = prev[current];
      const next: PlayFrame =
        duplicate && base
          ? {
              ...base,
              id: uuid(),
              actions: [],
              tokens: base.tokens.map((t) => ({ ...t })),
            }
          : blankFrame(playId, prev.length);
      const out = [...prev];
      out.splice(current + 1, 0, next);
      return out.map((f, i) => ({ ...f, idx: i }));
    });
    setCurrent((c) => c + 1);
  };

  const save = async () => {
    if (!canEdit) {
      toast.error("Only the coach who created this play can change it");
      return;
    }
    setSaving(true);
    try {

      await saveFrames(playId, frames);
      await updatePlay(playId, {
        name,
        category,
        attack_basket: flip ? "left" : "right",
        situation: index.situation,
        defense_faced: index.defense_faced,
        outcome: index.outcome,
        primary_actions: index.primary_actions,
        time_pressure: index.time_pressure,
        tags: index.tags,
        indexed_at: index.situation ? new Date().toISOString() : null,
      } as Partial<typeof play.data & object>);
      toast.success("Play saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasDefense = (frame?.tokens ?? []).some((t) => t.team === "defense");
  const offView = outsideCount(zoom, frame?.tokens ?? []);
  const activeActions = frame?.actions.filter((a) => a.seq === seqNumber) ?? [];
  const sequenceInvalid =
    activeActions.some(
      (a) =>
        !a.actor ||
        (a.type === "handoff" && !a.target) ||
        (a.type === "pass" && !a.target && a.passTo !== "space"),
    ) || findChainConflicts(frame).some((c) => c.seq === seqNumber);
  const activeWarnings = passWarnings.filter((w) => w.seq === seqNumber);

  const undoSequenceAction = () => {
    if (activeActions.length === 0) return;
    setMode("idle");
    setPreviewComplete(false);
    setSelectedActionId(null);
    patchFrame((f) => {
      const mine = f.actions.filter((a) => a.seq === seqNumber);
      const drop = mine[mine.length - 1];
      return drop ? { ...f, actions: f.actions.filter((a) => a.id !== drop.id) } : f;
    });
  };

  const nextSequence = () => {
    if (sequenceInvalid || !activeStep) return;
    setMode("idle");
    setPreviewComplete(false);
    setTimeMs(0);
    setSeqIdx(Math.min(activeIdx + 1, seqCount));
    setSelectedActionId(null);
  };


  const setTokens = (tokens: PlayToken[]) => patchFrame((f) => ({ ...f, tokens }));

  const defenseForView = () => {
    if (zoom === "full") return PRESS_DEFENSE;
    const displayRightSide = zoom === "right" || zoom === "bottom";
    const rightSide = flip ? !displayRightSide : displayRightSide;
    const spots = [
      { x: 0.22, y: 0.5 },
      { x: 0.4, y: 0.24 },
      { x: 0.4, y: 0.76 },
      { x: 0.66, y: 0.36 },
      { x: 0.66, y: 0.64 },
    ];
    return spots.map((spot, i) => ({
      id: `d${i + 1}`,
      label: String(i + 1),
      x: rightSide ? 0.5 + spot.x * 0.5 : spot.x * 0.5,
      y: spot.y,
      ball: false,
      team: "defense" as const,
    }));
  };

  const addDefense = () =>
    patchFrame((f) => ({
      ...f,
      tokens: [
        ...f.tokens.filter((t) => t.team !== "defense"),
        ...defenseForView().map((t) => ({ ...t, id: uuid() })),
      ],
    }));

  const removeDefense = () =>
    patchFrame((f) => ({ ...f, tokens: f.tokens.filter((t) => t.team !== "defense") }));

  const pressSetup = () =>
    setTokens([
      ...PRESS_OFFENSE.map((t) => ({ ...t, id: uuid() })),
      ...PRESS_DEFENSE.map((t) => ({ ...t, id: uuid() })),
    ]);

  const tools: { key: Tool; label: string }[] = [
    { key: "move", label: "Move Players" },
    { key: "ball", label: "Ball Handler" },
    { key: "pass", label: "Pass" },
    { key: "cut", label: "Cut / Move" },
    { key: "curl", label: "Curl Cut" },
    { key: "dribble", label: "Dribble" },
    { key: "screen", label: "Screen" },
    { key: "handoff", label: "Handoff" },
    { key: "shot", label: "Shot" },
  ];


  return (
    <AppShell
      wide
      title="Play Designer"
      subtitle="Drag players, drag to draw actions, build frames"
      backTo="/plays"
      backLabel="Playbook"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/plays" search={{ category: normalizeCategory(category) }}>
            <BubbleButton size="sm" tone="ghost">
              ← Exit to Playbook
            </BubbleButton>
          </Link>
          <Link to="/plays/$playId/view" params={{ playId }}>
            <BubbleButton size="sm" tone="neutral">
              Slideshow
            </BubbleButton>
          </Link>
          {canEdit ? (
            <BubbleButton size="sm" tone="flame" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save Play"}
            </BubbleButton>
          ) : play.data ? (
            <CreateMyVersion play={play.data} label="Edit as My Version" />
          ) : null}
        </div>
      }
    >
      {!canEdit && play.data ? (
        <Note>
          {authorLabel.data
            ? `This play was created by ${authorLabel.data}. To edit it, CoachSide will create your own version. The original will stay unchanged.`
            : "This play is read-only. Create your own version to make changes."}
        </Note>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">

        <div className="flex min-w-0 flex-col gap-3">
          <div ref={courtControlsRef} className="flex min-w-0 flex-col gap-2">
          <PlayCanvas
            className={`mx-auto ${zoom === "full" ? "max-w-[calc(48svh*1.88)]" : zoom === "top" || zoom === "bottom" ? "max-w-[calc(48svh*1.064)]" : "max-w-[calc(48svh*0.94)]"}`}
            frame={frame}
            flip={flip}
            zoom={zoom}
            ghost={stroke}
            tokens={live ? live.sample.tokens : projected.tokens}
            ball={live ? live.sample.ball : projected.ball}
            actions={live ? live.step.actions : (activeStep?.actions ?? [])}
            activeSeq={live ? live.step.seq : seqNumber}
            dimOtherActions
            {...(selectedActionId ? { selectedActionId } : {})}
            onCourtPoint={onDown}
            onCourtPointerMove={onMove}
            onCourtPointerUp={onUp}
          />
          <Panel
            aria-label="Sequence controls"
            className="flex min-w-0 items-center gap-1.5 p-2 sm:gap-3"
          >
            <BubbleButton
              size="sm"
              tone="flame"
              className="h-11 w-11 shrink-0 p-0"
              aria-label={mode === "preview" ? "Stop sequence preview" : "Preview current sequence"}
              title={mode === "preview" ? "Stop sequence preview" : "Preview current sequence"}
              disabled={!activeStep?.actions.length}
              onClick={() => mode === "preview" ? setMode("idle") : previewSequence()}
            >
              {mode === "preview" ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
            </BubbleButton>
            <BubbleButton
              size="sm"
              tone="neutral"
              className="h-11 w-11 shrink-0 p-0"
              aria-label="Undo last action in current sequence"
              title="Undo last action in current sequence"
              disabled={!canEdit || activeActions.length === 0}
              onClick={undoSequenceAction}
            >
              <Undo2 className="size-5" aria-hidden />
            </BubbleButton>
            <BubbleButton
              size="sm"
              tone="grape"
              className="min-h-11 min-w-0 gap-1 px-2 text-xs sm:px-4 sm:text-sm"
              disabled={sequenceInvalid || !activeStep}
              title={sequenceInvalid ? "Finish or repair this sequence first" : "Next Sequence"}
              onClick={nextSequence}
            >
              Next Sequence <ArrowRight className="size-4 shrink-0" aria-hidden />
            </BubbleButton>
            <Pill
              tone="muted"
              className="ml-auto shrink-0 whitespace-nowrap px-2 tracking-normal"
              aria-label={`Sequence ${activeIdx + 1} of ${Math.max(seqCount, activeIdx + 1)}`}
              aria-live="polite"
            >
              {activeIdx + 1} of {Math.max(seqCount, activeIdx + 1)}
            </Pill>
          </Panel>
          </div>
          {selectedPass ? (
            <Panel className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label>Selected pass</Label>
                <Pill tone={selectedPass.passTo === "space" ? "muted" : "grape"}>
                  {selectedPass.passTo === "space"
                    ? "Open space · no possession change"
                    : `Receiver #${liveTokens.find((token) => token.id === selectedPass.target)?.label ?? "?"}`}
                </Pill>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPassChoices.map((receiver) => (
                  <BubbleButton
                    key={receiver.id}
                    size="sm"
                    tone={selectedPass.target === receiver.id ? "flame" : "neutral"}
                    onClick={() => retargetPass(receiver.id)}
                  >
                    #{receiver.label}
                  </BubbleButton>
                ))}
                <BubbleButton
                  size="sm"
                  tone={selectedPass.passTo === "space" ? "grape" : "ghost"}
                  onClick={() => retargetPass(null)}
                >
                  Open space
                </BubbleButton>
              </div>
            </Panel>
          ) : null}
          {pendingOption ? (
            <Panel className="flex flex-col gap-3">
              <Label>Add as another option?</Label>
              <Pill tone="muted">
                This player already has an outcome in this sequence. Options are alternatives from
                the same starting point, and only one runs at a time.
              </Pill>
              <div className="flex flex-wrap gap-2">
                <BubbleButton size="sm" tone="flame" onClick={commitAsOption}>
                  Add Option
                </BubbleButton>
                <BubbleButton size="sm" tone="grape" onClick={commitAsReplacement}>
                  Replace Current Action
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" onClick={() => setPendingOption(null)}>
                  Cancel
                </BubbleButton>
              </div>
            </Panel>
          ) : null}
          {optionGroups.length ? (
            <Panel className="flex flex-col gap-3">
              <Label>Options</Label>
              {optionGroups.map((g, gi) => (
                <div key={g.group} className="flex flex-wrap items-center gap-2">
                  <Pill tone="muted">{`Decision ${gi + 1} · sequence ${g.seq}`}</Pill>
                  {g.branches.map((b) => (
                    <BubbleButton
                      key={b.key}
                      size="sm"
                      tone={activeBranch[g.group] === b.key ? "flame" : "neutral"}
                      onClick={() => {
                        setBranch((prev) => ({ ...prev, [g.group]: b.key }));
                        setMode("idle");
                        setTimeMs(0);
                        setSeqIdx(0);
                        setSelectedActionId(null);
                      }}
                    >
                      {b.label}
                    </BubbleButton>
                  ))}
                  <BubbleButton
                    size="sm"
                    tone="ghost"
                    onClick={() => {
                      const key = activeBranch[g.group];
                      const drop = g.branches.find((b) => b.key === key);
                      if (!drop) return;
                      patchFrame((f) => ({
                        ...f,
                        actions: f.actions.filter((a) => !drop.actionIds.includes(a.id)),
                      }));
                      setBranch((prev) => {
                        const next = { ...prev };
                        delete next[g.group];
                        return next;
                      });
                    }}
                  >
                    Delete shown option
                  </BubbleButton>
                </div>
              ))}
            </Panel>
          ) : null}
          {activeWarnings.length ? (
            <Panel className="flex flex-col gap-2">
              <Label>Check this pass</Label>
              {activeWarnings.map((w) => (
                <Pill key={w.actionId} tone="flame">
                  {w.message}
                </Pill>
              ))}
            </Panel>
          ) : null}
          <Panel className="flex flex-col gap-3">

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Label>Tools</Label>
              <Pill tone="grape">Sequence {activeIdx + 1}</Pill>
            </div>
            <div className="flex flex-wrap gap-2">
              {tools.map((t) => (
                <BubbleButton
                  key={t.key}
                  size="sm"
                  tone={tool === t.key ? "grape" : "neutral"}
                  onClick={() => setTool(t.key)}
                >
                  {t.label}
                </BubbleButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <BubbleButton size="sm" tone="grape" disabled={hasDefense} onClick={addDefense}>
                Add Defense
              </BubbleButton>
              <BubbleButton size="sm" tone="ghost" disabled={!hasDefense} onClick={removeDefense}>
                Remove Defense
              </BubbleButton>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Label>Court view</Label>
              {([
                ["right", "Right"],
                ["left", "Left"],
                ["top", "Top"],
                ["bottom", "Bottom"],
                ["full", "Full"],
              ] as const).map(([key, label]) => (
                <BubbleButton key={key} size="sm" tone={zoom === key ? "flame" : "neutral"} onClick={() => chooseZoom(key)}>
                  {label}
                </BubbleButton>
              ))}
              {offView > 0 ? (
                <>
                  <Pill tone="flame">{offView} off this view</Pill>
                  <BubbleButton size="sm" tone="grape" onClick={() => chooseZoom(fitZoom(frame?.tokens ?? []))}>
                    Fit players
                  </BubbleButton>
                </>
              ) : null}
            </div>
            <Pill tone={sequenceInvalid ? "flame" : "muted"}>
              {sequenceInvalid
                ? "Finish or repair this sequence before starting the next one."
                : `Draw together in sequence ${activeIdx + 1}, then start the next sequence.`}
            </Pill>
            {activeStep?.actions.length ? (
              <div className="flex flex-wrap gap-2">
                {activeStep.actions.map((a) => (
                  <BubbleButton
                    key={a.id}
                    size="sm"
                    tone={selectedActionId === a.id ? "flame" : "ghost"}
                    onClick={() => setSelectedActionId(selectedActionId === a.id ? null : a.id)}
                  >
                    {`#${liveTokens.find((t) => t.id === a.actorId)?.label ?? "?"} ${a.type}`}
                  </BubbleButton>
                ))}
              </div>
            ) : null}
          </Panel>
          <Panel className="flex flex-wrap items-center gap-2">
            <Label>Sequences</Label>
            {steps.map((s, i) => (
              <BubbleButton
                key={s.seq}
                size="sm"
                tone={i === activeIdx && mode === "idle" ? "grape" : "neutral"}
                onClick={() => {
                  setMode("idle");
                  setTimeMs(0);
                  setSeqIdx(i);
                  setSelectedActionId(null);
                }}
              >
                {i + 1}
              </BubbleButton>
            ))}
            <Pill tone="muted">
              {activeIdx === seqCount
                ? "Drawing a new sequence from the end of the play"
                : `Court shows the start of sequence ${activeIdx + 1}`}
            </Pill>
          </Panel>
          <Panel className="flex flex-wrap items-center gap-2">
            <Label>Animate</Label>
            <BubbleButton
              size="sm"
              tone="grape"
              disabled={seqCount === 0}
              onClick={() => (mode === "replay" ? setMode("idle") : replayPlay())}
            >
              {mode === "replay" ? "❚❚ Pause" : "↻ Replay Play"}
            </BubbleButton>
            <BubbleButton size="sm" tone="neutral" onClick={resetPlay}>
              ⟲ Reset Play
            </BubbleButton>
            <BubbleButton size="sm" tone="ghost" disabled={seqCount === 0} onClick={applyEndState}>
              Use End Positions
            </BubbleButton>
            <Pill tone={live ? "grape" : "muted"}>
              {live
                ? `Sequence ${live.index + 1} · ${live.phase === "show" ? "Showing paths" : "Running"}`
                : `${seqCount} sequence${seqCount === 1 ? "" : "s"} ready`}
            </Pill>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          {canEdit ? (
            <PlayIndexSheet value={index} onChange={setIndex} suggestions={suggestFromFrames(frames, flip ? "left" : "right")} compact />
          ) : null}
          <Panel className="flex flex-col gap-2">
            <Label>Press Maker · Two Teams</Label>
            <div className="flex flex-wrap gap-2">
              <BubbleButton size="sm" tone="flame" onClick={pressSetup}>
                Full Court Press Setup
              </BubbleButton>
            </div>
            <Pill tone="muted">
              Purple circles = offense · dashed orange squares X1–X5 = defense
            </Pill>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Orientation</Label>

            <div className="flex flex-wrap gap-2">
              <BubbleButton size="sm" tone="flame" onClick={() => setFlip((f) => !f)}>
                ⇄ Flip Court
              </BubbleButton>
              <BubbleButton size="sm" tone={!flip ? "grape" : "neutral"} onClick={() => setFlip(false)}>
                Attack Right
              </BubbleButton>
              <BubbleButton size="sm" tone={flip ? "grape" : "neutral"} onClick={() => setFlip(true)}>
                Attack Left
              </BubbleButton>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Frames</Label>
            <div className="flex flex-wrap gap-2">
              {frames.map((f, i) => (
                <BubbleButton
                  key={f.id}
                  size="sm"
                  tone={i === current ? "grape" : "neutral"}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}
                </BubbleButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <BubbleButton size="sm" tone="flame" onClick={() => addFrame(true)}>
                Duplicate Frame
              </BubbleButton>
              <BubbleButton size="sm" tone="neutral" onClick={() => addFrame(false)}>
                Blank Frame
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone="ghost"
                disabled={frames.length <= 1}
                onClick={() => {
                  setFrames((prev) => prev.filter((_, i) => i !== current).map((f, i) => ({ ...f, idx: i })));
                  setCurrent((c) => Math.max(0, c - 1));
                }}
              >
                Delete Frame
              </BubbleButton>
            </div>
            <input
              className="rounded-2xl border border-input bg-surface-2/70 px-4 py-2 text-sm font-semibold outline-none focus:border-grape"
              placeholder="Frame note (what happens here)"
              value={frame?.note ?? ""}
              onChange={(e) => patchFrame((f) => ({ ...f, note: e.target.value }))}
            />
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Play details</Label>
            <input
              className="rounded-2xl border border-input bg-surface-2/70 px-4 py-2 text-sm font-semibold outline-none focus:border-grape"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {PLAY_CATEGORIES.map((c) => (
                <BubbleButton
                  key={c}
                  size="sm"
                  tone={category === c ? "grape" : "neutral"}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </BubbleButton>
              ))}
            </div>
            <Pill tone="muted">
              Legend: dotted = pass · solid arrow = cut · curved arrow = curl cut · bumpy line =
              dribble · bar end = screen
            </Pill>

          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
