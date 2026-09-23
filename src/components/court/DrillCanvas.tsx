import { PlayCanvas } from "./PlayCanvas";
import type { CourtZoom } from "./Court";
import type { DrillFrame, DrillObject } from "@/lib/drills";
import type { PlayAction, PlayFrame, PlayToken } from "@/lib/types";
import { visibleDrillBalls } from "@/lib/drillBalls";

const W = 940;
const H = 500;

export function DrillObjectShape({ o }: { o: DrillObject }) {
  const x = o.x * W;
  const y = o.y * H;
  if (o.type === "cone") {
    return (
      <polygon
        points={`${x},${y - 16} ${x - 13},${y + 12} ${x + 13},${y + 12}`}
        fill="var(--flame)"
        stroke="var(--background)"
        strokeWidth={3}
      />
    );
  }
  if (o.type === "chair") {
    return (
      <g>
        <rect x={x - 14} y={y - 14} width={28} height={28} rx={5} fill="none" stroke="var(--flame)" strokeWidth={5} />
        <line x1={x - 14} y1={y - 14} x2={x + 14} y2={y - 14} stroke="var(--flame)" strokeWidth={8} />
      </g>
    );
  }
  if (o.type === "ball") {
    return null;
  }
  if (o.type === "line") {
    return null;
  }
  if (o.type === "text") {
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--foreground)">
        {o.label ?? ""}
      </text>
    );
  }
  return <circle cx={x} cy={y} r={9} fill="none" stroke="var(--court-line)" strokeWidth={4} strokeDasharray="6 5" />;
}

/** A drill diagram: the normal court plus cones, chairs, spots and extra balls. */
export function DrillCanvas({
  frame,
  zoom = "full",
  className,
  onCourtPoint,
  onCourtPointerMove,
  onCourtPointerUp,
  tokens,
  actions,
  ball,
  balls,
  ghost,
}: {
  frame: DrillFrame | undefined;
  zoom?: CourtZoom;
  className?: string;
  onCourtPoint?: ((p: { x: number; y: number }) => void) | undefined;
  onCourtPointerMove?: ((p: { x: number; y: number }) => void) | undefined;
  onCourtPointerUp?: ((p: { x: number; y: number }) => void) | undefined;
  tokens?: PlayToken[] | undefined;
  actions?: PlayAction[] | undefined;
  ball?: { x: number; y: number } | null | undefined;
  balls?: { id: string; point: { x: number; y: number }; ownerId: string | null }[] | undefined;
  ghost?: { x: number; y: number }[] | null | undefined;
}) {
  const asPlayFrame = frame
    ? ({ ...frame, play_id: frame.drill_id } as unknown as PlayFrame)
    : undefined;
  return (
    <PlayCanvas
      frame={asPlayFrame}
      zoom={zoom}
      className={className}
      onCourtPoint={onCourtPoint}
      onCourtPointerMove={onCourtPointerMove}
      onCourtPointerUp={onCourtPointerUp}
      tokens={tokens}
      actions={actions}
      ball={ball}
      balls={balls ?? visibleDrillBalls(frame, tokens)}
      ghost={ghost}
      extras={
        <g>
          {(frame?.objects ?? []).map((o) => (
            <DrillObjectShape key={o.id} o={o} />
          ))}
        </g>
      }
    />
  );
}
