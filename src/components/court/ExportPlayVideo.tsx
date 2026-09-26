import { PaidGate } from "@/components/billing/PaidGate";
import { useEffect, useRef, useState } from "react";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import {
  DEFAULT_EXPORT_OPTIONS,
  FORMAT_SIZE,
  isMp4Blob,
  playVideoFileName,
  renderPlayVideo,
  type ExportFormat,
  type ExportModel,
  type ExportOptions,
  type ExportSpeed,
} from "@/lib/playVideo";

/**
 * Export the animated play to a social-ready MP4. Uses the shared play
 * animation model, so the download matches Present Play.
 */
function ExportPlayVideoInner({
  model,
  className,
}: {
  model: ExportModel;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [resultFormat, setResultFormat] = useState<ExportFormat | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const empty = model.steps.length === 0;
  const contentLabel = model.kind === "drill" ? "drill" : "play";

  const reset = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setResultFormat(null);
    setError(null);
    setProgress(0);
  };

  const generate = async () => {
    reset();
    setBusy(true);
    try {
      const blob = await renderPlayVideo(model, opts, setProgress);
      if (!(await isMp4Blob(blob))) {
        throw new Error("The encoder did not return a valid MP4 file. Please try again.");
      }
      const nextUrl = URL.createObjectURL(blob);
      urlRef.current = nextUrl;
      setResultFormat(opts.format);
      setUrl(nextUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The video could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: keyof ExportOptions, value: boolean) => {
    setOpts((o) => ({ ...o, [key]: value }));
  };

  const download = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = playVideoFileName(model.name);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const previewClass =
    resultFormat === "vertical"
      ? "aspect-[9/16] max-w-sm"
      : resultFormat === "square"
        ? "aspect-square max-w-xl"
        : "aspect-video max-w-3xl";

  return (
    <section className={className} aria-labelledby="export-video-title">
      <Panel className="flex w-full min-w-0 flex-col gap-3 overflow-visible border-flame/40">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2
              id="export-video-title"
              className="inline-flex rounded-2xl border border-flame/60 bg-flame/20 px-4 py-2 text-lg font-black text-foreground"
            >
              Export Video
            </h2>
            <Pill tone={busy ? "flame" : url ? "success" : "muted"}>
              {busy ? `Generating ${Math.round(progress * 100)}%` : url ? "Ready to Download" : "Ready"}
            </Pill>
          </div>
          <BubbleButton size="sm" tone={open ? "ghost" : "flame"} onClick={() => setOpen((value) => !value)}>
            {open ? "Hide" : "Export MP4"}
          </BubbleButton>
        </div>

        {open ? (
          <div className="flex min-w-0 flex-col gap-3">
            {empty ? (
              <div className="flex justify-center rounded-2xl border border-border bg-surface-2/50 p-3">
                <Label>This {contentLabel} has no actions yet, so there is nothing to animate. Add actions first.</Label>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/50 p-3">
                  <Pill tone="muted">Format</Pill>
                  {(Object.keys(FORMAT_SIZE) as ExportFormat[]).map((f) => (
                    <BubbleButton
                      key={f}
                      size="sm"
                      tone={opts.format === f ? "grape" : "neutral"}
                      onClick={() => {
                        setOpts((o) => ({ ...o, format: f }));
                      }}
                    >
                      {FORMAT_SIZE[f].label}
                    </BubbleButton>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/50 p-3">
                  <Pill tone="muted">Speed</Pill>
                  {(["slow", "normal", "fast"] as ExportSpeed[]).map((s) => (
                    <BubbleButton
                      key={s}
                      size="sm"
                      tone={opts.speed === s ? "flame" : "neutral"}
                      onClick={() => {
                        setOpts((o) => ({ ...o, speed: s }));
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </BubbleButton>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/50 p-3">
                  <Pill tone="muted">Include</Pill>
                  <BubbleButton
                    size="sm"
                    tone={opts.showWatermark ? "grape" : "neutral"}
                    aria-pressed={opts.showWatermark}
                    onClick={() => toggle("showWatermark", !opts.showWatermark)}
                  >
                    {opts.showWatermark ? "✓ Watermark" : "Watermark off"}
                  </BubbleButton>
                  <BubbleButton
                    size="sm"
                    tone={opts.showSequenceNumbers ? "grape" : "neutral"}
                    aria-pressed={opts.showSequenceNumbers}
                    onClick={() => toggle("showSequenceNumbers", !opts.showSequenceNumbers)}
                  >
                    {opts.showSequenceNumbers ? "✓ Sequence numbers" : "Sequence numbers off"}
                  </BubbleButton>
                  <BubbleButton
                    size="sm"
                    tone={opts.holdEnd ? "grape" : "neutral"}
                    aria-pressed={opts.holdEnd}
                    onClick={() => toggle("holdEnd", !opts.holdEnd)}
                  >
                    {opts.holdEnd ? "✓ Hold final frame" : "Hold final frame off"}
                  </BubbleButton>
                </div>

                {error ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/15 p-3">
                    <Pill tone="flame">Export failed</Pill>
                    <Label>{error}</Label>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2/50 p-3">
                  {busy ? (
                    <Pill tone="flame" role="status" aria-live="polite">
                      Generating video… {Math.round(progress * 100)}%
                    </Pill>
                  ) : url ? (
                    <>
                      <BubbleButton tone="flame" onClick={download}>⬇ Download MP4</BubbleButton>
                      <BubbleButton tone="neutral" onClick={generate}>
                        ⟲ Regenerate
                      </BubbleButton>
                    </>
                  ) : (
                    <BubbleButton tone="flame" onClick={generate}>
                      ▶ Generate Video
                    </BubbleButton>
                  )}
                </div>

                {url && resultFormat ? (
                  <div className={`mx-auto w-full overflow-hidden rounded-2xl border border-border bg-background ${previewClass}`}>
                    <video
                      src={url}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Panel>
    </section>
  );
}

export function ExportPlayVideo(props: Parameters<typeof ExportPlayVideoInner>[0]) {
  return (
    <PaidGate module="playbook_plus" benefit="Download your plays as MP4 videos for social and film sessions.">
      <ExportPlayVideoInner {...props} />
    </PaidGate>
  );
}
