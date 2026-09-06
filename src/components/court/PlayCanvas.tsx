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
  curl: "var(--grape)",
  dribble: "var(--grape)",
  screen: "var(--court-line)",
};

type Pt = { x: number; y: number };

/** Curved (curl) path: bends away from the straight line then hooks into the end. */
function curlPath(a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = Math.min(120, len * 0.45);
  const c1 = { x: a.x + dx * 0.25 + nx * bend, y: a.y + dy * 0.25 + ny * bend };
  const c2 = { x: a.x + dx * 0.8 + nx * bend * 0.55, y: a.y + dy * 0.8 + ny * bend * 0.55 };
  return {
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`,
    // tangent at the end of the curve, for the arrow head
    angle: Math.atan2(b.y - c2.y, b.x - c2.x),
    mid: {
      x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
      y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
    },
  };
}

/** Bumpy (wavy) path used for dribbles. */
function dribblePath(a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const wave = 26;
  const amp = 11;
  const humps = Math.max(2, Math.round((len - 22) / wave));
  const usable = Math.max(0, len - 22);
  const step = usable / humps;
  let d = `M ${a.x} ${a.y}`;
  for (let i = 0; i < humps; i++) {
    const s = i * step;
    const e = (i + 1) * step;
    const dir = i % 2 === 0 ? 1 : -1;
    const cx = a.x + ux * ((s + e) / 2) + nx * amp * 2 * dir;
    const cy = a.y + uy * ((s + e) / 2) + ny * amp * 2 * dir;
    d += ` Q ${cx} ${cy} ${a.x + ux * e} ${a.y + uy * e}`;
  }
  d += ` L ${b.x} ${b.y}`;
  return d;
}

function ActionShape({ a, flip }: { a: PlayAction; flip: boolean }) {
  const pts = a.points.map((p) => xf(p, flip));
  if (pts.length < 2) return null;
  const start = pts[0];
  const end = pts[pts.length - 1];
  if (!start || !end) return null;
  const color = ACTION_COLOR[a.type] ?? "var(--grape)";
  const straightAngle = Math.atan2(end.y - start.y, end.x - start.x);
  const curl = a.type === "curl" ? curlPath(start, end) : null;
  const angle = curl ? curl.angle : straightAngle;
  const mid = curl ? curl.mid : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  return (
    <g>
      {curl ? (
        <path d={curl.d} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      ) : a.type === "dribble" ? (
        <path
          d={dribblePath(start, end)}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
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
      )}
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
  const defense = t.team === "defense";
  return (
    <g>
      {t.ball ? (
        <circle cx={p.x} cy={p.y} r={30} fill="none" stroke="var(--flame)" strokeWidth={4} />
      ) : null}
      {defense ? (
        <rect
          x={p.x - 19}
          y={p.y - 19}
          width={38}
          height={38}
          rx={7}
          fill="var(--surface-2)"
          stroke="var(--flame)"
          strokeWidth={4}
          strokeDasharray="7 5"
        />
      ) : (
        <circle cx={p.x} cy={p.y} r={21} fill="var(--surface-2)" stroke="var(--grape)" strokeWidth={4} />
      )}
      <text
        x={p.x}
        y={p.y + 7}
        textAnchor="middle"
        fontSize={20}
        fontWeight={900}
        fill={defense ? "var(--flame)" : "var(--foreground)"}
      >
        {defense ? `X${t.label}` : t.label}
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
