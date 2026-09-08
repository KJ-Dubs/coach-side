import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BubbleButton } from "@/components/Bubbles";
import { PlayPresenter } from "@/components/court/PlayPresenter";
import { fetchFrames, fetchPlay } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/plays/$playId/view")({
  head: () => ({
    meta: [
      { title: "Present Play — CoachSide" },
      {
        name: "description",
        content: "Present a basketball play with animated sequences, playback speed and step controls.",
      },
      { property: "og:title", content: "Present Play — CoachSide" },
      { property: "og:description", content: "Animated play presentation." },
    ],
  }),
  component: PlayViewPage,
});

export function PlaySlideshow({ playId }: { playId: string }) {
  const play = useQuery({ queryKey: ["play", playId], queryFn: () => fetchPlay(playId) });
  const frames = useQuery({ queryKey: ["frames", playId], queryFn: () => fetchFrames(playId) });

  return (
    <PlayPresenter
      play={play.data}
      frames={frames.data ?? []}
      loading={play.isLoading || frames.isLoading}
    />
  );
}


function PlayViewPage() {
  const { playId } = Route.useParams();
  return (
    <AppShell
      wide
      title="Play Slideshow"
      subtitle="Frame by frame"
      actions={
        <Link to="/plays/$playId" params={{ playId }}>
          <BubbleButton size="sm" tone="grape">
            Edit Play
          </BubbleButton>
        </Link>
      }
    >
      <PlaySlideshow playId={playId} />
    </AppShell>
  );
}
