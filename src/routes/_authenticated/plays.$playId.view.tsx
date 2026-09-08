import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { buildTimeline, sampleTimeline } from "@/lib/playAnimation";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { fetchFrames, fetchPlay } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/plays/$playId/view")({
  head: () => ({
    meta: [
      { title: "Play Slideshow — CoachSide" },
      {
        name: "description",
        content: "Step through a basketball play frame by frame with previous, next and play.",
      },
      { property: "og:title", content: "Play Slideshow — CoachSide" },
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
  const [timeMs, setTimeMs] = useState(0);
  const total = frames.data?.length ?? 0;
  const frame = frames.data?.[Math.min(i, Math.max(0, total - 1))];
  const timeline = useMemo(() => buildTimeline(frame), [frame]);
  const live = timeline.steps.length ? sampleTimeline(timeline, timeMs) : null;

  useEffect(() => {
    if (!playing || total === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setTimeMs((prev) => {
        const span = timeline.totalMs || 1400;
        const next = prev + dt;
        if (next >= span) {
          if (i + 1 < total) {
            setI(i + 1);
            return 0;
          }
          setPlaying(false);
          return Math.max(0, span - 1);
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, timeline.totalMs, i]);

  const goto = (n: number) => {
    setI(n);
    setTimeMs(0);
  };

  const flip = play.data?.attack_basket === "left";

  return (
    <div className="flex flex-col gap-2">
      <Panel className="flex flex-wrap items-center gap-2">
        <Pill tone="grape">{play.data?.name ?? "Play"}</Pill>
        <Pill tone="muted">{play.data?.category}</Pill>
        <Pill tone="flame">
          Frame {total ? Math.min(i + 1, total) : 0} / {total}
        </Pill>
        {live ? (
          <Pill tone="neutral">
            Sequence {live.step.seq} · {live.phase === "show" ? "Showing paths" : "Running"}
          </Pill>
        ) : null}
        {frame?.note ? <Pill tone="neutral">{frame.note}</Pill> : null}
      </Panel>
      <PlayCanvas
        frame={frame}
        flip={flip}
        className="bubble-pop"
        {...(live
          ? {
              tokens: live.sample.tokens,
              ball: live.sample.ball,
              actions: live.step.actions,
              activeSeq: live.step.seq,
              dimOtherActions: true,
            }
          : {})}
      />
      <Panel className="flex flex-wrap items-center justify-center gap-2">
        <BubbleButton tone="neutral" onClick={() => goto(Math.max(0, i - 1))} disabled={i === 0}>
          ← Previous
        </BubbleButton>
        <BubbleButton tone="flame" onClick={() => setPlaying((p) => !p)}>
          {playing ? "❚❚ Pause" : "▶ Play"}
        </BubbleButton>
        <BubbleButton
          tone="grape"
          onClick={() => goto(Math.min(total - 1, i + 1))}
          disabled={i >= total - 1}
        >
          Next →
        </BubbleButton>
        <BubbleButton
          tone="ghost"
          onClick={() => {
            setPlaying(false);
            goto(0);
          }}
        >
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
