// Social-video export for plays.
// Renders the SAME animation model used by PlayPresenter (buildSteps/sampleStep
// + playPath geometry) onto a 2D canvas and encodes it to a real MP4 via
// WebCodecs (mediabunny muxer). No second animation engine: only a second
// *painter* for the same normalized play data.

import { curlGeom, dribbleD, polyD, PW, PH, type Point } from "./playPath";
import { sampleStep, SHOW_MS, DO_MS, type PlayStep } from "./playAnimation";
import type { PlayAction, PlayFrame, PlayToken } from "./types";

export type ExportFormat = "vertical" | "landscape" | "square";
export type ExportSpeed = "slow" | "normal" | "fast";

export const FORMAT_SIZE: Record<ExportFormat, { w: number; h: number; label: string }> = {
  vertical: { w: 1080, h: 1920, label: "Vertical 9:16" },
  landscape: { w: 1920, h: 1080, label: "Landscape 16:9" },
  square: { w: 1080, h: 1080, label: "Square 1:1" },
};

const SPEED_FACTOR: Record<ExportSpeed, number> = { slow: 0.7, normal: 1, fast: 1.5 };

export type ExportOptions = {
  format: ExportFormat;
  speed: ExportSpeed;
  showTitle: boolean;
  showWatermark: boolean;
  showSequenceNumbers: boolean;
  holdEnd: boolean;
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "vertical",
  speed: "normal",
  showTitle: true,
  showWatermark: true,
  showSequenceNumbers: true,
  holdEnd: true,
};

export type ExportModel = {
  name: string;
  category: string;
  flip: boolean;
  frames: PlayFrame[];
  steps: { step: PlayStep; frameIdx: number; note: string | null }[];
};

export function canExportVideo() {
  return typeof window !== "undefined" && typeof (window as { VideoEncoder?: unknown }).VideoEncoder === "function";
}

/* ---------------- theme colors ---------------- */

type Palette = {
  bg: string;
  panel: string;
  court: string;
  line: string;
  grape: string;
  flame: string;
  text: string;
  surface2: string;
};

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function palette(): Palette {
  return {
    bg: cssVar("--background", "#141417"),
    panel: cssVar("--surface-1", "#1d1d22"),
    court: cssVar("--court", "#23232a"),
    line: cssVar("--court-line", "#6b6b78"),
    grape: cssVar("--grape", "#8b5cf6"),
    flame: cssVar("--flame", "#f97316"),
    text: cssVar("--foreground", "#f5f5f7"),
    surface2: cssVar("--surface-2", "#2a2a31"),
  };
}

/* ---------------- court painting (mirrors Court.tsx geometry) ---------------- */

function halfLines(ctx: CanvasRenderingContext2D, p: Palette, mirrored: boolean) {
  ctx.save();
  if (mirrored) {
    ctx.translate(940, 0);
    ctx.scale(-1, 1);
  }
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 500);
  ctx.stroke();
  ctx.strokeRect(0, 190, 190, 120);
  ctx.beginPath();
  ctx.arc(190, 250, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.stroke(new Path2D("M 52.5 210 A 40 40 0 0 1 52.5 290"));
  ctx.strokeStyle = p.flame;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(40, 220);
  ctx.lineTo(40, 280);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 250);
  ctx.lineTo(49, 250);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(52.5, 250, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 3;
  ctx.stroke(new Path2D("M 0 52.5 L 52.5 52.5 A 197.5 197.5 0 0 1 52.5 447.5 L 0 447.5"));
  ctx.restore();
}

function drawCourt(ctx: CanvasRenderingContext2D, p: Palette) {
  ctx.fillStyle = p.court;
  ctx.fillRect(0, 0, PW, PH);
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, PW - 4, PH - 4);
  halfLines(ctx, p, false);
  halfLines(ctx, p, true);
  ctx.beginPath();
  ctx.moveTo(470, 0);
  ctx.lineTo(470, 500);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(470, 250, 60, 0, Math.PI * 2);
  ctx.stroke();
}

