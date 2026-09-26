import { useQuery } from "@tanstack/react-query";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { fetchPublicFrames } from "@/lib/community";
import { fetchFrames } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Static first-frame court preview for a published play. Uses the real court
 * drawing, never a stock image.
 */
export function PlayThumb({
  playId,
  attackBasket,
  authenticated = false,
  className,
}: {
  playId: string;
  attackBasket: string;
  authenticated?: boolean;
  className?: string;
}) {
  const frames = useQuery({
    queryKey: [authenticated ? "play-frames" : "public-play-frames", playId],
    queryFn: () => authenticated ? fetchFrames(playId) : fetchPublicFrames(playId),
    staleTime: 5 * 60 * 1000,
  });
  return (
    <div className={cn("pointer-events-none overflow-hidden rounded-2xl", className)}>
      <PlayCanvas frame={frames.data?.[0]} flip={attackBasket === "left"} />
    </div>
  );
}
