import { useEffect, useMemo, useRef, useState } from "react";
import { BubbleButton, InfoPanel, Label, Panel, Pill, SectionHeader } from "@/components/Bubbles";
import { PlayCanvas } from "@/components/court/PlayCanvas";
import { ExportPlayVideo } from "@/components/court/ExportPlayVideo";
import type { CourtZoom } from "@/components/court/Court";
import {
  buildSteps,
  listOptionGroups,
  sampleStep,
  DO_MS,
  SHOW_MS,
  type BranchSelection,
  type OptionGroup,
  type PlayStep,
} from "@/lib/playAnimation";

import type { Play, PlayFrame } from "@/lib/types";

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
};

/** Turn legacy frame plays and newer sequence/action plays into one model. */
export function normalizePlayForPlayback(
  play: Pick<Play, "name" | "category" | "attack_basket"> | null | undefined,
  frames: PlayFrame[] | undefined,
  branch?: BranchSelection,
): NormalizedPlayback {
  const list = (frames ?? []).slice().sort((a, b) => a.idx - b.idx);
  const steps: NormalizedPlayback["steps"] = [];
  const options: NormalizedPlayback["options"] = [];
  list.forEach((frame, frameIdx) => {
    for (const step of buildSteps(frame, branch)) steps.push({ step, frameIdx, note: frame.note });
    for (const group of listOptionGroups(frame)) options.push({ frameIdx, group });
  });
  const labels = [
    ...new Set(
      list.flatMap((f) => f.tokens.filter((t) => (t.team ?? "offense") === "offense").map((t) => t.label)),
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
  };
}


export function PlayPresenter({
  play,
  frames,
  loading,
  className,
}: {
  play: Pick<Play, "name" | "category" | "attack_basket"> | null | undefined;
  frames: PlayFrame[] | undefined;
  loading?: boolean;
  className?: string;
}) {
  const [branch, setBranch] = useState<BranchSelection>({});
  const model = useMemo(
    () => normalizePlayForPlayback(play, frames, branch),
    [play, frames, branch],
  );
  const total = model.steps.length;


  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"show" | "do">("show");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [focus, setFocus] = useState<string | null>(null);
  const [zoom, setZoom] = useState<CourtZoom>("full");
  const raf = useRef(0);

  /** Where playback pauses so the viewer chooses an OPTION (first step at each option point). */
  const pauses = useMemo(
    () =>
      model.options
        .filter((o) => o.group.branches.length > 1)
        .map((o) => ({
          group: o.group,
          idx: model.steps.findIndex((s) => s.frameIdx === o.frameIdx && s.step.seq >= o.group.seq),
        }))
        .filter((p) => p.idx >= 0),
    [model],
  );
  const [choosing, setChoosing] = useState<OptionGroup | null>(null);
  const chosen = useRef(new Set<string>());

  useEffect(() => {
    setIdx(0);
    setPhase("show");
    setProgress(0);
    setPlaying(false);
    setChoosing(null);
    chosen.current.clear();
  }, [model.name]);

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
          const stop = pauses.find((p) => p.idx === idx + 1 && !chosen.current.has(p.group.group));
          if (stop) {
            setPlaying(false);
            setChoosing(stop.group);
            return 1;
          }
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
  }, [playing, phase, idx, total, speed, pauses]);

  const choose = (group: OptionGroup, key: string) => {
    chosen.current.add(group.group);
    setBranch((prev) => ({ ...prev, [group.group]: key }));
    const at = pauses.find((p) => p.group.group === group.group)?.idx ?? idx;
    setChoosing(null);
    setIdx(at);
    setPhase("show");
    setProgress(0);
    setPlaying(true);
  };

  const current = model.steps[Math.min(idx, Math.max(0, total - 1))];
  const sample = current ? sampleStep(current.step, phase, phase === "do" ? progress : 0) : null;
  const frame = current ? model.frames[current.frameIdx] : model.frames[0];

  const goto = (n: number) => {
    setChoosing(null);
    setIdx(Math.max(0, Math.min(total - 1, n)));
    setPhase("show");
    setProgress(0);
  };

  const focusTokenId = focus
    ? (sample?.tokens ?? frame?.tokens ?? []).find(
        (t) => t.label === focus && (t.team ?? "offense") === "offense",
      )?.id ?? null
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

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <SectionHeader as="h1" title={model.name} subtitle={model.category || undefined}>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="flame">Sequence {total ? idx + 1 : 0} of {total}</Pill>
            <Pill tone="neutral">{phase === "show" ? "Showing actions" : "Running play"}</Pill>
          </div>
          {current?.note ? <InfoPanel className="max-w-2xl">{current.note}</InfoPanel> : null}
        </SectionHeader>

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
            <button
              type="button"
              aria-label="Play this play"
              onClick={() => {
                chosen.current.clear();
                setPlaying(true);
              }}
              className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/45 backdrop-blur-[1px]"
            >
              <span className="rounded-full border-2 border-flame bg-flame/25 px-8 py-5 text-2xl font-black tracking-widest text-foreground shadow-lg shadow-black/40">
                ▶ PLAY
              </span>
            </button>
          ) : null}
          {choosing ? (
            <div className="absolute inset-x-2 bottom-2 flex justify-center">
              <Panel aria-label="Choose an option" className="flex max-w-full flex-col items-center gap-2 p-3 shadow-lg shadow-black/40">
                <Pill tone="flame">OPTION</Pill>
                <div className="flex flex-wrap justify-center gap-2">
                  {choosing.branches.map((b) => (
                    <BubbleButton
                      key={b.key}
                      size="sm"
                      tone="grape"
                      className="min-h-11 flex-col gap-0 px-3 py-1 leading-tight"
                      onClick={() => choose(choosing, b.key)}
                    >
                      <span>{`${b.key.toUpperCase()} — ${b.label}`}</span>
                      {b.condition ? <span className="text-[11px] font-semibold opacity-80">{b.condition}</span> : null}
                    </BubbleButton>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}
        </div>

        <Panel className="flex flex-wrap items-center justify-center gap-2">
          <BubbleButton
            tone="ghost"
            onClick={() => {
              setPlaying(false);
              chosen.current.clear();
              goto(0);
            }}
          >
            ⟲ Restart
          </BubbleButton>
          <BubbleButton tone="neutral" disabled={idx === 0} onClick={() => goto(idx - 1)}>
            ← Previous
          </BubbleButton>
          <BubbleButton tone="flame" disabled={total === 0 || !!choosing} onClick={() => setPlaying((p) => !p)}>
            {playing ? "❚❚ Pause" : "▶ Play"}
          </BubbleButton>
          <BubbleButton tone="grape" disabled={idx >= total - 1} onClick={() => goto(idx + 1)}>
            Next →
          </BubbleButton>
        </Panel>

        {model.options.length ? (
          <Panel className="flex flex-col items-center gap-2">
            {model.options.map((o) => {
              const current =
                branch[o.group.group] ?? o.group.branches[0]?.key ?? "";
              return (
                <div key={o.group.group} className="flex flex-wrap items-center justify-center gap-2">
                  <Pill tone="flame">OPTION</Pill>
                  {o.group.branches.map((b) => (
                    <BubbleButton
                      key={b.key}
                      size="sm"
                      tone={current === b.key ? "grape" : "neutral"}
                      className="min-h-11 flex-col gap-0 leading-tight"
                      onClick={() => {
                        chosen.current.add(o.group.group);
                        setChoosing(null);
                        setBranch((prev) => ({ ...prev, [o.group.group]: b.key }));
                      }}
                    >
                      <span>{`${b.key.toUpperCase()} — ${b.label}`}</span>
                      {b.condition ? <span className="text-[11px] font-semibold opacity-80">{b.condition}</span> : null}
                    </BubbleButton>
                  ))}
                </div>
              );
            })}
          </Panel>
        ) : null}

        <ExportPlayVideo model={model} />


        <Panel className="flex flex-wrap items-center justify-center gap-2">
          <Pill tone="muted">Court view</Pill>
          <BubbleButton size="sm" tone={zoom === "full" ? "grape" : "neutral"} onClick={() => setZoom("full")}>
            Full Court
          </BubbleButton>
          <BubbleButton size="sm" tone={zoom === "left" ? "grape" : "neutral"} onClick={() => setZoom("left")}>
            Zoom Left Half
          </BubbleButton>
          <BubbleButton size="sm" tone={zoom === "right" ? "grape" : "neutral"} onClick={() => setZoom("right")}>
            Zoom Right Half
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
