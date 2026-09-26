// Social-video export for plays.
// Renders the SAME animation model used by PlayPresenter (buildSteps/sampleStep
// + playPath geometry) onto a 2D canvas and encodes it to a real MP4 via
// WebCodecs (mediabunny muxer). No second animation engine: only a second
// *painter* for the same normalized play data.

import { curlGeom, dribbleD, polyD, PW, PH, type Point } from "./playPath";
import { sampleStep, SHOW_MS, DO_MS, type PlayStep } from "./playAnimation";
import type { PlayAction, PlayFrame, PlayToken } from "./types";
import type { DrillFrame, DrillObject } from "./drills";
import { drillStateAtSequenceStart, sampleDrillBalls } from "./drillBalls";
import coachsideMark from "@/assets/coachside-mark.jpg.asset.json";

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
  kind?: "play" | "drill";
  frames: PlayFrame[];
  steps: { step: PlayStep; frameIdx: number; note: string | null }[];
  drillFrames?: DrillFrame[];
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
    : a.type === "dribble"
      ? dribbleD(pts)
      : freehand
        ? polyD(pts)
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

function drawDrillObject(ctx: CanvasRenderingContext2D, object: DrillObject, flip: boolean, p: Palette) {
  if (object.type === "ball" || object.type === "line") return;
  const q = xf(object, flip);
  ctx.save();
  ctx.strokeStyle = p.flame;
  ctx.fillStyle = p.flame;
  ctx.lineWidth = 5;
  if (object.type === "cone") {
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - 16);
    ctx.lineTo(q.x - 13, q.y + 12);
    ctx.lineTo(q.x + 13, q.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.bg;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (object.type === "chair") {
    ctx.beginPath();
    ctx.roundRect(q.x - 14, q.y - 14, 28, 28, 5);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(q.x - 14, q.y - 14);
    ctx.lineTo(q.x + 14, q.y - 14);
    ctx.stroke();
  } else if (object.type === "text") {
    ctx.fillStyle = p.text;
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(object.label ?? "", q.x, q.y + 7);
  } else {
    ctx.strokeStyle = p.line;
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
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
  balls?: { id: string; point: Point; ownerId: string | null }[];
  objects?: DrillObject[];
};

const viewCache = new WeakMap<ExportModel, { x: number; w: number }>();

/**
 * Show the whole court, or zoom to one half when the entire play lives there,
 * so the action fills vertical/square social frames.
 */
function courtView(model: ExportModel) {
  const cached = viewCache.get(model);
  if (cached) return cached;
  const xs: number[] = [];
  for (const f of model.frames) {
    for (const t of f.tokens) xs.push(xf(t, model.flip).x);
    for (const a of f.actions) for (const q of a.points ?? []) xs.push(xf(q, model.flip).x);
  }
  for (const frame of model.drillFrames ?? []) {
    for (const object of frame.objects) xs.push(xf(object, model.flip).x);
  }
  let view = { x: 0, w: PW };
  if (xs.length) {
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    if (max <= PW * 0.53) view = { x: 0, w: PW / 2 };
    else if (min >= PW * 0.47) view = { x: PW / 2, w: PW / 2 };
  }
  viewCache.set(model, view);
  return view;
}

type TitleLayout = { lines: string[]; size: number };

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text.trim();
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1).trimEnd();
  return `${value}…`;
}

function titleLayout(ctx: CanvasRenderingContext2D, title: string, maxWidth: number, preferred: number, minimum: number): TitleLayout {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const source = words.length ? words : ["Untitled"];
  for (let size = preferred; size >= minimum; size -= 2) {
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    const lines = [""];
    for (const word of source) {
      const index = lines.length - 1;
      const candidate = `${lines[index]} ${word}`.trim();
      if (ctx.measureText(candidate).width <= maxWidth || !lines[index]) lines[index] = candidate;
      else if (lines.length < 2) lines.push(word);
      else lines[1] = `${lines[1]} ${word}`;
    }
    if (lines.length <= 2 && lines.every((line) => ctx.measureText(line).width <= maxWidth)) return { lines, size };
  }
  ctx.font = `900 ${minimum}px system-ui, sans-serif`;
  const first: string[] = [];
  const second: string[] = [];
  for (const word of source) {
    const target = second.length || ctx.measureText([...first, word].join(" ")).width > maxWidth ? second : first;
    target.push(word);
  }
  return {
    lines: [ellipsize(ctx, first.join(" "), maxWidth), ellipsize(ctx, second.join(" "), maxWidth)].filter(Boolean),
    size: minimum,
  };
}

