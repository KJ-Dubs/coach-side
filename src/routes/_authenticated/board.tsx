import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Court, type CourtZoom } from "@/components/court/Court";
import { BubbleButton, Panel, Pill } from "@/components/Bubbles";
import {
  hitTest,
  newId,
  readBoard,
  writeBoard,
  type BoardObject,
  type BoardPoint,
} from "@/lib/boardStore";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Timeout Board — CoachSide" },
      {
        name: "description",
        content: "Full-screen basketball whiteboard for drawing plays during timeouts and bench talks.",
      },
      { property: "og:title", content: "Timeout Board — CoachSide" },
      { property: "og:description", content: "Sketch plays on a full basketball court during a timeout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BoardPage,
});

type Tool = "draw" | "arrow" | "screen" | "marker" | "xo" | "erase";

const COLORS: { name: string; value: string }[] = [
  { name: "White", value: "#f8fafc" },
  { name: "Orange", value: "#f97316" },
  { name: "Purple", value: "#a855f7" },
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
];

const WIDTHS: { name: string; value: number }[] = [
  { name: "Thin", value: 4 },
  { name: "Medium", value: 8 },
  { name: "Thick", value: 14 },
];

const W = 940;
const H = 500;

function px(p: BoardPoint) {
  return { x: p.x * W, y: p.y * H };
}

