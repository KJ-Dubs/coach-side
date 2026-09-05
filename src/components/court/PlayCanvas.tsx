import { Court } from "./Court";
import type { PlayAction, PlayFrame, PlayToken } from "@/lib/types";

const W = 940;
const H = 500;

function xf(p: { x: number; y: number }, flip: boolean) {
  return { x: (flip ? 1 - p.x : p.x) * W, y: (flip ? 1 - p.y : p.y) * H };
}

const ACTION_COLOR: Record<string, string> = {
  pass: "var(--flame)",
  cut: "var(--grape)",
  dribble: "var(--grape)",
  screen: "var(--court-line)",
};

function ActionShape({ a, flip }: { a: PlayAction; flip: boolean }) {
  const pts = a.points.map((p) => xf(p, flip));
  if (pts.length < 2) return null;
  const start = pts[0];
  const end = pts[pts.length - 1];
  if (!start || !end) return null;
  const color = ACTION_COLOR[a.type] ?? "var(--grape)";
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={a.type === "pass" ? "14 12" : undefined}
      />
      {a.type === "screen" ? (
        <line
          x1={end.x - Math.sin(angle) * 18}
          y1={end.y + Math.cos(angle) * 18}
          x2={end.x + Math.sin(angle) * 18}
          y2={end.y - Math.cos(angle) * 18}
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
        />
      ) : (
        <polygon
          points={[
            `${end.x},${end.y}`,
            `${end.x - 20 * Math.cos(angle - 0.4)},${end.y - 20 * Math.sin(angle - 0.4)}`,
            `${end.x - 20 * Math.cos(angle + 0.4)},${end.y - 20 * Math.sin(angle + 0.4)}`,
          ].join(" ")}
          fill={color}
        />
      )}
      <circle cx={mid.x} cy={mid.y} r={14} fill="var(--grape)" stroke="var(--background)" strokeWidth={3} />
      <text
        x={mid.x}
        y={mid.y + 5}
        textAnchor="middle"
        fontSize={16}
        fontWeight={900}
        fill="var(--primary-foreground)"
      >
        {a.seq}
      </text>
    </g>
  );
}

function TokenShape({ t, flip }: { t: PlayToken; flip: boolean }) {
  const p = xf(t, flip);
  return (
    <g>
      {t.ball ? (
        <circle cx={p.x} cy={p.y} r={30} fill="none" stroke="var(--flame)" strokeWidth={4} />
      ) : null}
      <circle cx={p.x} cy={p.y} r={21} fill="var(--surface-2)" stroke="var(--grape)" strokeWidth={4} />
      <text
        x={p.x}
        y={p.y + 7}
        textAnchor="middle"
        fontSize={20}
        fontWeight={900}
        fill="var(--foreground)"
      >
        {t.label}
      </text>
    </g>
  );
}

export function PlayCanvas({
  frame,
  flip = false,
  className,
  onCourtPoint,
  onCourtPointerMove,
  onCourtPointerUp,
  ghost,
}: {
  frame: PlayFrame | undefined;
  flip?: boolean | undefined;
  className?: string | undefined;
  onCourtPoint?: ((p: { x: number; y: number }) => void) | undefined;
  onCourtPointerMove?: ((p: { x: number; y: number }) => void) | undefined;
  onCourtPointerUp?: ((p: { x: number; y: number }) => void) | undefined;
  ghost?: { from: { x: number; y: number }; to: { x: number; y: number } } | null | undefined;
}) {
  return (
    <Court
      variant="full"
      className={className}
      onCourtPoint={onCourtPoint}
      onCourtPointerMove={onCourtPointerMove}
      onCourtPointerUp={onCourtPointerUp}
    >
      {frame?.actions.map((a) => <ActionShape key={a.id} a={a} flip={flip} />)}
      {frame?.tokens.map((t) => <TokenShape key={t.id} t={t} flip={flip} />)}
      {ghost ? (
        <line
          x1={xf(ghost.from, flip).x}
          y1={xf(ghost.from, flip).y}
          x2={xf(ghost.to, flip).x}
          y2={xf(ghost.to, flip).y}
          stroke="var(--flame)"
          strokeWidth={4}
          strokeDasharray="10 8"
        />
      ) : null}
    </Court>
  );
}