/* ---------------- play painting (mirrors PlayCanvas.tsx) ---------------- */

const xf = (pt: Point, flip: boolean) => ({
  x: (flip ? 1 - pt.x : pt.x) * PW,
  y: (flip ? 1 - pt.y : pt.y) * PH,
});

function actionColor(type: string, p: Palette) {
  if (type === "pass" || type === "handoff" || type === "shot") return p.flame;
  if (type === "screen") return p.line;
  return p.grape;
}

function drawAction(
  ctx: CanvasRenderingContext2D,
  a: PlayAction,
  flip: boolean,
  p: Palette,
  dim: boolean,
  showSeq: boolean,
  reveal: number,
) {
  const raw = a.points ?? [];
  if (raw.length < 2) return;
  const freehand = raw.length > 2;
  const pts = raw.map((q) => xf(q, flip));
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const color = actionColor(a.type, p);
  const prev = pts[pts.length - 2] ?? start;
  const curl = !freehand && a.type === "curl" ? curlGeom(start, end) : null;
  const angle = curl ? curl.angle : Math.atan2(end.y - prev.y, end.x - prev.x);
  const mid = curl
    ? curl.mid
    : freehand
      ? pts[Math.floor(pts.length / 2)]!
      : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  const d = curl
    ? curl.d
    : freehand
      ? polyD(pts)
      : a.type === "dribble"
        ? dribbleD(start, end)
        : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

  ctx.save();
  ctx.globalAlpha = dim ? 0.28 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (a.type === "pass" || a.type === "shot") ctx.setLineDash([14, 12]);
  const path = new Path2D(d);
  if (reveal < 1) {
    // "SHOW" phase draws the line progressively left-to-right along its bbox.
    ctx.save();
    const minX = Math.min(...pts.map((q) => q.x)) - 60;
    const maxX = Math.max(...pts.map((q) => q.x)) + 60;
    ctx.beginPath();
    ctx.rect(minX, -50, (maxX - minX) * reveal, PH + 100);
    ctx.clip();
    ctx.stroke(path);
    ctx.restore();
  } else {
    ctx.stroke(path);
  }
  ctx.setLineDash([]);

  if (reveal >= 0.95) {
    if (a.type === "screen") {
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(end.x - Math.sin(angle) * 18, end.y + Math.cos(angle) * 18);
      ctx.lineTo(end.x + Math.sin(angle) * 18, end.y - Math.cos(angle) * 18);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - 20 * Math.cos(angle - 0.4), end.y - 20 * Math.sin(angle - 0.4));
      ctx.lineTo(end.x - 20 * Math.cos(angle + 0.4), end.y - 20 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }
    if (a.type === "shot") {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (showSeq) {
      ctx.fillStyle = p.grape;
      ctx.strokeStyle = p.bg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(a.seq), mid.x, mid.y + 6);
    }
  }
  ctx.restore();
}