function polyD(pts: BoardPoint[]) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * W} ${p.y * H}`).join(" ");
}

function ObjectShape({ o }: { o: BoardObject }) {
  if (o.kind === "stroke") {
    if (o.pts.length === 1) {
      const c = px(o.pts[0]!);
      return <circle cx={c.x} cy={c.y} r={o.width / 1.6} fill={o.color} />;
    }
    return (
      <path
        d={polyD(o.pts)}
        fill="none"
        stroke={o.color}
        strokeWidth={o.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (o.kind === "arrow") {
    const a = px(o.from);
    const b = px(o.to);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = 10 + o.width * 1.6;
    return (
      <g>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={o.color}
          strokeWidth={o.width}
          strokeLinecap="round"
        />
        <polygon
          points={[
            `${b.x},${b.y}`,
            `${b.x - head * Math.cos(ang - 0.42)},${b.y - head * Math.sin(ang - 0.42)}`,
            `${b.x - head * Math.cos(ang + 0.42)},${b.y - head * Math.sin(ang + 0.42)}`,
          ].join(" ")}
          fill={o.color}
        />
      </g>
    );
  }
  if (o.kind === "screen") {
    const a = px(o.from);
    const b = px(o.to);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const cap = 18 + o.width;
    const nx = -Math.sin(ang) * cap;
    const ny = Math.cos(ang) * cap;
    return (
      <g fill="none" stroke={o.color} strokeWidth={o.width} strokeLinecap="round">
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <line x1={b.x - nx} y1={b.y - ny} x2={b.x + nx} y2={b.y + ny} />
      </g>
    );
  }
  if (o.kind === "xo") {
    const c = px(o);
    return o.symbol === "X" ? (
      <g stroke={o.color} strokeWidth={7} strokeLinecap="round">
        <line x1={c.x - 16} y1={c.y - 16} x2={c.x + 16} y2={c.y + 16} />
        <line x1={c.x + 16} y1={c.y - 16} x2={c.x - 16} y2={c.y + 16} />
      </g>
    ) : <circle cx={c.x} cy={c.y} r={19} fill="none" stroke={o.color} strokeWidth={7} />;
  }
  const c = px(o);
  return (
    <g>
      {o.team === "offense" ? (
        <circle cx={c.x} cy={c.y} r={21} fill="rgba(10,10,12,0.65)" stroke={o.color} strokeWidth={5} />
      ) : (
        <path
          d={`M ${c.x - 16} ${c.y - 16} L ${c.x + 16} ${c.y + 16} M ${c.x + 16} ${c.y - 16} L ${c.x - 16} ${c.y + 16}`}
          stroke={o.color}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      {o.team === "offense" ? (
        <text
          x={c.x}
          y={c.y + 7}
          textAnchor="middle"
          fontSize={21}
          fontWeight={900}
          fill={o.color}
        >
          {o.label}
        </text>
      ) : (
        <text x={c.x + 22} y={c.y - 16} fontSize={19} fontWeight={900} fill={o.color}>
          {o.label}
        </text>
      )}
    </g>
  );
}

function BoardPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const saved = readBoard();
  const [objects, setObjects] = useState<BoardObject[]>(saved.objects);
  const [redo, setRedo] = useState<BoardObject[][]>(saved.redo);
  const [history, setHistory] = useState<BoardObject[][]>([]);
  const [zoom, setZoom] = useState<CourtZoom>(saved.zoom);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState(COLORS[0]!.value);
  const [width, setWidth] = useState(4);
  const [team, setTeam] = useState<"offense" | "defense">("offense");
  const [label, setLabel] = useState("1");
  const [xoSymbol, setXoSymbol] = useState<"X" | "O">("X");
  const [compact, setCompact] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const draft = useRef<BoardObject | null>(null);
  const down = useRef(false);
  const dragId = useRef<string | null>(null);
  const gestureStart = useRef<BoardObject[] | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    writeBoard({ objects, redo, zoom: zoom === "left" || zoom === "right" ? zoom : "full" });
  }, [objects, redo, zoom]);

  const commit = useCallback((o: BoardObject) => {
    setObjects((prev) => {
      setHistory((states) => [...states, prev]);
      return [...prev, o];
    });
    setRedo([]);
  }, []);

  const undo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setRedo((future) => [...future, objects]);
    setObjects(previous);
    setHistory((states) => states.slice(0, -1));
  }, [history, objects]);

  const doRedo = useCallback(() => {
    const next = redo[redo.length - 1];
    if (!next) return;
    setHistory((states) => [...states, objects]);
    setObjects(next);
    setRedo((future) => future.slice(0, -1));
  }, [objects, redo]);

  const eraseAt = (p: BoardPoint) => {
    setObjects((prev) => {
      const keep = prev.filter((o) => !hitTest(o, p, 0.018));
      if (keep.length !== prev.length) {
        if (!gestureStart.current) {
          gestureStart.current = prev;
          setHistory((states) => [...states, prev]);
        }
        setRedo([]);
      }
      return keep;
    });
  };

  const onDown = (p: BoardPoint) => {
    down.current = true;
    if (tool === "erase") {
      eraseAt(p);
      return;
    }
    if (tool === "marker" || tool === "xo") {
      const existing = [...objects].reverse().find((o) => (o.kind === "marker" || o.kind === "xo") && hitTest(o, p, 0.018));
      if (existing) {
        gestureStart.current = objects;
        dragId.current = existing.id;
        return;
      }
      if (tool === "xo") commit({ id: newId(), kind: "xo", symbol: xoSymbol, color, x: p.x, y: p.y });
      else commit({ id: newId(), kind: "marker", color, team, label, x: p.x, y: p.y });
      return;
    }
    draft.current =
      tool === "arrow" || tool === "screen"
        ? { id: newId(), kind: tool, color, width, from: p, to: p }
        : { id: newId(), kind: "stroke", color, width, pts: [p] };
    force((n) => n + 1);
  };

  const onMove = (p: BoardPoint, pressed: boolean) => {
    if (!pressed) return;
    if (tool === "erase") {
      eraseAt(p);
      return;
    }
    if (dragId.current) {
      const id = dragId.current;
      setObjects((prev) =>
        prev.map((o) => (o.id === id && (o.kind === "marker" || o.kind === "xo") ? { ...o, x: p.x, y: p.y } : o)),
      );
      return;
    }
    const d = draft.current;
    if (!d) return;
    if (d.kind === "arrow" || d.kind === "screen") d.to = p;
    else if (d.kind === "stroke") {
      const last = d.pts[d.pts.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.002) d.pts.push(p);
    }
    force((n) => n + 1);
  };

  const onUp = () => {
    down.current = false;
    if (dragId.current && gestureStart.current) {
      setHistory((states) => [...states, gestureStart.current ?? []]);
      setRedo([]);
    }
    gestureStart.current = null;
    dragId.current = null;
    const d = draft.current;
    draft.current = null;
    if (d) commit(d);
    force((n) => n + 1);
  };

  const exit = () => {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/dashboard" });
  };

  const toolBtn = (t: Tool, labelText: string) => (
    <BubbleButton
      size="sm"
      tone={tool === t ? "flame" : "neutral"}
      active={tool === t}
      aria-pressed={tool === t}
      aria-label={labelText}
      onClick={() => setTool(t)}
    >
      {tool === t ? "● " : ""}
      {labelText}
    </BubbleButton>
  );

  const live = draft.current;

  return (
    <div className="flex min-h-[100dvh] flex-col gap-2 p-2">
      <Panel className="flex flex-wrap items-center gap-2 p-2">
        <BubbleButton size="sm" tone="grape" onClick={exit} aria-label="Exit the timeout board">
          ← Exit Board
        </BubbleButton>
        <Pill tone="flame">Timeout Board</Pill>
        <BubbleButton
          size="sm"
          tone={zoom === "full" ? "grape" : "neutral"}
          aria-pressed={zoom === "full"}
          onClick={() => setZoom("full")}
        >
          Full Court
        </BubbleButton>
        <BubbleButton
          size="sm"
          tone={zoom === "left" ? "grape" : "neutral"}
          aria-pressed={zoom === "left"}
          onClick={() => setZoom("left")}
        >
          Left Half
        </BubbleButton>
        <BubbleButton
          size="sm"
          tone={zoom === "right" ? "grape" : "neutral"}
          aria-pressed={zoom === "right"}
          onClick={() => setZoom("right")}
        >
          Right Half
        </BubbleButton>
        <BubbleButton
          size="sm"
          tone="ghost"
          className="ml-auto"
          aria-pressed={compact}
          onClick={() => setCompact((c) => !c)}
        >
          {compact ? "▸ Show Tools" : "▾ Hide Tools"}
        </BubbleButton>
      </Panel>

      <div className="flex min-h-0 flex-1 items-start justify-center">
        <Court
          variant="full"
          zoom={zoom}
          className="mx-auto w-full"
          cursor={tool === "erase" ? "cell" : "crosshair"}
          style={{
            maxWidth:
              zoom === "full"
                ? `min(100%, calc((100dvh - ${compact ? 6 : 13}rem) * 1.88))`
                : `min(100%, calc((100dvh - ${compact ? 6 : 13}rem) * 0.94))`,
          }}
          onCourtPoint={onDown}
          onCourtPointerMove={(p) => onMove(p, down.current)}
          onCourtPointerUp={onUp}
        >
          {objects.map((o) => (
            <ObjectShape key={o.id} o={o} />
          ))}
          {live ? <ObjectShape o={live} /> : null}
        </Court>
      </div>

      {compact ? null : (
        <Panel className="flex flex-wrap items-center gap-2 p-2">
          <Pill tone="muted">Tool</Pill>
          {toolBtn("draw", "Marker")}
          {toolBtn("arrow", "Arrow")}
           {toolBtn("screen", "Screen")}
          {toolBtn("xo", "X / O")}
           {toolBtn("marker", "Players")}
          {toolBtn("erase", "Eraser")}

          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <Pill tone="muted">Colour</Pill>
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={`${c.name} marker`}
              aria-pressed={color === c.value}
              onClick={() => setColor(c.value)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-xs font-bold ${
                color === c.value
                  ? "border-flame bg-surface-2 text-foreground"
                  : "border-border bg-surface-2/60 text-muted-foreground"
              }`}
            >
              <span
                className="h-4 w-4 rounded-full border border-black/40"
                style={{ background: c.value }}
                aria-hidden
              />
              {color === c.value ? c.name : ""}
            </button>
          ))}

          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <Pill tone="muted">Size</Pill>
          {WIDTHS.map((w) => (
            <BubbleButton
              key={w.value}
              size="sm"
              tone={width === w.value ? "grape" : "neutral"}
              aria-pressed={width === w.value}
              onClick={() => setWidth(w.value)}
            >
              {w.name}
            </BubbleButton>
          ))}

          {tool === "marker" ? (
            <>
              <span className="mx-1 h-6 w-px bg-border" aria-hidden />
              <Pill tone="muted">Player</Pill>
              <BubbleButton
                size="sm"
                tone={team === "offense" ? "grape" : "neutral"}
                aria-pressed={team === "offense"}
                onClick={() => setTeam("offense")}
              >
                Offense ○
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone={team === "defense" ? "flame" : "neutral"}
                aria-pressed={team === "defense"}
                onClick={() => setTeam("defense")}
              >
                Defense ✕
              </BubbleButton>
              {["1", "2", "3", "4", "5"].map((n) => (
                <BubbleButton
                  key={n}
                  size="sm"
                  tone={label === n ? "grape" : "neutral"}
                  aria-pressed={label === n}
                  aria-label={`Player number ${n}`}
                  onClick={() => setLabel(n)}
                >
                  {n}
                </BubbleButton>
              ))}
            </>
          ) : null}

          {tool === "xo" ? (
            <>
              <span className="mx-1 h-6 w-px bg-border" aria-hidden />
              <BubbleButton size="sm" tone={xoSymbol === "X" ? "grape" : "neutral"} aria-pressed={xoSymbol === "X"} onClick={() => setXoSymbol("X")}>X</BubbleButton>
              <BubbleButton size="sm" tone={xoSymbol === "O" ? "grape" : "neutral"} aria-pressed={xoSymbol === "O"} onClick={() => setXoSymbol("O")}>O</BubbleButton>
            </>
          ) : null}

          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <BubbleButton size="sm" tone="neutral" onClick={undo} disabled={!history.length}>
            ↶ Undo
          </BubbleButton>
          <BubbleButton size="sm" tone="neutral" onClick={doRedo} disabled={!redo.length}>
            ↷ Redo
          </BubbleButton>
          {confirmClear ? (
            <>
              <Pill tone="danger">Erase the whole board?</Pill>
              <BubbleButton
                size="sm"
                tone="danger"
                onClick={() => {
                  setHistory((states) => [...states, objects]);
                  setRedo([]);
                  setObjects([]);
                  setConfirmClear(false);
                }}
              >
                Yes, clear
              </BubbleButton>
              <BubbleButton size="sm" tone="ghost" onClick={() => setConfirmClear(false)}>
                Keep
              </BubbleButton>
            </>
          ) : (
            <BubbleButton
              size="sm"
              tone="danger"
              disabled={!objects.length}
              onClick={() => setConfirmClear(true)}
            >
              Clear Board
            </BubbleButton>
          )}
        </Panel>
      )}
    </div>
  );
}