function drawTitleBand(ctx: CanvasRenderingContext2D, model: ExportModel, p: Palette, w: number, headerH: number, pad: number) {
  const kind = model.kind === "drill" ? "DRILL" : "PLAY";
  const label = model.category ? `${kind}  •  ${model.category.toUpperCase()}` : kind;
  const labelSize = Math.round(w * 0.025);
  const preferred = Math.round(w * (w > 1300 ? 0.046 : 0.06));
  const minimum = Math.round(w * 0.034);
  const top = Math.round(pad * 0.8);
  ctx.save();
  ctx.fillStyle = p.panel;
  ctx.fillRect(0, 0, w, headerH);
  ctx.strokeStyle = withAlpha(p.grape, 0.55);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad, headerH - 2);
  ctx.lineTo(w - pad, headerH - 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = `900 ${labelSize}px system-ui, sans-serif`;
  ctx.fillStyle = p.flame;
  ctx.fillText(label, w / 2, top + labelSize);
  const fitted = titleLayout(ctx, model.name, w - pad * 2.5, preferred, minimum);
  ctx.font = `900 ${fitted.size}px system-ui, sans-serif`;
  ctx.fillStyle = p.text;
  const lineHeight = fitted.size * 1.08;
  const titleTop = top + labelSize + Math.round(labelSize * 0.75);
  fitted.lines.forEach((line, index) => ctx.fillText(line, w / 2, titleTop + fitted.size + index * lineHeight));
  ctx.restore();
}

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
  const headerH = Math.round(h * (opts.format === "vertical" ? 0.16 : opts.format === "square" ? 0.22 : 0.24));
  drawTitleBand(ctx, model, p, w, headerH, pad);

  const footerH = Math.round(h * (opts.format === "vertical" ? 0.09 : 0.11));
  const view = courtView(model);
  const availW = w - pad * 2;
  const availH = h - headerH - footerH - pad;
  const scale = Math.min(availW / view.w, availH / PH);
  const courtW = view.w * scale;
  const courtH = PH * scale;
  const courtX = (w - courtW) / 2;
  const courtY = headerH + (availH - courtH) / 2;

  ctx.save();
  ctx.translate(courtX, courtY);
  ctx.scale(scale, scale);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, view.w, PH, 18);
  ctx.clip();
  ctx.translate(-view.x, 0);
  drawCourt(ctx, p);
  for (const object of state.objects ?? []) drawDrillObject(ctx, object, model.flip, p);
  for (const a of state.actions)
    drawAction(ctx, a, model.flip, p, a.seq !== state.activeSeq, opts.showSequenceNumbers, state.reveal);
  for (const t of state.tokens) drawToken(ctx, t, model.flip, p);
  if (state.ball) {
    const bp = xf(state.ball, model.flip);
    drawBall(ctx, state.ballAttached ? { x: bp.x + 22, y: bp.y - 20 } : bp, p);
  }
  for (const [index, ball] of (state.balls ?? []).entries()) {
    const bp = xf(ball.point, model.flip);
    const spread = index % 3;
    drawBall(ctx, ball.ownerId ? { x: bp.x + 22 + spread * 7, y: bp.y - 20 + spread * 5 } : bp, p);
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
const OUTRO_SECONDS = 1.8;
const OUTRO_FRAMES = Math.round(FPS * OUTRO_SECONDS);

function frameCounts(model: ExportModel, opts: ExportOptions) {
  const factor = SPEED_FACTOR[opts.speed];
  const showFrames = Math.max(6, Math.round((SHOW_MS / factor / 1000) * FPS));
  const doFrames = Math.max(8, Math.round((DO_MS / factor / 1000) * FPS));
  const holdFrames = opts.holdEnd ? Math.round(FPS * 1.2) : 0;
  return {
    showFrames,
    doFrames,
    holdFrames,
    outroFrames: OUTRO_FRAMES,
    total: model.steps.length * (showFrames + doFrames) + holdFrames + OUTRO_FRAMES,
  };
}

function drillFrameState(model: ExportModel, entryIndex: number, sampleTokens: PlayToken[], progress: number) {
  const entry = model.steps[entryIndex];
  const frame = entry ? model.drillFrames?.[entry.frameIdx] : undefined;
  if (!entry || !frame) return {};
  const localIndex = model.steps.slice(0, entryIndex).filter((item) => item.frameIdx === entry.frameIdx).length;
  const start = drillStateAtSequenceStart(frame, localIndex);
  const balls = sampleDrillBalls(start.balls, entry.step.actions, sampleTokens, progress).map((ball) => ({
    id: ball.id,
    point: ball.point,
    ownerId: ball.ownerTokenId,
  }));
  return { balls, objects: frame.objects.filter((object) => object.type !== "ball") };
}

function paintOutro(
  ctx: CanvasRenderingContext2D,
  opts: ExportOptions,
  p: Palette,
  mark: CanvasImageSource,
  progress: number,
) {
  const { w, h } = FORMAT_SIZE[opts.format];
  const fade = Math.min(1, progress / 0.22, (1 - progress) / 0.16);
  const eased = 1 - Math.pow(1 - Math.min(1, progress / 0.7), 3);
  const logoSize = Math.min(w * 0.34, h * 0.34);
  const scale = 0.94 + eased * 0.06;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.translate(w / 2, h / 2 - logoSize * 0.14);
  ctx.scale(scale, scale);
  ctx.drawImage(mark, -logoSize / 2, -logoSize / 2, logoSize, logoSize);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = p.text;
  ctx.textAlign = "center";
  const textSize = Math.round(Math.min(w * 0.04, h * 0.045));
  ctx.font = `800 ${textSize}px system-ui, sans-serif`;
  ctx.fillText("Made with CoachSide", w / 2, h / 2 + logoSize * 0.68);
  ctx.restore();
}

async function loadOutroMark(): Promise<CanvasImageSource> {
  const response = await fetch(coachsideMark.url);
  if (!response.ok) throw new Error("Could not load the CoachSide logo for the video outro.");
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Paint every frame of the play in order, awaiting the encoder between frames. */
async function eachFrame(
  ctx: CanvasRenderingContext2D,
  model: ExportModel,
  opts: ExportOptions,
  p: Palette,
  mark: CanvasImageSource,
  emit: () => Promise<void>,
) {
  const { showFrames, doFrames, holdFrames, outroFrames } = frameCounts(model, opts);
  const totalSteps = model.steps.length;

  for (let s = 0; s < totalSteps; s++) {
    const entry = model.steps[s]!;
    const step = entry.step;
    for (let f = 0; f < showFrames; f++) {
      const sample = sampleStep(step, "show", 0);
      const drill = drillFrameState(model, s, sample.tokens, 0);
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
          ...drill,
        },
        totalSteps,
      );
      await emit();
    }
    for (let f = 0; f < doFrames; f++) {
      const sample = sampleStep(step, "do", (f + 1) / doFrames);
      const drill = drillFrameState(model, s, sample.tokens, (f + 1) / doFrames);
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
          ...drill,
        },
        totalSteps,
      );
      await emit();
    }
  }

  if (holdFrames > 0 && totalSteps > 0) {
    const last = model.steps[totalSteps - 1]!;
    const sample = sampleStep(last.step, "do", 1);
    const drill = drillFrameState(model, totalSteps - 1, sample.tokens, 1);
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
          ...drill,
        },
        totalSteps,
      );
      await emit();
    }
  }
  for (let f = 0; f < outroFrames; f++) {
    paintOutro(ctx, opts, p, mark, (f + 1) / outroFrames);
    await emit();
  }
}

function makeCanvas(w: number, h: number, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((w * scale) / 2) * 2;
  canvas.height = Math.round((h * scale) / 2) * 2;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
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
  const mark = await loadOutroMark();

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: "avc", bitrate: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  let i = 0;
  await eachFrame(ctx, model, opts, p, mark, async () => {
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
  const mark = await loadOutroMark();

  const enc = (await HME.createH264MP4Encoder()) as unknown as WasmEncoder;
  enc.width = canvas.width;
  enc.height = canvas.height;
  enc.frameRate = FPS;
  enc.quantizationParameter = 24;
  enc.speed = 6;
  enc.initialize();

  let i = 0;
  await eachFrame(ctx, model, opts, p, mark, async () => {
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

/** Confirm the Blob is an ISO Base Media/MP4 file before offering it to users. */
export async function isMp4Blob(blob: Blob) {
  if (blob.type !== "video/mp4" || blob.size < 12) return false;
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  return String.fromCharCode(...header.slice(4, 8)) === "ftyp";
}

export function playVideoFileName(name: string) {
  const slug = name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Play";
  return `CoachSide-${slug}.mp4`;
}
