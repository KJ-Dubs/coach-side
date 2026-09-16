import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildTimeline, sampleTimeline } from "@/lib/playAnimation";
import { simplifyPath, type Point } from "@/lib/playPath";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import type { CourtZoom } from "@/components/court/Court";
import { fetchFrames, fetchPlay, saveFrames, updatePlay } from "@/lib/data";
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
    ],
  }),
  component: PlayDesignerPage,
});

type Tool = "move" | "ball" | PlayActionType;

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
  const [zoom, setZoom] = useState<CourtZoom>("full");
  const [sameSeq, setSameSeq] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Offense");
  const [saving, setSaving] = useState(false);

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
    }
  }, [play.data]);

  const frame = frames[current];
  const toCoords = (p: { x: number; y: number }) => (flip ? { x: 1 - p.x, y: 1 - p.y } : p);

  const patchFrame = (fn: (f: PlayFrame) => PlayFrame) =>
    setFrames((prev) => prev.map((f, i) => (i === current ? fn(f) : f)));

  const nearestToken = (p: { x: number; y: number }) => {
    if (!frame) return null;
    let best: { id: string; d: number } | null = null;
    for (const t of frame.tokens) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (!best || d < best.d) best = { id: t.id, d };
    }
    return best && best.d < 0.06 ? best.id : null;
  };

  const timeline = useMemo(() => buildTimeline(frame), [frame]);
  const live = playing || timeMs > 0 ? sampleTimeline(timeline, timeMs) : null;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setTimeMs((prev) => {
        const next = prev + dt;
        if (next >= timeline.totalMs) {
          setPlaying(false);
          return Math.max(0, timeline.totalMs - 1);
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, timeline.totalMs]);

  const stopAnimation = () => {
    setPlaying(false);
    setTimeMs(0);
  };

  const onDown = (raw: { x: number; y: number }) => {
    const p = toCoords(raw);
    if (!frame) return;
    stopAnimation();
    if (tool === "move") {
      setDragId(nearestToken(p));
      return;
    }
    if (tool === "ball") {
      const id = nearestToken(p);
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
      if (dist > 0.03 && frame) {
        const maxSeq = frame.actions.reduce((m, a) => Math.max(m, a.seq), 0);
        const seq = sameSeq && maxSeq > 0 ? maxSeq : maxSeq + 1;
        const actorId = nearestToken(first);
        const targetId = tool === "pass" || tool === "handoff" ? nearestToken(p) : null;
        const action: PlayAction = {
          id: uuid(),
          type: tool,
          seq,
          points: pts,
          ...(actorId ? { actor: actorId } : {}),
          ...(targetId ? { target: targetId, transfersBall: true } : {}),
        };
        patchFrame((f) => ({ ...f, actions: [...f.actions, action] }));
      }
      setStroke(null);
    }
  };

  /** Commit the animated end state as the frame's new starting positions. */
  const applyEndState = () => {
    const last = timeline.steps[timeline.steps.length - 1];
    if (!last) return;
    patchFrame((f) => ({ ...f, tokens: last.endTokens.map((t) => ({ ...t })), actions: [] }));
    stopAnimation();
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
    setSaving(true);
    try {
      await saveFrames(playId, frames);
      await updatePlay(playId, { name, category, attack_basket: flip ? "left" : "right" });
      toast.success("Play saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasDefense = (frame?.tokens ?? []).some((t) => t.team === "defense");

  const setTokens = (tokens: PlayToken[]) => patchFrame((f) => ({ ...f, tokens }));

  const addDefense = () =>
    patchFrame((f) => ({
      ...f,
      tokens: [
        ...f.tokens.filter((t) => t.team !== "defense"),
        ...PRESS_DEFENSE.map((t) => ({ ...t, id: uuid() })),
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
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/plays" search={{ category: normalizeCategory(category) }}>
            <BubbleButton size="sm" tone="ghost">
              Playbook
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

        <div className="flex flex-col gap-3">
          <PlayCanvas
            frame={frame}
            flip={flip}
            zoom={zoom}
            ghost={stroke}
            {...(live
              ? {
                  tokens: live.sample.tokens,
                  ball: live.sample.ball,
                  actions: live.step.actions,
                  activeSeq: live.step.seq,
                  dimOtherActions: true,
                }
              : {})}
            onCourtPoint={onDown}
            onCourtPointerMove={onMove}
            onCourtPointerUp={onUp}
          />
          <Panel className="flex flex-wrap items-center gap-2">
            <Label>Animate</Label>
            <BubbleButton
              size="sm"
              tone="flame"
              disabled={timeline.steps.length === 0}
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                } else {
                  if (timeMs >= timeline.totalMs - 1) setTimeMs(0);
                  setPlaying(true);
                }
              }}
            >
              {playing ? "❚❚ Pause" : "▶ Play"}
            </BubbleButton>
            <BubbleButton size="sm" tone="neutral" onClick={stopAnimation}>
              ↺ Reset
            </BubbleButton>
            <BubbleButton
              size="sm"
              tone="grape"
              disabled={timeline.steps.length === 0}
              onClick={applyEndState}
            >
              Use End Positions
            </BubbleButton>
            <Pill tone={live ? "grape" : "muted"}>
              {live
                ? `Sequence ${live.step.seq} · ${live.phase === "show" ? "Showing paths" : "Running"}`
                : `${timeline.steps.length} sequence${timeline.steps.length === 1 ? "" : "s"} ready`}
            </Pill>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel className="flex flex-col gap-2">
            <Label>Tools</Label>
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
            <div className="flex flex-wrap gap-2">
              <BubbleButton
                size="sm"
                tone={sameSeq ? "flame" : "ghost"}
                onClick={() => setSameSeq((s) => !s)}
              >
                {sameSeq ? "Same number (simultaneous)" : "New number each action"}
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone="neutral"
                onClick={() => patchFrame((f) => ({ ...f, actions: f.actions.slice(0, -1) }))}
              >
                Undo action
              </BubbleButton>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Press Maker · Two Teams</Label>
            <div className="flex flex-wrap gap-2">
              <BubbleButton size="sm" tone="flame" onClick={pressSetup}>
                Full Court Press Setup
              </BubbleButton>
              <BubbleButton size="sm" tone={hasDefense ? "neutral" : "grape"} onClick={addDefense}>
                Add Defense (X1–X5)
              </BubbleButton>
              <BubbleButton size="sm" tone="ghost" disabled={!hasDefense} onClick={removeDefense}>
                Remove Defense
              </BubbleButton>
            </div>
            <Pill tone="muted">
              Purple circles = offense · dashed orange squares X1–X5 = defense
            </Pill>
          </Panel>

          <Panel className="flex flex-col gap-2">
            <Label>Court view</Label>
            <div className="flex flex-wrap gap-2">
              <BubbleButton size="sm" tone={zoom === "full" ? "grape" : "neutral"} onClick={() => setZoom("full")}>
                Full Court
              </BubbleButton>
              <BubbleButton size="sm" tone={zoom === "left" ? "grape" : "neutral"} onClick={() => setZoom("left")}>
                Zoom Left Half
              </BubbleButton>
              <BubbleButton size="sm" tone={zoom === "right" ? "grape" : "neutral"} onClick={() => setZoom("right")}>
                Zoom Right Half
              </BubbleButton>
            </div>
            <Pill tone="muted">Same play, same court — zoom in for half-court detail.</Pill>
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