function drawToken(ctx: CanvasRenderingContext2D, t: PlayToken, flip: boolean, p: Palette) {
  const q = xf(t, flip);
  const defense = t.team === "defense";
  ctx.save();
  ctx.fillStyle = p.surface2;
  ctx.lineWidth = 4;
  if (defense) {
    ctx.strokeStyle = p.flame;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.roundRect(q.x - 19, q.y - 19, 38, 38, 7);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = p.grape;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = defense ? p.flame : p.text;
  ctx.font = "900 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(defense ? `X${t.label}` : t.label, q.x, q.y + 7);
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, q: Point, p: Palette) {
  ctx.save();
  ctx.fillStyle = p.flame;
  ctx.strokeStyle = p.bg;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(q.x, q.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(q.x - 13, q.y);
  ctx.lineTo(q.x + 13, q.y);
  ctx.moveTo(q.x, q.y - 13);
  ctx.lineTo(q.x, q.y + 13);
  ctx.stroke();
  ctx.restore();
}

/* ---------------- full frame composition ---------------- */

function roundedBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function withAlpha(color: string, alpha: number) {
  return color.startsWith("#") && color.length === 7
    ? `${color}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`
    : color;
}

type FrameState = {
  tokens: PlayToken[];
  actions: PlayAction[];
  ball: Point | null;
  ballAttached: boolean;
  activeSeq: number;
  seqIndex: number;
  reveal: number;
  note: string | null;
};

function paintFrame(
  ctx: CanvasRenderingContext2D,
  model: ExportModel,
  opts: ExportOptions,
  p: Palette,
  state: FrameState,
  totalSteps: number,
) {
  const { w, h } = FORMAT_SIZE[opts.format];
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round(w * 0.04);
  const headerH = opts.showTitle ? Math.round(h * (opts.format === "vertical" ? 0.13 : 0.16)) : pad;

  if (opts.showTitle) {
    ctx.save();
    ctx.textAlign = "left";
    const brandSize = Math.round(w * 0.038);
    ctx.font = `900 ${brandSize}px system-ui, sans-serif`;
    const brandW = ctx.measureText("COACHSIDE").width + brandSize * 1.2;
    roundedBubble(ctx, pad, pad, brandW, brandSize * 1.9, withAlpha(p.grape, 0.25), p.grape);
    ctx.fillStyle = p.text;
    ctx.fillText("COACHSIDE", pad + brandSize * 0.6, pad + brandSize * 1.33);

    const nameSize = Math.round(w * 0.055);
    ctx.font = `900 ${nameSize}px system-ui, sans-serif`;
    ctx.fillStyle = p.text;
    ctx.fillText(model.name, pad, pad + brandSize * 1.9 + nameSize * 1.15);

    if (model.category) {
      const catSize = Math.round(w * 0.028);
      ctx.font = `800 ${catSize}px system-ui, sans-serif`;
      ctx.fillStyle = p.flame;
      ctx.fillText(model.category.toUpperCase(), pad, pad + brandSize * 1.9 + nameSize * 1.15 + catSize * 1.6);
    }
    ctx.restore();
  }

  const footerH = Math.round(h * (opts.format === "vertical" ? 0.09 : 0.11));
  const availW = w - pad * 2;
  const availH = h - headerH - footerH - pad;
  const scale = Math.min(availW / PW, availH / PH);
  const courtW = PW * scale;
  const courtH = PH * scale;
  const courtX = (w - courtW) / 2;
  const courtY = headerH + (availH - courtH) / 2;

  ctx.save();
  ctx.translate(courtX, courtY);
  ctx.scale(scale, scale);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, PW, PH, 18);
  ctx.clip();
  drawCourt(ctx, p);
  for (const a of state.actions)
    drawAction(ctx, a, model.flip, p, a.seq !== state.activeSeq, opts.showSequenceNumbers, state.reveal);
  for (const t of state.tokens) drawToken(ctx, t, model.flip, p);
  if (state.ball) {
    const bp = xf(state.ball, model.flip);
    drawBall(ctx, state.ballAttached ? { x: bp.x + 22, y: bp.y - 20 } : bp, p);
  }
  ctx.restore();
  ctx.restore();

  // Sequence pill above court
  if (opts.showSequenceNumbers && totalSteps > 0) {
    const s = Math.round(w * 0.03);
    ctx.save();
    ctx.font = `800 ${s}px system-ui, sans-serif`;
    const label = `SEQUENCE ${state.seqIndex + 1} / ${totalSteps}`;
    const tw = ctx.measureText(label).width + s * 1.4;
    const by = Math.max(pad, courtY - s * 2.6);
    roundedBubble(ctx, pad, by, tw, s * 1.9, withAlpha(p.flame, 0.22), p.flame);
    ctx.fillStyle = p.text;
    ctx.textAlign = "left";
    ctx.fillText(label, pad + s * 0.7, by + s * 1.33);
    ctx.restore();
  }

  if (opts.showWatermark) {
    const s = Math.round(w * 0.032);
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.font = `900 ${s}px system-ui, sans-serif`;
    const label = "coachside.live";
    const tw = ctx.measureText(label).width + s * 1.4;
    const bx = w - pad - tw;
    const by = h - pad - s * 1.9;
    roundedBubble(ctx, bx, by, tw, s * 1.9, withAlpha(p.panel, 0.85), p.flame);
    ctx.fillStyle = p.text;
    ctx.textAlign = "left";
    ctx.fillText(label, bx + s * 0.7, by + s * 1.33);
    ctx.restore();
  }
}

/* ---------------- frame timeline ---------------- */

const FPS = 30;

function frameCounts(model: ExportModel, opts: ExportOptions) {
  const factor = SPEED_FACTOR[opts.speed];
  const showFrames = Math.max(6, Math.round((SHOW_MS / factor / 1000) * FPS));
  const doFrames = Math.max(8, Math.round((DO_MS / factor / 1000) * FPS));
  const holdFrames = opts.holdEnd ? Math.round(FPS * 1.2) : 0;
  return {
    showFrames,
    doFrames,
    holdFrames,
    total: model.steps.length * (showFrames + doFrames) + holdFrames,
  };
}

/** Paint every frame of the play in order, awaiting the encoder between frames. */
async function eachFrame(
  ctx: CanvasRenderingContext2D,
  model: ExportModel,
  opts: ExportOptions,
  p: Palette,
  emit: () => Promise<void>,
) {
  const { showFrames, doFrames, holdFrames } = frameCounts(model, opts);
  const totalSteps = model.steps.length;

  for (let s = 0; s < totalSteps; s++) {
    const entry = model.steps[s]!;
    const step = entry.step;
    for (let f = 0; f < showFrames; f++) {
      const sample = sampleStep(step, "show", 0);
      paintFrame(
        ctx,
        model,
        opts,
        p,
        {
          tokens: sample.tokens,
          actions: step.actions,
          ball: sample.ball,
          ballAttached: true,
          activeSeq: step.seq,
          seqIndex: s,
          reveal: Math.min(1, (f + 1) / Math.max(1, showFrames - 2)),
          note: entry.note,
        },
        totalSteps,
      );
      await emit();
    }
    for (let f = 0; f < doFrames; f++) {
      const sample = sampleStep(step, "do", (f + 1) / doFrames);
      paintFrame(
        ctx,
        model,
        opts,
        p,
        {
          tokens: sample.tokens,
          actions: step.actions,
          ball: sample.ball,
          ballAttached: !!sample.ballOwner,
          activeSeq: step.seq,
          seqIndex: s,
          reveal: 1,
          note: entry.note,
        },
        totalSteps,
      );
      await emit();
    }
  }

  if (holdFrames > 0 && totalSteps > 0) {
    const last = model.steps[totalSteps - 1]!;
    const sample = sampleStep(last.step, "do", 1);
    for (let f = 0; f < holdFrames; f++) {
      paintFrame(
        ctx,
        model,
        opts,
        p,
        {
          tokens: sample.tokens,
          actions: last.step.actions,
          ball: sample.ball,
          ballAttached: !!sample.ballOwner,
          activeSeq: last.step.seq,
          seqIndex: totalSteps - 1,
          reveal: 1,
          note: last.note,
        },
        totalSteps,
      );
      await emit();
    }
  }
}

function makeCanvas(w: number, h: number, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((w * scale) / 2) * 2;
  canvas.height = Math.round((h * scale) / 2) * 2;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not prepare the video canvas.");
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
  return { canvas, ctx };
}

/* ---------------- encoders ---------------- */

/** Preferred path: hardware/software H.264 through WebCodecs, muxed to MP4. */
async function encodeWithWebCodecs(
  model: ExportModel,
  opts: ExportOptions,
  p: Palette,
  onProgress?: (f: number) => void,
): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } = await import("mediabunny");
  const { w, h } = FORMAT_SIZE[opts.format];
  const { canvas, ctx } = makeCanvas(w, h, 1);
  const total = frameCounts(model, opts).total;

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: "avc", bitrate: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  let i = 0;
  await eachFrame(ctx, model, opts, p, async () => {
    await source.add(i / FPS, 1 / FPS);
    i++;
    onProgress?.(Math.min(0.99, i / total));
  });

  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("empty output");
  return new Blob([buffer], { type: "video/mp4" });
}

