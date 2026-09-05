import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { fetchFrames, fetchPlayByToken } from "@/lib/data";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Shared Play — CourtFlow Coach" },
      {
        name: "description",
        content: "A read-only basketball play shared by your coach — step through it frame by frame.",
      },
      { property: "og:title", content: "Shared Play — CourtFlow Coach" },
      {
        property: "og:description",
        content: "A read-only play shared by your coach.",
      },
    ],
  }),
  component: SharedPlayPage,
});

function SharedPlayPage() {
  const { token } = Route.useParams();
  const play = useQuery({ queryKey: ["shared-play", token], queryFn: () => fetchPlayByToken(token) });
  const frames = useQuery({
    queryKey: ["frames", play.data?.id],
    queryFn: () => fetchFrames(play.data!.id),
    enabled: !!play.data,
  });

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

  if (play.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Panel>
          <Label>Loading play…</Label>
        </Panel>
      </div>
    );
  }

  if (!play.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Panel className="text-center">
          <Label>This play is not shared or the link has expired</Label>
        </Panel>
      </div>
    );
  }

  const frame = frames.data?.[Math.min(i, Math.max(0, total - 1))];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-2 p-3">
      <Panel className="flex flex-wrap items-center gap-2">
        <Pill tone="grape">{play.data.name}</Pill>
        <Pill tone="muted">{play.data.category}</Pill>
        <Pill tone="flame">
          Frame {total ? Math.min(i + 1, total) : 0} / {total}
        </Pill>
      </Panel>

      <PlayCanvas frame={frame} flip={play.data.attack_basket === "left"} />

      {frame?.note ? (
        <Panel>
          <Pill tone="neutral">{frame.note}</Pill>
        </Panel>
      ) : null}

      <Panel className="flex flex-wrap items-center justify-center gap-2">
        <BubbleButton tone="neutral" disabled={i === 0} onClick={() => setI((v) => Math.max(0, v - 1))}>
          ← Prev
        </BubbleButton>
        <BubbleButton tone="flame" onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </BubbleButton>
        <BubbleButton
          tone="grape"
          disabled={i >= total - 1}
          onClick={() => setI((v) => Math.min(total - 1, v + 1))}
        >
          Next →
        </BubbleButton>
      </Panel>

      <Panel className="flex flex-col items-center gap-2">
        <Label>Scan to open on another phone</Label>
        <img
          alt={`QR code linking to the ${play.data.name} play`}
          className="rounded-2xl border border-border bg-surface-2 p-2"
          width={148}
          height={148}
          src={`https://api.qrserver.com/v1/create-qr-code/?size=148x148&data=${encodeURIComponent(
            typeof window === "undefined" ? "" : window.location.href,
          )}`}
        />
      </Panel>
    </div>
  );
}
