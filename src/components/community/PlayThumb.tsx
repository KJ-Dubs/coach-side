import { useQuery } from "@tanstack/react-query";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { outsideCount, type CourtZoom } from "@/components/court/Court";
import { fetchPublicFrames } from "@/lib/community";
import { fetchFrames } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { PlayFrame } from "@/lib/types";

const FULL_COURT_CATEGORIES = /press/i;

/** Zoom previews onto the half court where the action happens. */
function thumbZoom(frame: PlayFrame | undefined, flip: boolean, category?: string | null): CourtZoom {
  if (category && FULL_COURT_CATEGORIES.test(category)) return "full";
  if (!frame) return flip ? "left" : "right";
  const pts: { x: number; y: number }[] = [...(frame.tokens ?? [])];
  for (const a of frame.actions ?? []) {
    const anyA = a as unknown as { points?: { x: number; y: number }[] };
    if (Array.isArray(anyA.points)) pts.push(...anyA.points);
  }
  const shown = pts
    .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
    .map((p) => ({ x: flip ? 1 - p.x : p.x, y: p.y }));
  const preferred: CourtZoom = flip ? "left" : "right";
  const other: CourtZoom = flip ? "right" : "left";
  if (outsideCount(preferred, shown) === 0) return preferred;
  if (outsideCount(other, shown) === 0) return other;
  return "full";
}

/**
 * Static first-frame court preview for a published play. Uses the real court
 * drawing, never a stock image. Zooms to the action half (presses stay full).
 */
export function PlayThumb({
  playId,
  attackBasket,
  category,
  authenticated = false,
  className,
}: {
  playId: string;
  attackBasket: string;
  category?: string | null;
  authenticated?: boolean;
  className?: string;
}) {
  const frames = useQuery({
    queryKey: [authenticated ? "play-frames" : "public-play-frames", playId],
    queryFn: () => authenticated ? fetchFrames(playId) : fetchPublicFrames(playId),
    staleTime: 5 * 60 * 1000,
  });
  const frame = frames.data?.[0];
  const flip = attackBasket === "left";
  return (
    <div className={cn("pointer-events-none overflow-hidden rounded-2xl", className)}>
      <PlayCanvas frame={frame} flip={flip} zoom={thumbZoom(frame, flip, category)} />
    </div>
  );
}
