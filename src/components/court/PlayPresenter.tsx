import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isCourtView, playCamera, type CourtView } from "@/lib/playCamera";
import { trackActivityOnce } from "@/lib/activity";
import { BubbleButton, InfoPanel, Label, Panel, Pill, SectionHeader } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { ExportPlayVideo } from "@/components/court/ExportPlayVideo";
import type { CourtZoom } from "@/components/court/Court";
import {
  listOptionGroups,
  sampleStep,
  DO_MS,
  SHOW_MS,
  type BranchSelection,
  type OptionGroup,
  type PlayStep,
} from "@/lib/playAnimation";

import { buildSequentialSteps } from "@/lib/playSequence";
import type { Play, PlayFrame, PlayToken } from "@/lib/types";

/**
 * The one authoritative play playback surface.
 * Both the coach's Present Play mode and the public share link render this.
 */

export type NormalizedPlayback = {
  name: string;
  category: string;
  flip: boolean;
  frames: PlayFrame[];
  steps: { step: PlayStep; frameIdx: number; note: string | null }[];
  labels: string[];
  /** OPTION points, tagged with the frame they belong to. */
  options: { frameIdx: number; group: OptionGroup }[];
  /** The play's saved court view (camera only); null = automatic fit. */
  courtView: CourtView | null;
};

type PresentablePlay = Pick<Play, "name" | "category" | "attack_basket"> & {
  preferred_court_view?: string | null;
};

const savedView = (value: string | null | undefined): CourtView | null => (isCourtView(value) ? value : null);

/** Turn legacy frame plays and newer sequence/action plays into one model. */
export function normalizePlayForPlayback(
  play: PresentablePlay | null | undefined,
  frames: PlayFrame[] | undefined,
  branch?: BranchSelection,
): NormalizedPlayback {
  const list = (frames ?? []).slice().sort((a, b) => a.idx - b.idx);
  const steps: NormalizedPlayback["steps"] = [];
  const options: NormalizedPlayback["options"] = [];
  list.forEach((frame, frameIdx) => {
    for (const step of buildSequentialSteps(frame))
      steps.push({ step, frameIdx, note: frame.note });
    for (const group of listOptionGroups(frame)) options.push({ frameIdx, group });
  });
  const labels = [
    ...new Set(
      list.flatMap((f) =>
        f.tokens.filter((t) => (t.team ?? "offense") === "offense").map((t) => t.label),
      ),
    ),
  ];
  return {
    name: play?.name ?? "Play",
    category: play?.category ?? "",
    flip: play?.attack_basket === "left",
    frames: list,
    steps,
    labels,
    options,
    courtView: savedView(play?.preferred_court_view),
  };
}

/** Court width cap so the whole court fits the viewport height in quick mode. */
function quickCourtWidth(zoom: CourtZoom) {
  const ratio = zoom === "full" ? 1.88 : zoom === "top" || zoom === "bottom" ? 1.06 : 0.94;
  return `min(100%, calc((100dvh - 12.5rem) * ${ratio}))`;
}