let hmePromise: Promise<{ createH264MP4Encoder: () => Promise<Record<string, never>> }> | null = null;

async function loadWasmEncoder() {
  if (!hmePromise) {
    hmePromise = (async () => {
      const url = (await import("h264-mp4-encoder/embuild/dist/h264-mp4-encoder.web.js?url")).default;
      const g = window as unknown as Record<string, unknown>;
      if (!g["HME"]) {
        await new Promise<void>((resolve, reject) => {
          const el = document.createElement("script");
          el.src = url;
          el.onload = () => resolve();
          el.onerror = () => reject(new Error("Could not load the video encoder."));
          document.head.appendChild(el);
        });
      }
      const hme = g["HME"];
      if (!hme) throw new Error("Could not load the video encoder.");
      return hme as { createH264MP4Encoder: () => Promise<Record<string, never>> };
    })();
  }
  return hmePromise;
}

type WasmEncoder = {
  width: number;
  height: number;
  frameRate: number;
  quantizationParameter: number;
  speed: number;
  initialize: () => void;
  addFrameRgba: (data: Uint8Array) => void;
  finalize: () => void;
  FS: { readFile: (name: string) => Uint8Array };
  outputFilename: string;
  delete: () => void;
};

/** Fallback path: pure-WASM H.264 encoder, works where WebCodecs H.264 is unavailable. */
async function encodeWithWasm(
  model: ExportModel,
  opts: ExportOptions,
  p: Palette,
  onProgress?: (f: number) => void,
): Promise<Blob> {
  const HME = await loadWasmEncoder();
  const { w, h } = FORMAT_SIZE[opts.format];
  const scale = 2 / 3; // 720p-class output keeps WASM encoding fast enough
  const { canvas, ctx } = makeCanvas(w, h, scale);
  const total = frameCounts(model, opts).total;

  const enc = (await HME.createH264MP4Encoder()) as unknown as WasmEncoder;
  enc.width = canvas.width;
  enc.height = canvas.height;
  enc.frameRate = FPS;
  enc.quantizationParameter = 24;
  enc.speed = 6;
  enc.initialize();

  let i = 0;
  await eachFrame(ctx, model, opts, p, async () => {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: "srgb" } as ImageDataSettings);
    enc.addFrameRgba(new Uint8Array(img.data.buffer.slice(0)));
    i++;
    onProgress?.(Math.min(0.99, i / total));
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  });

  enc.finalize();
  const bytes = enc.FS.readFile(enc.outputFilename);
  const copy = new Uint8Array(bytes);
  enc.delete();
  return new Blob([copy], { type: "video/mp4" });
}

export async function renderPlayVideo(
  model: ExportModel,
  opts: ExportOptions,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  if (!model.steps.length) throw new Error("This play has no actions to animate yet.");
  const p = palette();

  if (canExportVideo()) {
    try {
      const blob = await encodeWithWebCodecs(model, opts, p, onProgress);
      onProgress?.(1);
      return blob;
    } catch {
      // fall through to the WASM encoder
    }
  }
  const blob = await encodeWithWasm(model, opts, p, onProgress);
  onProgress?.(1);
  return blob;
}

export function playVideoFileName(name: string, format: ExportFormat) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "play";
  return `coachside-${slug}-${format}.mp4`;
}
