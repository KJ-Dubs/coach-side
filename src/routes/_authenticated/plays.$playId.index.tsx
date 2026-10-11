import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, MoreHorizontal, Pause, Play, Undo2 } from "lucide-react";
import {
  BALL_ACTIONS,
  DO_MS,
  SHOW_MS,
  findChainConflicts,
  findPassWarnings,
  inferPassReceiver,
  listOptionGroups,
  nearestTokenAt,
  sampleStep,
  sampleTimeline,
  scorePassReceivers,
  type OptionGroup,
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
import {
  EMPTY_INDEX,
  indexToRow,
  normalizeIndex,
  suggestFromFrames,
  type PlayIndex,
} from "@/lib/playIndex";
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
import {
  MAX_OPTIONS,
  addOptionBranch,
  conflictToOption,
  createOptionPoint,
  deleteBranchSequence,
  deleteOptionBranch,
  duplicateOptionBranch,
  insertSequenceAfter,
  optionForSeq,
  optionLetter,
  nextOptionKey,
  updateOptionBranch,
} from "@/lib/playOptions";
import { buildSequentialSteps, mainEndState } from "@/lib/playSequence";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addHalfCourtDefense } from "@/lib/playDefense";

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
  const [showSeqPicker, setShowSeqPicker] = useState(false);
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
  /** A new outcome that clashes with an outcome already in this sequence. */
  const [pendingOption, setPendingOption] = useState<{
    action: PlayAction;
    seq: number;
    rivalId: string;
  } | null>(null);
  /** Compact Add Option sheet (new option point, or another option at an existing point). */
  const [optionSheet, setOptionSheet] = useState<{
    group: string;
    key: string;
    anchorSeq: number;
    label: string;
    condition: string;
  } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ group: string; key: string } | null>(
    null,
  );

  useEffect(() => {
    if (framesQ.data) {
      setFrames(framesQ.data.length ? framesQ.data : [blankFrame(playId, 0)]);
    }
  }, [framesQ.data, playId]);

  useEffect(() => {
    if (play.data) {
      setName(play.data.name);
      setCategory(normalizeCategory(play.data.category));
      setFlip(play.data.attack_basket === "left");
      setIndex(normalizeIndex(play.data));
    }
  }, [play.data]);

  useEffect(() => {
    const saved = window.localStorage.getItem(PLAYMAKER_VIEW_KEY);
    if (
      saved === "right" ||
      saved === "left" ||
      saved === "top" ||
      saved === "bottom" ||
      saved === "full"
    ) {
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
  const steps = useMemo(() => buildSequentialSteps(frame), [frame]);
  const seqCount = steps.length;
  const activeIdx = Math.min(seqIdx, seqCount);
  const activeStep = steps[activeIdx];
  const nextMainSeq =
    Math.max(0, ...(frame?.actions.filter((a) => !a.option).map((a) => a.seq) ?? [])) + 1;
  const seqNumber = activeStep?.seq ?? nextMainSeq;
  const projected = activeStep ? sampleStep(activeStep, "show", 0) : mainEndState(frame);
  const branchGroup = optionGroups.find((g) => g.group === activeStep?.option?.group) ?? null;
  const branchKey = activeStep?.option?.key ?? null;
  const optionAnchorSeq = activeStep?.option?.anchorSeq ?? seqNumber;
  const contextGroup = branchGroup ?? optionGroups.find((g) => g.seq === optionAnchorSeq) ?? null;
  const nextSiblingKey = frame && contextGroup ? nextOptionKey(frame, contextGroup.group) : "a";
  const optionButtonLabel = `+${optionAnchorSeq}${nextSiblingKey ? optionLetter(nextSiblingKey) : ""}`;
  const activeBranch: BranchSelection =
    branchGroup && branchKey ? { [branchGroup.group]: branchKey } : {};
  const visibleActions = activeStep
    ? (frame?.actions ?? []).filter((a) => activeStep.actions.some((st) => st.id === a.id))
    : [];
  const passWarnings = findPassWarnings(frame, activeBranch).filter((w) =>
    visibleActions.some((a) => a.id === w.actionId),
  );
  const stepName = (i: number) => steps[i]?.label ?? String(nextMainSeq);
  const seqTotal = Math.max(seqCount, activeIdx + 1);
  const seqStatus = (pos: number) => stepName(pos);
  const pointIdx = (g: OptionGroup) => {
    const i = steps.findIndex((st) => st.option?.group === g.group);
    return i < 0 ? steps.length : i;
  };
  useEffect(() => {
    if (!pendingSelection) return;
    const i = steps.findIndex(
      (st) => st.option?.group === pendingSelection.group && st.option.key === pendingSelection.key,
    );
    if (i >= 0) {
      setSeqIdx(i);
      setPendingSelection(null);
    }
  }, [steps, pendingSelection]);

  const timeline = useMemo(() => ({ steps, totalMs: steps.length * STEP_MS }), [steps]);
  const rangeEnd = mode === "preview" ? (activeIdx + 1) * STEP_MS : timeline.totalMs;
  const live =
    mode === "idle"
      ? previewComplete && activeStep
        ? {
            step: activeStep,
            index: activeIdx,
            phase: "do" as const,
            sample: sampleStep(activeStep, "do", 1),
          }
        : null
      : sampleTimeline(timeline, timeMs);

  useEffect(() => {
    setPreviewComplete(false);
  }, [frame, activeIdx]);

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

  const addAction = (drawn: PlayAction, seq: number) => {
    const opt =
      frame && branchGroup && branchKey
        ? optionForSeq(frame, branchGroup.group, branchKey, seq)
        : undefined;
    const action: PlayAction = opt ? { ...drawn, option: opt } : drawn;
    // Two outcomes by the same ball handler in one sequence cannot both happen.
    const rival = visibleActions.find(
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
    const conflict = visibleActions.some(
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
          patchFrame((f) => {
            const shifted = insertSequenceAfter(
              f,
              seq,
              opt ? { group: opt.group, key: opt.key } : undefined,
            );
            const moved: PlayAction = opt
              ? { ...action, seq: seq + 1, option: { ...opt, branchSeq: (opt.branchSeq ?? 1) + 1 } }
              : { ...action, seq: seq + 1 };
            return { ...shifted, actions: [...shifted.actions, moved] };
          });
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
      if (id)
        patchFrame((f) => ({ ...f, tokens: f.tokens.map((t) => ({ ...t, ball: t.id === id })) }));
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
          visibleActions.filter((action) => action.seq === seqNumber),
          base,
        );
        addAction(
          receiver
            ? { ...base, target: receiver.id, transfersBall: true, passTo: "receiver" }
            : { ...base, transfersBall: false, passTo: "space" },
          seqNumber,
        );
        if (receiver) toast.success(`Pass linked to #${receiver.label}`, { duration: 1800 });
        else
          toast.info("Pass saved to open space. Possession stays with the passer.", {
            duration: 3000,
          });
        return;
      }
      addAction({ id: uuid(), type: tool, seq: seqNumber, points: pts, actor: actorId }, seqNumber);
    }
  };

  const selectedPass = useMemo(
    () =>
      frame?.actions.find((action) => action.id === selectedActionId && action.type === "pass") ??
      null,
    [frame?.actions, selectedActionId],
  );
  const selectedPassChoices = useMemo(
    () =>
      selectedPass
        ? scorePassReceivers(
            projected.tokens,
            visibleActions.filter((action) => action.seq === selectedPass.seq),
            selectedPass,
          )
        : [],
    [selectedPass, projected.tokens, visibleActions],
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

  /** Turn the clashing outcome into a proper OPTION point at this sequence. */
  const commitAsOption = () => {
    const pending = pendingOption;
    if (!pending || !frame) return;
    setPendingOption(null);
    const res = conflictToOption(frame, pending.rivalId, pending.action, uuid);
    if (!res) {
      toast.info(`An option point holds up to ${MAX_OPTIONS} options.`);
      return;
    }
    patchFrame(() => res.frame);
    setPendingSelection({ group: res.group, key: res.key });
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
        ...indexToRow(index),
        indexed_at:
          index.concepts.length ||
          index.defenses.length ||
          index.outcomes.length ||
          index.primary_actions.length
            ? new Date().toISOString()
            : (play.data?.indexed_at ?? null),
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
  const activeActions = visibleActions.filter((a) => a.seq === seqNumber);
  const sequenceInvalid =
    activeActions.some(
      (a) =>
        !a.actor ||
        (a.type === "handoff" && !a.target) ||
        (a.type === "pass" && !a.target && a.passTo !== "space"),
    ) ||
    findChainConflicts(frame ? { ...frame, actions: visibleActions } : undefined).some(
      (c) => c.seq === seqNumber,
    );
  const activeWarnings = passWarnings.filter((w) => w.seq === seqNumber);

  const undoSequenceAction = () => {
    if (activeActions.length === 0) return;
    setMode("idle");
    setPreviewComplete(false);
    setSelectedActionId(null);
    const drop = activeActions[activeActions.length - 1];
    if (drop) patchFrame((f) => ({ ...f, actions: f.actions.filter((a) => a.id !== drop.id) }));
  };

  const goToSequence = (i: number) => {
    setMode("idle");
    setPreviewComplete(false);
    setTimeMs(0);
    setSeqIdx(Math.max(0, Math.min(i, seqCount)));
    setSelectedActionId(null);
  };

  const deleteSequence = () => {
    if (!activeStep || seqCount <= 1) return;
    if (!window.confirm(`Delete sequence ${stepName(activeIdx)} and all of its actions?`)) return;
    const target = seqNumber;
    if (branchGroup && branchKey) {
      patchFrame((f) => deleteBranchSequence(f, branchGroup.group, branchKey, target, uuid));
      goToSequence(Math.max(0, activeIdx - 1));
      setShowSeqPicker(false);
      return;
    }
    patchFrame((f) => ({
      ...f,
      actions: f.actions
        .filter((a) => a.option || a.seq !== target)
        .map((a) => (a.seq > target ? { ...a, seq: a.seq - 1 } : a)),
    }));
    goToSequence(Math.max(0, activeIdx - 1));
    setShowSeqPicker(false);
  };

  const nextSequence = () => {
    if (sequenceInvalid || !activeStep) return;
    setMode("idle");
    setPreviewComplete(false);
    setTimeMs(0);
    setSeqIdx(Math.min(activeIdx + 1, seqCount));
    setSelectedActionId(null);
  };

  /* ---- OPTION authoring ---- */

  const openAddOption = () => {
    if (!frame || !canEdit || optionSheet) return;
    setShowSeqPicker(false);
    const g = contextGroup;
    if (g && g.branches.length >= MAX_OPTIONS) {
      toast.info(`An OPTION holds up to ${MAX_OPTIONS} options.`);
      return;
    }
    const res = g
      ? addOptionBranch(frame, g.group, "", "", uuid)
      : createOptionPoint(frame, optionAnchorSeq, "", "", uuid);
    if (!res) return;
    const groupId = g?.group ?? ("group" in res ? res.group : null);
    if (typeof groupId !== "string") return;
    patchFrame(() => res.frame);
    setOptionSheet({ group: groupId, key: res.key, anchorSeq: optionAnchorSeq, label: "", condition: "" });
    setMode("idle");
    setPreviewComplete(false);
    setSelectedActionId(null);
  };
  const createOption = () => {
    if (!frame || !optionSheet) return;
    const { group, key, label, condition } = optionSheet;
    patchFrame((f) => updateOptionBranch(f, group, key, { label, condition }));
    setPendingSelection({ group, key });
    setOptionSheet(null);
    setMode("idle");
    setPreviewComplete(false);
    setSelectedActionId(null);
  };

  const editShownOption = (what: "label" | "condition") => {
    if (!contextGroup) return;
    const key = branchKey;
    const b = contextGroup.branches.find((x) => x.key === key);
    if (!b || !key) return;
    const value = window.prompt(
      what === "label" ? "Option name" : "Condition / coaching cue (optional)",
      what === "label" ? b.label : (b.condition ?? ""),
    );
    if (value === null) return;
    patchFrame((f) => updateOptionBranch(f, contextGroup.group, key, { [what]: value }));
  };

  const duplicateShownOption = () => {
    if (!contextGroup || !frame) return;
    const key = branchKey;
    const res = key ? duplicateOptionBranch(frame, contextGroup.group, key, uuid) : null;
    if (!res) {
      toast.info(`An option point holds up to ${MAX_OPTIONS} options.`);
      return;
    }
    patchFrame(() => res.frame);
    setPendingSelection({ group: contextGroup.group, key: res.key });
  };

  const deleteShownOption = () => {
    if (!contextGroup) return;
    const key = branchKey;
    const b = contextGroup.branches.find((x) => x.key === key);
    if (!b || !key) return;
    if (
      !window.confirm(
        `Delete Option ${optionLetter(key)} — ${b.label}? Shared sequences and other options stay.`,
      )
    )
      return;
    const point = pointIdx(contextGroup);
    patchFrame((f) => deleteOptionBranch(f, contextGroup.group, key));
    goToSequence(Math.max(0, point - 1));
  };

  const setTokens = (tokens: PlayToken[]) => patchFrame((f) => ({ ...f, tokens }));

  const addDefense = () =>
    patchFrame((f) => {
      const tokens = addHalfCourtDefense(f.tokens, zoom, flip, uuid, liveTokens);
      return tokens === f.tokens ? f : { ...f, tokens };
    });

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
    { key: "dribble", label: "Dribble" },
    { key: "screen", label: "Screen" },
    { key: "shot", label: "Shot" },
  ];

  return (
    <AppShell
      wide
      compact
      title="Play Designer"
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
      <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div ref={courtControlsRef} className="flex w-full min-w-0 flex-col gap-1">
            <div className="relative">
              <PlayCanvas
                className="mx-auto w-full max-w-full"
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
            </div>
            <Panel
              aria-label="Sequence controls"
              className="grid min-w-0 grid-cols-[44px_44px_44px_minmax(44px,1fr)_minmax(44px,auto)_minmax(44px,auto)] items-center gap-1 p-1 sm:gap-2"
            >
              <BubbleButton
                size="sm"
                tone="flame"
                className="h-11 w-11 shrink-0 p-0"
                aria-label={mode === "replay" ? "Stop full play" : "Play full play from sequence 1"}
                title={mode === "replay" ? "Stop full play" : "Play full play from sequence 1"}
                disabled={seqCount === 0}
                onClick={() => (mode === "replay" ? setMode("idle") : replayPlay())}
              >
                {mode === "replay" ? (
                  <Pause className="size-5" aria-hidden />
                ) : (
                  <Play className="size-5 fill-current" aria-hidden />
                )}
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone="neutral"
                className="h-11 w-11 shrink-0 p-0"
                aria-label="Undo last action in selected sequence"
                title="Undo last action in selected sequence"
                disabled={!canEdit || activeActions.length === 0}
                onClick={undoSequenceAction}
              >
                <Undo2 className="size-5" aria-hidden />
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone="neutral"
                className="h-11 w-11 shrink-0 p-0"
                aria-label="Previous sequence"
                title="Previous sequence"
                disabled={activeIdx === 0}
                onClick={() => goToSequence(activeIdx - 1)}
              >
                <ArrowLeft className="size-5" aria-hidden />
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone="grape"
                className="h-11 min-w-11 gap-1 px-1 text-xs sm:px-2 sm:text-sm"
                disabled={activeIdx >= seqCount - 1 && (sequenceInvalid || !activeStep)}
                title={sequenceInvalid ? "Finish or repair this sequence first" : "Next Sequence"}
                onClick={() =>
                  activeIdx < seqCount - 1 ? goToSequence(activeIdx + 1) : nextSequence()
                }
              >
                <span>Next</span>
                <ArrowRight className="hidden size-4 shrink-0 sm:block" aria-hidden />
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone="flame"
                className="h-11 min-w-11 whitespace-nowrap px-2 text-xs sm:text-sm"
                aria-label={nextSiblingKey ? `Add option ${optionAnchorSeq}${optionLetter(nextSiblingKey)}` : "Option limit reached"}
                title={nextSiblingKey ? `Add option ${optionAnchorSeq}${optionLetter(nextSiblingKey)}` : "Option limit reached"}
                disabled={!canEdit || !nextSiblingKey || !!optionSheet}
                onClick={openAddOption}
              >
                {optionButtonLabel}
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone="ghost"
                className="h-11 min-w-11 shrink-0 px-1"
                aria-label={`Sequence ${seqStatus(activeIdx)}. Open sequence picker`}
                aria-expanded={showSeqPicker}
                onClick={() => setShowSeqPicker((v) => !v)}
              >
                <Pill
                  tone={showSeqPicker ? "grape" : "muted"}
                  className="whitespace-nowrap px-2 tracking-normal"
                  aria-live="polite"
                >
                  {seqStatus(live && mode === "replay" ? live.index : activeIdx)} ▾
                </Pill>
              </BubbleButton>
            </Panel>
            {showSeqPicker ? (
              <Panel
                aria-label="Sequence picker"
                className="flex flex-wrap items-center gap-1.5 p-2"
              >
                {Array.from({ length: seqTotal }, (_, i) => (
                  <BubbleButton
                    key={i}
                    size="sm"
                    tone={i === activeIdx ? "grape" : "neutral"}
                    className="h-11 min-w-11 px-2"
                    onClick={() => goToSequence(i)}
                  >
                    {stepName(i)}
                  </BubbleButton>
                ))}
                <span className="mx-1 h-6 w-px bg-border" aria-hidden />
                <BubbleButton
                  size="sm"
                  tone="ghost"
                  className="min-h-11"
                  disabled={!activeStep?.actions.length}
                  onClick={() => (mode === "preview" ? setMode("idle") : previewSequence())}
                >
                  {mode === "preview" ? "Stop" : "Preview this"}
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" className="min-h-11" onClick={resetPlay}>
                  Reset
                </BubbleButton>
                <BubbleButton
                  size="sm"
                  tone="ghost"
                  className="min-h-11"
                  disabled={seqCount === 0}
                  onClick={applyEndState}
                >
                  Use End Positions
                </BubbleButton>
                <BubbleButton
                  size="sm"
                  tone="ghost"
                  className="min-h-11"
                  disabled={!canEdit || !activeStep || seqCount <= 1}
                  onClick={deleteSequence}
                >
                  Delete Sequence
                </BubbleButton>
              </Panel>
            ) : null}
            {optionSheet ? (
              <Panel aria-label="Add option" className="flex flex-col gap-2 p-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Option name</Label>
                  <Pill tone="grape">
                    {`${optionSheet.anchorSeq}${optionLetter(optionSheet.key)}`}
                  </Pill>
                </div>
                <input
                  autoFocus
                  aria-label="Option name"
                  placeholder="Option name, e.g. Shoot 3"
                  maxLength={40}
                  className="min-h-11 rounded-2xl border border-input bg-surface-2/70 px-3 text-sm font-semibold outline-none focus:border-grape"
                  value={optionSheet.label}
                  onChange={(e) => setOptionSheet({ ...optionSheet, label: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <BubbleButton size="sm" tone="flame" className="min-h-11" onClick={createOption}>
                    Save
                  </BubbleButton>
                  <BubbleButton
                    size="sm"
                    tone="ghost"
                    className="min-h-11"
                    onClick={() => {
                      patchFrame((f) => deleteOptionBranch(f, optionSheet.group, optionSheet.key));
                      setOptionSheet(null);
                    }}
                  >
                    Cancel
                  </BubbleButton>
                </div>
              </Panel>
            ) : null}
            {branchGroup && branchKey && !optionSheet ? (
              <div className="flex min-w-0 items-center gap-1">
                <Pill tone="flame" className="shrink-0">
                  OPTION
                </Pill>
                <Pill tone="muted" className="min-w-0 flex-1 truncate normal-case tracking-normal">
                  {stepName(activeIdx)} ·{" "}
                  {branchGroup.branches.find((b) => b.key === branchKey)?.label}
                </Pill>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <BubbleButton
                        size="sm"
                        tone="ghost"
                        className="h-11 w-11 shrink-0 p-0"
                        aria-label="Option menu"
                      >
                        <MoreHorizontal className="size-5" aria-hidden />
                      </BubbleButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => editShownOption("label")}
                      >
                        Rename Option
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => editShownOption("condition")}
                      >
                        Edit Condition
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11" onSelect={duplicateShownOption}>
                        Duplicate Option
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11" onSelect={deleteShownOption}>
                        Delete Option
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ) : null}
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
              <Label>Create as Option?</Label>
              <Pill tone="muted">
                This player already has an outcome in this sequence. An OPTION starts here from the
                same court. Play shows every OPTION automatically.
              </Pill>
              <div className="flex flex-wrap gap-2">
                <BubbleButton size="sm" tone="flame" onClick={commitAsOption}>
                  Create as Option
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
              <Pill tone="grape">Sequence {stepName(activeIdx)}</Pill>
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
              {(
                [
                  ["right", "Right"],
                  ["left", "Left"],
                  ["top", "Top"],
                  ["bottom", "Bottom"],
                  ["full", "Full"],
                ] as const
              ).map(([key, label]) => (
                <BubbleButton
                  key={key}
                  size="sm"
                  tone={zoom === key ? "flame" : "neutral"}
                  onClick={() => chooseZoom(key)}
                >
                  {label}
                </BubbleButton>
              ))}
              {offView > 0 ? (
                <>
                  <Pill tone="flame">{offView} off this view</Pill>
                  <BubbleButton
                    size="sm"
                    tone="grape"
                    onClick={() => chooseZoom(fitZoom(frame?.tokens ?? []))}
                  >
                    Fit players
                  </BubbleButton>
                </>
              ) : null}
            </div>
            <Pill tone={sequenceInvalid ? "flame" : "muted"}>
              {sequenceInvalid
                ? "Finish or repair this sequence before starting the next one."
                : `Draw together in sequence ${stepName(activeIdx)}, then start the next sequence.`}
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
        </div>

        <div className="flex flex-col gap-3">
          {canEdit ? (
            <PlayIndexSheet
              value={index}
              onChange={setIndex}
              suggestions={suggestFromFrames(frames, flip ? "left" : "right")}
              compact
            />
          ) : null}
          {frames.length > 1 ? (
            <details className="rounded-2xl border border-border bg-surface-2/50 p-2">
              <summary className="min-h-11 cursor-pointer px-2 py-2 text-sm font-bold text-muted-foreground">
                Advanced · legacy frames ({frames.length})
              </summary>
              <div className="flex flex-wrap gap-2 p-2">
                {frames.map((f, i) => (
                  <BubbleButton
                    key={f.id}
                    size="sm"
                    tone={i === current ? "grape" : "neutral"}
                    onClick={() => {
                      setCurrent(i);
                      goToSequence(0);
                    }}
                  >
                    Frame {i + 1}
                  </BubbleButton>
                ))}
              </div>
            </details>
          ) : null}

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