export function PlayPresenter({
  play,
  frames,
  loading,
  className,
  actions: actionBar,
  compact,
  headerAction,
  onLoadPositions,
}: {
  play: PresentablePlay | null | undefined;
  frames: PlayFrame[] | undefined;
  loading?: boolean;
  className?: string;
  /** Optional coach action bar rendered right under the playback controls, above Export Video. */
  actions?: ReactNode;
  /** Quick-present mode (Timeout Board): court and playback controls only, sized to the screen. */
  compact?: boolean;
  /** Quick mode: buttons shown in the title row (e.g. Back to Board). */
  headerAction?: ReactNode;
  /** Quick mode: copy the players' currently shown positions somewhere (never action paths). */
  onLoadPositions?: (tokens: PlayToken[], camera: CourtZoom, flip: boolean) => void;
}) {
  const model = useMemo(() => normalizePlayForPlayback(play, frames), [play, frames]);
  const total = model.steps.length;

  // Activation funnel: a signed-in coach watched a play (once per device; skipped when signed out).
  useEffect(() => {
    if (play) trackActivityOnce("first_play_viewed", "device");
  }, [play]);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"show" | "do">("show");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [focus, setFocus] = useState<string | null>(null);
  /** Camera only: the play's saved view (or automatic fit), until the coach picks a view here. */
  const autoZoom = useMemo(
    () => playCamera(model.frames, model.flip, model.courtView),
    [model.frames, model.flip, model.courtView],
  );
  const [zoomOverride, setZoomOverride] = useState<CourtZoom | null>(null);
  const zoom: CourtZoom = zoomOverride ?? autoZoom;
  const setZoom = (z: CourtZoom) => setZoomOverride(z);
  const raf = useRef(0);

  useEffect(() => {
    setIdx(0);
    setPhase("show");
    setProgress(0);
    setPlaying(false);
    setZoomOverride(null);
  }, [model.name, model.courtView]);

  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, total - 1)));
  }, [total]);

  useEffect(() => {
    if (!playing || total === 0) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) * speed;
      last = now;
      setProgress((prev) => {
        const span = phase === "show" ? SHOW_MS : DO_MS;
        const next = prev + dt / span;
        if (next < 1) return next;
        if (phase === "show") {
          setPhase("do");
          return 0;
        }
        if (idx + 1 < total) {
          setIdx(idx + 1);
          setPhase("show");
          return 0;
        }
        setPlaying(false);
        return 1;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, phase, idx, total, speed]);

  const current = model.steps[Math.min(idx, Math.max(0, total - 1))];
  const sample = current ? sampleStep(current.step, phase, phase === "do" ? progress : 0) : null;
  const frame = current ? model.frames[current.frameIdx] : model.frames[0];

  const goto = (n: number) => {
    setIdx(Math.max(0, Math.min(total - 1, n)));
    setPhase("show");
    setProgress(0);
  };

  const focusTokenId = focus
    ? ((sample?.tokens ?? frame?.tokens ?? []).find(
        (t) => t.label === focus && (t.team ?? "offense") === "offense",
      )?.id ?? null)
    : null;

  const actions = current
    ? current.step.actions
    : (frame?.actions ?? []).filter((a) => a.seq === (frame?.actions[0]?.seq ?? 1));

  if (loading) {
    return (
      <Panel className="flex justify-center">
        <Label>Loading play…</Label>
      </Panel>
    );
  }

  const sequenceLabel = `Sequence ${
    current && "label" in current.step ? String(current.step.label) : total ? idx + 1 : 0
  } of ${total}`;

  const court = (
    <div className="relative">
      <PlayCanvas
        frame={frame}
        flip={model.flip}
        zoom={zoom}
        {...(sample
          ? {
              tokens: sample.tokens,
              ball: sample.ball,
              actions,
              activeSeq: current?.step.seq,
              dimOtherActions: true,
            }
          : {})}
        {...(focusTokenId ? { focusTokenId } : {})}
      />
      {!playing && idx === 0 && phase === "show" && progress === 0 && total > 0 ? (
        <BubbleButton
          tone="ghost"
          aria-label="Play this play"
          onClick={() => {
            setPlaying(true);
          }}
          className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/45 backdrop-blur-[1px]"
        >
          <span className="rounded-full border-2 border-flame bg-flame/25 px-8 py-5 text-2xl font-black tracking-widest text-foreground shadow-lg shadow-black/40">
            ▶ PLAY
          </span>
        </BubbleButton>
      ) : null}
    </div>
  );

  const controls = (
    <Panel className="flex flex-wrap items-center justify-center gap-2">
      <BubbleButton
        tone="ghost"
        onClick={() => {
          setPlaying(false);
          goto(0);
        }}
      >
        ⟲ Restart
      </BubbleButton>
      <BubbleButton tone="neutral" disabled={idx === 0} onClick={() => goto(idx - 1)}>
        ← Previous
      </BubbleButton>
      <BubbleButton tone="flame" disabled={total === 0} onClick={() => setPlaying((p) => !p)}>
        {playing ? "❚❚ Pause" : "▶ Play"}
      </BubbleButton>
      <BubbleButton tone="grape" disabled={idx >= total - 1} onClick={() => goto(idx + 1)}>
        Next →
      </BubbleButton>
      {onLoadPositions ? (
        <BubbleButton
          tone="neutral"
          disabled={!(sample?.tokens ?? frame?.tokens ?? []).length}
          onClick={() => {
            setPlaying(false);
            onLoadPositions(sample?.tokens ?? frame?.tokens ?? [], zoom, model.flip);
          }}
        >
          Load positions onto Board
        </BubbleButton>
      ) : null}
    </Panel>
  );

  if (compact) {
    return (
      <div className={className}>
        <div className="flex flex-col gap-2">
          <Panel className="flex flex-wrap items-center gap-2 p-2">
            {headerAction}
            <Pill tone="grape" className="min-w-0 max-w-full truncate text-sm">{model.name}</Pill>
            {model.category ? <Pill tone="muted">{model.category}</Pill> : null}
            <Pill tone="flame">{sequenceLabel}</Pill>
          </Panel>
          <div className="mx-auto w-full" style={{ maxWidth: quickCourtWidth(zoom) }}>
            {court}
          </div>
          {current?.note ? <InfoPanel className="mx-auto max-w-2xl">{current.note}</InfoPanel> : null}
          {controls}
          {total === 0 ? (
            <Panel className="flex justify-center">
              <Label>This play has no actions yet</Label>
            </Panel>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <SectionHeader as="h1" title={model.name} subtitle={model.category || undefined}>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="flame">{sequenceLabel}</Pill>
            <Pill tone="neutral">{phase === "show" ? "Showing actions" : "Running play"}</Pill>
          </div>
          {current?.note ? <InfoPanel className="max-w-2xl">{current.note}</InfoPanel> : null}
        </SectionHeader>

        {court}

        {controls}


        {actionBar ?? null}

        <ExportPlayVideo model={model} />

        <Panel className="flex flex-wrap items-center justify-center gap-2">
          <Pill tone="muted">Court view</Pill>
          <BubbleButton
            size="sm"
            tone={zoom === "full" ? "grape" : "neutral"}
            onClick={() => setZoom("full")}
          >
            Full Court
          </BubbleButton>
          <BubbleButton
            size="sm"
            tone={zoom === "left" ? "grape" : "neutral"}
            onClick={() => setZoom("left")}
          >
            Zoom Left Half
          </BubbleButton>
          <BubbleButton
            size="sm"
            tone={zoom === "right" ? "grape" : "neutral"}
            onClick={() => setZoom("right")}
          >
            Zoom Right Half
          </BubbleButton>
          <BubbleButton size="sm" tone={zoom === "top" ? "grape" : "neutral"} onClick={() => setZoom("top")}>
            Top Half
          </BubbleButton>
          <BubbleButton size="sm" tone={zoom === "bottom" ? "grape" : "neutral"} onClick={() => setZoom("bottom")}>
            Bottom Half
          </BubbleButton>
        </Panel>

        <Panel className="flex flex-wrap items-center justify-center gap-2">
          <Pill tone="muted">Speed</Pill>
          {[0.5, 1, 1.5, 2].map((s) => (
            <BubbleButton
              key={s}
              size="sm"
              tone={speed === s ? "flame" : "neutral"}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </BubbleButton>
          ))}
        </Panel>

        {model.labels.length ? (
          <Panel className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="muted">View</Pill>
            <BubbleButton
              size="sm"
              tone={focus === null ? "grape" : "neutral"}
              onClick={() => setFocus(null)}
            >
              All players
            </BubbleButton>
            {model.labels.map((l) => (
              <BubbleButton
                key={l}
                size="sm"
                tone={focus === l ? "grape" : "neutral"}
                onClick={() => setFocus(focus === l ? null : l)}
              >
                #{l}
              </BubbleButton>
            ))}
          </Panel>
        ) : null}

        {total === 0 ? (
          <Panel className="flex justify-center">
            <Label>This play has no actions yet</Label>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
