import type { ReactNode } from "react";
import { Court, type CourtZoom } from "./Court";
import { withVisualOffsets } from "@/lib/playAnimation";
import type { PlayAction, PlayFrame, PlayToken } from "@/lib/types";
import {
  PW as W,
  PH as H,
  curlGeom,
  dribbleD,
  polyD,
  resolvePath,
  toPx,
  type Point,
} from "@/lib/playPath";

function xf(p: Point, flip: boolean) {
  return { x: (flip ? 1 - p.x : p.x) * W, y: (flip ? 1 - p.y : p.y) * H };
}

const ACTION_COLOR: Record<string, string> = {
  pass: "var(--flame)",
  handoff: "var(--flame)",
  shot: "var(--flame)",
  cut: "var(--grape)",
  move: "var(--grape)",
  curl: "var(--grape)",
  dribble: "var(--grape)",
  screen: "var(--court-line)",
};

function ActionShape({ a, flip, dim, vertical }: { a: PlayAction; flip: boolean; dim?: boolean; vertical?: boolean }) {
  const raw = a.points ?? [];
  if (raw.length < 2) return null;
  const freehand = raw.length > 2;
  const pts = raw.map((p) => xf(p, flip));
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const color = ACTION_COLOR[a.type] ?? "var(--grape)";
  const dashed = a.type === "pass" || a.type === "shot";

  const prev = pts[pts.length - 2] ?? start;
  const curl = !freehand && a.type === "curl" ? curlGeom(start, end) : null;
  const angle = curl ? curl.angle : Math.atan2(end.y - prev.y, end.x - prev.x);
  const mid = curl
    ? curl.mid
    : freehand
      ? pts[Math.floor(pts.length / 2)]!
      : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  const d = curl
    ? curl.d
    : a.type === "dribble"
      ? dribbleD(pts)
      : freehand
        ? polyD(pts)
        : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

  return (
    <g opacity={dim ? 0.28 : 1}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "14 12" : undefined}
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
      {a.type === "shot" ? (
        <circle cx={end.x} cy={end.y} r={11} fill="none" stroke={color} strokeWidth={4} />
      ) : null}
      <circle cx={mid.x} cy={mid.y} r={14} fill="var(--grape)" stroke="var(--background)" strokeWidth={3} />
      <text
        x={mid.x}
        y={mid.y + 5}
        transform={vertical ? `rotate(-90 ${mid.x} ${mid.y})` : undefined}
        textAnchor="middle"
        fontSize={16}
        fontWeight={900}
        fill="var(--primary-foreground)"
      >
        {a.seq}
      </text>
      {a.option ? (
        <text
          x={mid.x}
          y={mid.y + 34}
          transform={vertical ? `rotate(-90 ${mid.x} ${mid.y})` : undefined}
          textAnchor="middle"
          fontSize={15}
          fontWeight={900}
          fill="var(--flame)"
        >
          {a.option.label}
        </text>
      ) : null}

    </g>
  );
}

function BallMark({ p }: { p: { x: number; y: number } }) {
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={13} fill="var(--flame)" stroke="var(--background)" strokeWidth={3} />
      <path
        d={`M ${p.x - 13} ${p.y} L ${p.x + 13} ${p.y} M ${p.x} ${p.y - 13} L ${p.x} ${p.y + 13}`}
        stroke="var(--background)"
        strokeWidth={2}
      />
    </g>
  );
}

