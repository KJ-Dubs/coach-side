import { PlayCanvas } from "./PlayCanvas";
import type { CourtZoom } from "./Court";
import type { DrillFrame, DrillObject } from "@/lib/drills";
import type { PlayFrame } from "@/lib/types";

const W = 940;
const H = 500;

function ObjectShape({ o }: { o: DrillObject }) {
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
    return <circle cx={x} cy={y} r={11} fill="var(--flame)" stroke="var(--background)" strokeWidth={3} />;
  }
  if (o.type === "line") {
    return <line x1={x - 26} y1={y} x2={x + 26} y2={y} stroke="var(--court-line)" strokeWidth={6} />;
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
}: {
  frame: DrillFrame | undefined;
  zoom?: CourtZoom;
  className?: string;
  onCourtPoint?: ((p: { x: number; y: number }) => void) | undefined;
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
      extras={
        <g>
          {(frame?.objects ?? []).map((o) => (
            <ObjectShape key={o.id} o={o} />
          ))}
        </g>
      }
    />
  );
}
