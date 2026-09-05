import { cn } from "@/lib/utils";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useRef } from "react";

/**
 * Basketball court surface used everywhere in the app (live stat entry,
 * shot charts, play designer). Coordinates are normalized 0..1.
 * Half court: basket on the LEFT.
 */

type CourtProps = {
  variant?: "half" | "full" | undefined;
  className?: string | undefined;
  /** SVG-space extras (markers, arrows) drawn on top of the court lines. */
  children?: ReactNode | undefined;
  /** HTML overlay layer rendered above the svg. */
  overlay?: ReactNode | undefined;
  onCourtPoint?: ((p: { x: number; y: number }) => void) | undefined;
  onCourtPointerMove?: ((p: { x: number; y: number }) => void) | undefined;
  onCourtPointerUp?: ((p: { x: number; y: number }) => void) | undefined;
  cursor?: string | undefined;
  style?: CSSProperties | undefined;
};

export const COURT_VIEW = {
  half: { w: 470, h: 500 },
  full: { w: 940, h: 500 },
};

function HalfLines({ mirrored = false }: { mirrored?: boolean }) {
  // Drawn in a 470x500 space with the basket at the left.
  const g = (
    <g fill="none" stroke="var(--court-line)" strokeWidth={3}>
      <line x1={0} y1={0} x2={0} y2={500} />
      {/* paint */}
      <rect x={0} y={170} width={190} height={160} />
      <circle cx={190} cy={250} r={60} />
      {/* restricted + rim */}
      <path d={`M 52.5 210 A 40 40 0 0 1 52.5 290`} strokeWidth={2} />
      <line x1={40} y1={228} x2={40} y2={272} strokeWidth={6} stroke="var(--flame)" />
      <circle cx={52.5} cy={250} r={9} stroke="var(--flame)" strokeWidth={3} />
      {/* three point line */}
      <path
        d={`M 0 52.5 L 52.5 52.5 A 197.5 197.5 0 0 1 52.5 447.5 L 0 447.5`}
        strokeWidth={3}
      />
    </g>
  );
  return mirrored ? <g transform="translate(940,0) scale(-1,1)">{g}</g> : g;
}

export function Court({
  variant = "half",
  className,
  children,
  overlay,
  onCourtPoint,
  onCourtPointerMove,
  onCourtPointerUp,
  cursor = "crosshair",
  style,
}: CourtProps) {
  const view = COURT_VIEW[variant];
  const ref = useRef<HTMLDivElement>(null);

  const pointFrom = (e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return { x, y };
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-3xl border-2 border-border bg-court shadow-2xl shadow-black/40",
        className,
      )}
      style={{ aspectRatio: `${view.w} / ${view.h}`, cursor, touchAction: "none", ...style }}
      onPointerDown={(e) => {
        const p = pointFrom(e);
        if (p && onCourtPoint) onCourtPoint(p);
      }}
      onPointerMove={(e) => {
        const p = pointFrom(e);
        if (p && onCourtPointerMove) onCourtPointerMove(p);
      }}
      onPointerUp={(e) => {
        const p = pointFrom(e);
        if (p && onCourtPointerUp) onCourtPointerUp(p);
      }}
    >
      <svg
        viewBox={`0 0 ${view.w} ${view.h}`}
        className="absolute inset-0 h-full w-full"
      >
        <rect x={0} y={0} width={view.w} height={view.h} fill="var(--court)" />
        <g fill="none" stroke="var(--court-line)" strokeWidth={3}>
          <rect x={2} y={2} width={view.w - 4} height={view.h - 4} rx={6} />
        </g>
        {variant === "half" ? (
          <>
            <HalfLines />
            <g fill="none" stroke="var(--court-line)" strokeWidth={3}>
              <line x1={468} y1={0} x2={468} y2={500} />
              <path d={`M 468 190 A 60 60 0 0 0 468 310`} />
            </g>
          </>
        ) : (
          <>
            <HalfLines />
            <HalfLines mirrored />
            <g fill="none" stroke="var(--court-line)" strokeWidth={3}>
              <line x1={470} y1={0} x2={470} y2={500} />
              <circle cx={470} cy={250} r={60} />
            </g>
          </>
        )}
        {children}
      </svg>
      {overlay}
    </div>
  );
}