function TokenShape({ t, flip, dim, vertical }: { t: PlayToken; flip: boolean; dim?: boolean; vertical?: boolean }) {
  const p = xf(t, flip);
  const defense = t.team === "defense";
  return (
    <g opacity={dim ? 0.35 : 1} transform={vertical ? `rotate(-90 ${p.x} ${p.y})` : undefined}>
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


const ACTION_NAME: Record<string, string> = {
  pass: "Pass",
  handoff: "Handoff",
  shot: "Shot",
  cut: "Cut",
  move: "Move",
  curl: "Curl",
  dribble: "Dribble",
  screen: "Screen",
};

export function PlayCanvas({
  frame,
  flip = false,
  zoom = "full",
  className,
  onCourtPoint,
  onCourtPointerMove,
  onCourtPointerUp,
  ghost,
  tokens,
  actions,
  ball,
  dimOtherActions = false,
  activeSeq,
  focusTokenId,
  selectedActionId,
  extras,
}: {
  frame: PlayFrame | undefined;
  flip?: boolean | undefined;
  zoom?: CourtZoom | undefined;
  className?: string | undefined;
  onCourtPoint?: ((p: Point) => void) | undefined;
  onCourtPointerMove?: ((p: Point) => void) | undefined;
  onCourtPointerUp?: ((p: Point) => void) | undefined;
  ghost?: { from: Point; to: Point } | Point[] | null | undefined;
  /** Animation overrides. */
  tokens?: PlayToken[] | undefined;
  actions?: PlayAction[] | undefined;
  ball?: Point | null | undefined;
  dimOtherActions?: boolean | undefined;
  activeSeq?: number | undefined;
  /** Emphasize one player and their actions (read-only presenter view). */
  focusTokenId?: string | undefined;
  /** Editor identity chip: shows "5 • Cut • Seq 6" for the selected action. */
  selectedActionId?: string | undefined;
  /** Extra SVG drawn under the actions (drill equipment: cones, chairs, spots). */
  extras?: ReactNode | undefined;
}) {
  const shownTokens = withVisualOffsets(tokens ?? frame?.tokens ?? []);
  const shownActions = actions ?? frame?.actions ?? [];
  const ballToken = shownTokens.find((t) => t.ball);
  const ballPoint =
    ballToken ? { x: ballToken.x, y: ballToken.y } : (ball ?? null);
  const ballPx = ballPoint ? xf(ballPoint, flip) : null;
  const attached = !!ballToken;
  const selected = selectedActionId
    ? shownActions.find((a) => a.id === selectedActionId)
    : undefined;
  const selectedLabel = selected
    ? [
        `${shownTokens.find((t) => t.id === selected.actor)?.label ?? "?"}`,
        selected.option
          ? `${selected.option.label} ${ACTION_NAME[selected.type] ?? selected.type}`
          : (ACTION_NAME[selected.type] ?? selected.type),
        selected.type === "pass" && selected.passTo === "space"
          ? "Target area"
          : selected.target
            ? `→ ${shownTokens.find((t) => t.id === selected.target)?.label ?? "?"}`
            : null,
        `Seq ${selected.seq}`,
      ]
        .filter(Boolean)
        .join(" • ")
    : null;

  const ghostPts = Array.isArray(ghost)
    ? ghost
    : ghost
      ? [ghost.from, ghost.to]
      : null;
  const vertical = zoom === "top" || zoom === "bottom";

  return (
    <Court
      variant="full"
      zoom={zoom}
      className={className}
      onCourtPoint={onCourtPoint}
      onCourtPointerMove={onCourtPointerMove}
      onCourtPointerUp={onCourtPointerUp}
    >
      {extras}
      {shownActions.map((a) => (
        <ActionShape
          key={a.id}
          a={a}
          flip={flip}
          vertical={vertical}
          dim={
            (dimOtherActions && activeSeq !== undefined && a.seq !== activeSeq) ||
            (!!focusTokenId && a.actor !== focusTokenId && a.target !== focusTokenId)
          }
        />
      ))}
      {shownTokens.map((t) => (
        <TokenShape key={t.id} t={t} flip={flip} vertical={vertical} dim={!!focusTokenId && t.id !== focusTokenId} />
      ))}

      {ballPx ? (
        <BallMark p={attached ? { x: ballPx.x + 22, y: ballPx.y - 20 } : ballPx} />
      ) : null}
      {ghostPts && ghostPts.length > 1 ? (
        <path
          d={polyD(ghostPts.map((p) => xf(p, flip)))}
          fill="none"
          stroke="var(--flame)"
          strokeWidth={4}
          strokeDasharray="10 8"
        />
      ) : null}
      {selectedLabel ? (
        <g transform={vertical ? "rotate(-90 16 16)" : undefined}>
          <rect
            x={16}
            y={16}
            width={selectedLabel.length * 12 + 34}
            height={44}
            rx={22}
            fill="var(--surface-2)"
            stroke="var(--flame)"
            strokeWidth={3}
          />
          <text x={34} y={45} fontSize={20} fontWeight={800} fill="var(--foreground)">
            {selectedLabel}
          </text>
        </g>
      ) : null}
    </Court>
  );
}

export { resolvePath, toPx };
