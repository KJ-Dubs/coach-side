// Turns a drawn play frame into an animatable timeline.
// Actions sharing a sequence number happen simultaneously; the end positions of
// one sequence automatically become the start positions of the next.

import type { PlayAction, PlayFrame, PlayToken } from "./types";
import { getPointAlongPath, resolvePath, type Point } from "./playPath";

export const BALL_ACTIONS = new Set(["pass", "handoff", "shot"]);
export const SHOW_MS = 700;
export const DO_MS = 1200;

export type PlayStep = {
  seq: number;
  actions: PlayAction[];
  startTokens: PlayToken[];
  startBall: string | null;
  endTokens: PlayToken[];
  endBall: string | null;
};

export type PlayPhase = "show" | "do";

export type PlaySample = {
  tokens: PlayToken[];
  /** Ball position in normalized court coords, or null when nobody has it. */
  ball: Point | null;
  ballOwner: string | null;
};

function nearestToken(tokens: PlayToken[], p: Point, team?: "offense" | "defense") {
  let best: { id: string; d: number } | null = null;
  for (const t of tokens) {
    if (team && (t.team ?? "offense") !== team) continue;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (!best || d < best.d) best = { id: t.id, d };
  }
  return best && best.d < 0.14 ? best.id : null;
}

function actorOf(action: PlayAction, tokens: PlayToken[]) {
  if (action.actor && tokens.some((t) => t.id === action.actor)) return action.actor;
  const path = resolvePath(action);
  const start = path[0];
  return start ? nearestToken(tokens, start) : null;
}

function receiverOf(action: PlayAction, tokens: PlayToken[]) {
  if (action.target && tokens.some((t) => t.id === action.target)) return action.target;
  const path = resolvePath(action);
  const end = path[path.length - 1];
  return end ? nearestToken(tokens, end, "offense") : null;
}

/** Build the ordered sequence timeline for a frame. */
export function buildSteps(frame: PlayFrame | undefined): PlayStep[] {
  if (!frame) return [];
  const seqs = [...new Set(frame.actions.map((a) => a.seq))].sort((a, b) => a - b);
  let tokens = frame.tokens.map((t) => ({ ...t }));
  let ball = frame.tokens.find((t) => t.ball)?.id ?? null;
  const steps: PlayStep[] = [];

  for (const seq of seqs) {
    const actions = frame.actions.filter((a) => a.seq === seq);
    const startTokens = tokens.map((t) => ({ ...t }));
    const startBall = ball;
    const endTokens = tokens.map((t) => ({ ...t }));
    let endBall = ball;

    for (const a of actions) {
      const path = resolvePath(a);
      const end = path[path.length - 1];
      if (!end) continue;
      if (BALL_ACTIONS.has(a.type)) {
        if (a.type === "shot") {
          endBall = null;
        } else {
          const rec = receiverOf(a, startTokens);
          if (rec) endBall = rec;
        }
        if (a.type === "handoff") {
          const actor = actorOf(a, startTokens);
          const i = endTokens.findIndex((t) => t.id === actor);
          if (i >= 0) endTokens[i] = { ...endTokens[i]!, x: end.x, y: end.y };
        }
      } else {
        const actor = actorOf(a, startTokens);
        const i = endTokens.findIndex((t) => t.id === actor);
        if (i >= 0) endTokens[i] = { ...endTokens[i]!, x: end.x, y: end.y };
      }
    }

    steps.push({
      seq,
      actions,
      startTokens,
      startBall,
      endTokens: endTokens.map((t) => ({ ...t, ball: t.id === endBall })),
      endBall,
    });
    tokens = endTokens.map((t) => ({ ...t, ball: t.id === endBall }));
    ball = endBall;
  }

  return steps;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function ballAt(tokens: PlayToken[], id: string | null): Point | null {
  const t = tokens.find((x) => x.id === id);
  return t ? { x: t.x, y: t.y } : null;
}

/** Position of every token and the basketball at a point inside one sequence. */
export function sampleStep(step: PlayStep, phase: PlayPhase, progress: number): PlaySample {
  if (phase === "show") {
    return {
      tokens: step.startTokens.map((t) => ({ ...t, ball: t.id === step.startBall })),
      ball: ballAt(step.startTokens, step.startBall),
      ballOwner: step.startBall,
    };
  }
  const p = ease(Math.min(1, Math.max(0, progress)));
  const tokens = step.startTokens.map((t) => ({ ...t }));

  for (const a of step.actions) {
    if (BALL_ACTIONS.has(a.type) && a.type !== "handoff") continue;
    const actor = actorOf(a, step.startTokens);
    const i = tokens.findIndex((t) => t.id === actor);
    if (i < 0) continue;
    const pt = getPointAlongPath(resolvePath(a), p);
    tokens[i] = { ...tokens[i]!, x: pt.x, y: pt.y };
  }

  const ballAction = step.actions.find((a) => BALL_ACTIONS.has(a.type));
  let ball: Point | null;
  let owner: string | null;
  if (ballAction) {
    ball = getPointAlongPath(resolvePath(ballAction), p);
    owner = p >= 1 ? step.endBall : null;
    if (p >= 1 && step.endBall) ball = ballAt(tokens, step.endBall) ?? ball;
  } else {
    owner = step.startBall;
    ball = ballAt(tokens, owner);
  }

  return { tokens: tokens.map((t) => ({ ...t, ball: t.id === owner })), ball, ballOwner: owner };
}

export type Timeline = { steps: PlayStep[]; totalMs: number };

export function buildTimeline(frame: PlayFrame | undefined): Timeline {
  const steps = buildSteps(frame);
  return { steps, totalMs: steps.length * (SHOW_MS + DO_MS) };
}

/** Sample the whole frame timeline at an absolute time in ms. */
export function sampleTimeline(tl: Timeline, ms: number) {
  if (tl.steps.length === 0) return null;
  const per = SHOW_MS + DO_MS;
  const clamped = Math.min(ms, tl.totalMs - 1);
  const idx = Math.min(tl.steps.length - 1, Math.floor(clamped / per));
  const step = tl.steps[idx]!;
  const within = clamped - idx * per;
  const phase: PlayPhase = within < SHOW_MS ? "show" : "do";
  const progress = phase === "show" ? 0 : (within - SHOW_MS) / DO_MS;
  return { index: idx, step, phase, progress, sample: sampleStep(step, phase, progress) };
}
