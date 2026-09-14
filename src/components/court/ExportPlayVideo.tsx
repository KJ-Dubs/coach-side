import { useEffect, useState } from "react";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import {
  DEFAULT_EXPORT_OPTIONS,
  FORMAT_SIZE,
  canExportVideo,
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
export function ExportPlayVideo({
  model,
  size = "md",
  className,
}: {
  model: ExportModel;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const empty = model.steps.length === 0;

  const reset = () => {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setError(null);
    setProgress(0);
  };

  const generate = async () => {
    reset();
    setBusy(true);
    try {
      const blob = await renderPlayVideo(model, opts, setProgress);
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The video could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: keyof ExportOptions, value: boolean) => {
    reset();
    setOpts((o) => ({ ...o, [key]: value }));
  };

  return (
    <>
      <BubbleButton
        size={size}
        tone="flame"
        className={className ?? ""}
        aria-label="Export this play as an MP4 video"
        onClick={() => setOpen(true)}
      >
        ⬇ Export MP4
      </BubbleButton>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-background/80 p-3 sm:items-center">
          <Panel className="flex w-full max-w-xl flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="inline-flex rounded-2xl border border-flame/60 bg-flame/20 px-4 py-2 text-lg font-black text-foreground">
                Export MP4
              </h2>
              <Pill tone="muted">{model.name}</Pill>
              <BubbleButton
                size="sm"
                tone="ghost"
                className="ml-auto"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                ✕ Close
              </BubbleButton>
            </div>

            {empty ? (
              <Panel className="flex justify-center">
                <Label>This play has no actions yet, so there is nothing to animate. Add actions first.</Label>
              </Panel>
            ) : !canExportVideo() ? (
              <Panel className="flex justify-center">
                <Label>This browser cannot create MP4 files. Try Chrome, Edge, or Safari 17+.</Label>
              </Panel>
            ) : (
              <>
                <Panel className="flex flex-wrap items-center gap-2">
                  <Pill tone="muted">Format</Pill>
                  {(Object.keys(FORMAT_SIZE) as ExportFormat[]).map((f) => (
                    <BubbleButton
                      key={f}
                      size="sm"
                      tone={opts.format === f ? "grape" : "neutral"}
                      onClick={() => {
                        reset();
                        setOpts((o) => ({ ...o, format: f }));
                      }}
                    >
                      {FORMAT_SIZE[f].label}
                    </BubbleButton>
                  ))}
                </Panel>

                <Panel className="flex flex-wrap items-center gap-2">
                  <Pill tone="muted">Speed</Pill>
                  {(["slow", "normal", "fast"] as ExportSpeed[]).map((s) => (
                    <BubbleButton
                      key={s}
                      size="sm"
                      tone={opts.speed === s ? "flame" : "neutral"}
                      onClick={() => {
                        reset();
                        setOpts((o) => ({ ...o, speed: s }));
                      }}
                    >
                      {s[0]!.toUpperCase() + s.slice(1)}
                    </BubbleButton>
                  ))}
                </Panel>

                <Panel className="flex flex-wrap items-center gap-2">
                  <Pill tone="muted">Include</Pill>
                  <BubbleButton
                    size="sm"
                    tone={opts.showTitle ? "grape" : "neutral"}
                    aria-pressed={opts.showTitle}
                    onClick={() => toggle("showTitle", !opts.showTitle)}
                  >
                    {opts.showTitle ? "✓ Title" : "Title off"}
                  </BubbleButton>
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
                </Panel>

                {error ? (
                  <Panel className="flex flex-wrap items-center justify-center gap-2">
                    <Pill tone="flame">Export failed</Pill>
                    <Label>{error}</Label>
                  </Panel>
                ) : null}

                <Panel className="flex flex-wrap items-center justify-center gap-2">
                  {busy ? (
                    <Pill tone="flame">Generating video… {Math.round(progress * 100)}%</Pill>
                  ) : url ? (
                    <>
                      <a href={url} download={playVideoFileName(model.name, opts.format)}>
                        <BubbleButton tone="flame">⬇ Download MP4</BubbleButton>
                      </a>
                      <BubbleButton tone="neutral" onClick={generate}>
                        ⟲ Generate again
                      </BubbleButton>
                    </>
                  ) : (
                    <BubbleButton tone="flame" onClick={generate}>
                      ▶ Generate Video
                    </BubbleButton>
                  )}
                </Panel>

                {url ? (
                  <video
                    src={url}
                    controls
                    playsInline
                    className="max-h-[45vh] w-full rounded-2xl border border-border bg-black"
                  />
                ) : null}
              </>
            )}
          </Panel>
        </div>
      ) : null}
    </>
  );
}
