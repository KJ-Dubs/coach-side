import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { fetchFrames, fetchPlay } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/plays/$playId/view")({
  head: () => ({
    meta: [
      { title: "Play Slideshow — CourtSide Coach" },
      {
        name: "description",
        content: "Step through a basketball play frame by frame with previous, next and play.",
      },
      { property: "og:title", content: "Play Slideshow — CourtSide Coach" },
      {
        property: "og:description",
        content: "Step through a play frame by frame.",
      },
    ],
  }),
  component: PlayViewPage,
});

export function PlaySlideshow({ playId }: { playId: string }) {
  const play = useQuery({ queryKey: ["play", playId], queryFn: () => fetchPlay(playId) });
  const frames = useQuery({ queryKey: ["frames", playId], queryFn: () => fetchFrames(playId) });
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = frames.data?.length ?? 0;

  useEffect(() => {
    if (!playing || total === 0) return;
    const t = setInterval(() => {
      setI((prev) => {
        if (prev + 1 >= total) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1600);
    return () => clearInterval(t);
  }, [playing, total]);

  const frame = frames.data?.[Math.min(i, Math.max(0, total - 1))];
  const flip = play.data?.attack_basket === "left";

  return (
    <div className="flex flex-col gap-2">
      <Panel className="flex flex-wrap items-center gap-2">
        <Pill tone="grape">{play.data?.name ?? "Play"}</Pill>
        <Pill tone="muted">{play.data?.category}</Pill>
        <Pill tone="flame">
          Frame {total ? Math.min(i + 1, total) : 0} / {total}
        </Pill>
        {frame?.note ? <Pill tone="neutral">{frame.note}</Pill> : null}
      </Panel>
      <div className="transition-opacity duration-300" key={frame?.id}>
        <PlayCanvas frame={frame} flip={flip} className="bubble-pop" />
      </div>
      <Panel className="flex flex-wrap items-center justify-center gap-2">
        <BubbleButton tone="neutral" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
          ← Previous
        </BubbleButton>
        <BubbleButton tone="flame" onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </BubbleButton>
        <BubbleButton
          tone="grape"
          onClick={() => setI((v) => Math.min(total - 1, v + 1))}
          disabled={i >= total - 1}
        >
          Next →
        </BubbleButton>
        <BubbleButton tone="ghost" onClick={() => setI(0)}>
          Restart
        </BubbleButton>
      </Panel>
      {total === 0 ? (
        <Panel>
          <Label>This play has no frames yet</Label>
        </Panel>
      ) : null}
    </div>
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
