import { cn } from "@/lib/utils";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useRef } from "react";

/**
 * Basketball court surface used everywhere in the app (live stat entry,
 * shot charts, play designer). Coordinates are normalized 0..1.
 * Half court: basket on the LEFT.
 */

export type CourtZoom = "full" | "left" | "right" | "top" | "bottom";

type CourtCamera = {
  viewBox: { x: number; y: number; w: number; h: number };
  transform?: string | undefined;
};

/** Camera-only projection over the unchanged 940x500 full-court coordinates. */
export function courtCamera(zoom: CourtZoom): CourtCamera {
  if (zoom === "left") return { viewBox: { x: 0, y: 0, w: 470, h: 500 } };
  if (zoom === "right") return { viewBox: { x: 470, y: 0, w: 470, h: 500 } };
  if (zoom === "top") {
    return {
      viewBox: { x: 0, y: 0, w: 500, h: 470 },
      transform: "translate(500 0) rotate(90)",
    };
  }
  if (zoom === "bottom") {
    return {
      viewBox: { x: 0, y: 0, w: 500, h: 470 },
      transform: "translate(500 -470) rotate(90)",
    };
  }
  return { viewBox: { x: 0, y: 0, w: 940, h: 500 } };
}

/** Visible slice of the full court, in normalized full-court units. */
export function zoomBox(zoom: CourtZoom) {
  if (zoom === "left") return { x: 0, w: 0.5 };
  if (zoom === "right") return { x: 0.5, w: 0.5 };
  if (zoom === "top") return { x: 0, w: 0.5 };
  if (zoom === "bottom") return { x: 0.5, w: 0.5 };
  return { x: 0, w: 1 };
}

/** Full-court normalized point -> position inside the visible court box (0..1). */
export function toLocal(zoom: CourtZoom, p: { x: number; y: number }) {
  if (zoom === "top") return { x: 1 - p.y, y: p.x * 2 };
  if (zoom === "bottom") return { x: 1 - p.y, y: (p.x - 0.5) * 2 };
  const b = zoomBox(zoom);
  return { x: (p.x - b.x) / b.w, y: p.y };
}

/** Position inside the visible camera (0..1) -> normalized full-court point. */
export function fromLocal(zoom: CourtZoom, p: { x: number; y: number }) {
  if (zoom === "top") return { x: p.y * 0.5, y: 1 - p.x };
  if (zoom === "bottom") return { x: 0.5 + p.y * 0.5, y: 1 - p.x };
  const b = zoomBox(zoom);
  return { x: b.x + p.x * b.w, y: p.y };
}

type CourtProps = {
  variant?: "half" | "full" | undefined;
  /** Only used with variant="full": which slice of the one court is visible. */
  zoom?: CourtZoom | undefined;
  className?: string | undefined;
  /** SVG-space extras (markers, arrows) drawn on top of the court lines. */
  children?: ReactNode | undefined;
  /** HTML overlay layer rendered above the svg. */
  overlay?: ReactNode | undefined;
  /** Normalized point in the coordinate space of the whole court surface. */
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
      {/* paint (12ft wide, 19ft deep) */}
      <rect x={0} y={190} width={190} height={120} />
      <circle cx={190} cy={250} r={60} />
      {/* restricted + rim */}
      <path d={`M 52.5 210 A 40 40 0 0 1 52.5 290`} strokeWidth={2} />
      {/* backboard */}
      <line x1={40} y1={220} x2={40} y2={280} strokeWidth={6} stroke="var(--flame)" />
      <line x1={40} y1={250} x2={49} y2={250} strokeWidth={3} stroke="var(--flame)" />
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
  zoom = "full",
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
  const camera = variant === "full" ? courtCamera(zoom) : { viewBox: { x: 0, y: 0, w: view.w, h: view.h } };
  const vb = camera.viewBox;
  const ref = useRef<HTMLDivElement>(null);

  const pointFrom = (e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const lx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const ly = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return variant === "full" ? fromLocal(zoom, { x: lx, y: ly }) : { x: lx, y: ly };
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-3xl border-2 border-border bg-court shadow-2xl shadow-black/40 transition-all duration-300",
        className,
      )}
      style={{ aspectRatio: `${vb.w} / ${vb.h}`, cursor, touchAction: "none", ...style }}
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
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="absolute inset-0 h-full w-full"
      >
        <g transform={camera.transform}>
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
        </g>
      </svg>
      {overlay}
    </div>
  );
}
