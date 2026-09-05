import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { fetchFrames, fetchPlay, saveFrames, updatePlay } from "@/lib/data";
import { PLAY_CATEGORIES, type PlayAction, type PlayActionType, type PlayFrame } from "@/lib/types";
import { uuid } from "@/lib/offline";

export const Route = createFileRoute("/plays/$playId/")({
  head: () => ({
    meta: [
      { title: "Play Designer — CourtFlow Coach" },
      {
        name: "description",
        content:
          "Place players, mark the ball handler, and draw passes, cuts and screens across multiple frames.",
      },
      { property: "og:title", content: "Play Designer — CourtFlow Coach" },
      {
        property: "og:description",
        content: "Place players and draw passes, cuts and screens frame by frame.",
      },
    ],
  }),
  component: PlayDesignerPage,
});

type Tool = "move" | "ball" | PlayActionType;

const DEFAULT_TOKENS = [
  { id: "p1", label: "1", x: 0.5, y: 0.5, ball: true },
  { id: "p2", label: "2", x: 0.62, y: 0.14, ball: false },
  { id: "p3", label: "3", x: 0.62, y: 0.86, ball: false },
  { id: "p4", label: "4", x: 0.74, y: 0.32, ball: false },
  { id: "p5", label: "5", x: 0.74, y: 0.68, ball: false },
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

  const [frames, setFrames] = useState<PlayFrame[]>([]);
  const [current, setCurrent] = useState(0);
  const [tool, setTool] = useState<Tool>("move");
  const [flip, setFlip] = useState(false);
  const [sameSeq, setSameSeq] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
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
      setCategory(play.data.category);
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

  const onDown = (raw: { x: number; y: number }) => {
    const p = toCoords(raw);
    if (!frame) return;
    if (tool === "move") {
      setDragId(nearestToken(p));
      return;
    }
    if (tool === "ball") {
      const id = nearestToken(p);
      if (id) patchFrame((f) => ({ ...f, tokens: f.tokens.map((t) => ({ ...t, ball: t.id === id })) }));
      return;
    }
    setGhost({ from: p, to: p });
  };

  const onMove = (raw: { x: number; y: number }) => {
    const p = toCoords(raw);
    if (dragId) {
      patchFrame((f) => ({
        ...f,
        tokens: f.tokens.map((t) => (t.id === dragId ? { ...t, x: p.x, y: p.y } : t)),
      }));
    } else if (ghost) {
      setGhost({ ...ghost, to: p });
    }
  };

  const onUp = (raw: { x: number; y: number }) => {
    const p = toCoords(raw);
    if (dragId) {
      setDragId(null);
      return;
    }
    if (ghost && tool !== "move" && tool !== "ball") {
      const dist = Math.hypot(p.x - ghost.from.x, p.y - ghost.from.y);
      if (dist > 0.03 && frame) {
        const maxSeq = frame.actions.reduce((m, a) => Math.max(m, a.seq), 0);
        const seq = sameSeq && maxSeq > 0 ? maxSeq : maxSeq + 1;
        const action: PlayAction = {
          id: uuid(),
          type: tool,
          seq,
          points: [ghost.from, p],
        };
        patchFrame((f) => ({ ...f, actions: [...f.actions, action] }));
      }
      setGhost(null);
    }
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

  const tools: { key: Tool; label: string }[] = [
    { key: "move", label: "Move Players" },
    { key: "ball", label: "Ball Handler" },
    { key: "pass", label: "Pass" },
    { key: "cut", label: "Cut / Move" },
    { key: "dribble", label: "Dribble" },
    { key: "screen", label: "Screen" },
  ];

  return (
    <AppShell
      wide
      title="Play Designer"
      subtitle="Drag players, drag to draw actions, build frames"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/plays/$playId/view" params={{ playId }}>
            <BubbleButton size="sm" tone="neutral">
              Slideshow
            </BubbleButton>
          </Link>
          <BubbleButton size="sm" tone="flame" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save Play"}
          </BubbleButton>
        </div>
      }
    >
      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <PlayCanvas
          frame={frame}
          flip={flip}
          ghost={ghost}
          onCourtPoint={onDown}
          onCourtPointerMove={onMove}
          onCourtPointerUp={onUp}
        />

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
              Legend: dotted = pass · solid arrow = cut/dribble · bar end = screen
            </Pill>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
