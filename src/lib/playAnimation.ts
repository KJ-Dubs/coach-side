// Deterministic play state engine.
//
// Core rule: every token and the ball has exactly one authoritative state after
// every sequence, and sequence N always starts from the exact end state of
// sequence N-1. Ownership is bound to immutable token IDs at build time and is
// NEVER inferred from path geometry during playback.

import type { PlayAction, PlayFrame, PlayToken } from "./types";
import { getPointAlongPath, pathLength, resolvePath, type Point } from "./playPath";

export const BALL_ACTIONS = new Set(["pass", "handoff", "shot"]);
export const SHOW_MS = 700;
export const DO_MS = 1200;

/** Timing envelope used to stagger simultaneous movement. */
export const MIN_MOVE_MS = 420;
export const MAX_MOVE_MS = 1600;

/** How close a drag start must be to a token to bind to it (normalized units). */
export const BIND_RADIUS = 0.075;

export type ResolvedAction = PlayAction & {
  /** Render-ready polyline, rebased onto live actor/target positions. */
  points: Point[];
  /** Immutable owning token. Null means annotation-only (no state effect). */
  actorId: string | null;
  targetId: string | null;
  /** Fraction of the DO phase where this action starts (stagger). Ends at 1. */
  startFrac: number;
  /** Intrinsic duration in ms before the common-finish stagger is applied. */
  durationMs: number;
};

export type PlayStep = {
  seq: number;
  /** Render-ready actions for this sequence. */
  actions: ResolvedAction[];
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

/* ------------------------------------------------------------------ */
/* legacy compatibility                                                */
/* ------------------------------------------------------------------ */

function nearestTokenId(
  tokens: PlayToken[],
  p: Point,
  team?: "offense" | "defense",
  radius = 0.14,
) {
  let best: { id: string; d: number } | null = null;
  for (const t of tokens) {
    if (team && (t.team ?? "offense") !== team) continue;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (!best || d < best.d || (d === best.d && t.id < best.id)) best = { id: t.id, d };
  }
  return best && best.d <= radius ? best.id : null;
}

export function nearestTokenAt(tokens: PlayToken[], p: Point, radius = BIND_RADIUS) {
  return nearestTokenId(tokens, p, undefined, radius);
}

/**
 * Bind missing actor/target IDs ONCE, deterministically, using the state each
 * sequence actually starts from. Playback never re-infers after this.
 * Returns a frame whose actions all carry explicit actor/target where possible.
 */
export function resolveLegacyActors(frame: PlayFrame): PlayFrame {
  if (!frame) return frame;
  const needs = frame.actions.some(
    (a) => !a.actor || ((a.type === "pass" || a.type === "handoff") && !a.target),
  );
  if (!needs) return frame;

  const seqs = [...new Set(frame.actions.map((a) => a.seq))].sort((x, y) => x - y);
  let tokens = frame.tokens.map((t) => ({ ...t }));
  const patched = new Map<string, PlayAction>();

  for (const seq of seqs) {
    const actions = frame.actions
      .filter((a) => a.seq === seq)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
    const startTokens = tokens.map((t) => ({ ...t }));

    for (const a of actions) {
      const path = resolvePath(a);
      const start = path[0];
      const end = path[path.length - 1];
      const actor =
        a.actor && startTokens.some((t) => t.id === a.actor)
          ? a.actor
          : start
            ? nearestTokenId(startTokens, start)
            : null;
      const target =
        a.type === "pass" || a.type === "handoff"
          ? a.target && startTokens.some((t) => t.id === a.target)
            ? a.target
            : end
              ? nearestTokenId(startTokens, end, "offense")
              : null
          : null;
      patched.set(a.id, {
        ...a,
        ...(actor ? { actor } : {}),
        ...(target ? { target, transfersBall: true } : {}),
      });
      // Advance the projected state so later sequences bind against real positions.
      if (actor && end && !BALL_ACTIONS.has(a.type)) {
        const i = tokens.findIndex((t) => t.id === actor);
        if (i >= 0) tokens[i] = { ...tokens[i]!, x: end.x, y: end.y };
      }
    }
  }

  return { ...frame, actions: frame.actions.map((a) => patched.get(a.id) ?? a) };
}

/* ------------------------------------------------------------------ */
/* path rebasing                                                       */
/* ------------------------------------------------------------------ */

/**
 * Keep the absolute stored destination but redraw the route from where the
 * actor actually is now. Optionally retarget the endpoint too (ball flights).
 */
function rebasePath(path: Point[], newStart: Point | null, newEnd: Point | null): Point[] {
  if (path.length < 2) return path.map((p) => ({ ...p }));
  const oldStart = path[0]!;
  const oldEnd = path[path.length - 1]!;
  const dsx = newStart ? newStart.x - oldStart.x : 0;
  const dsy = newStart ? newStart.y - oldStart.y : 0;
  const dex = newEnd ? newEnd.x - oldEnd.x : 0;
  const dey = newEnd ? newEnd.y - oldEnd.y : 0;
  if (!dsx && !dsy && !dex && !dey) return path.map((p) => ({ ...p }));

  const total = pathLength(path) || 1;
  let run = 0;
  const out: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    if (i > 0) {
      const prev = path[i - 1]!;
      run += Math.hypot(p.x - prev.x, p.y - prev.y);
    }
    const t = Math.min(1, run / total);
    out.push({
      x: p.x + dsx * (1 - t) + dex * t,
      y: p.y + dsy * (1 - t) + dey * t,
    });
  }
  return out;
}

function tokenPoint(tokens: PlayToken[], id: string | null): Point | null {
  const t = tokens.find((x) => x.id === id);
  return t ? { x: t.x, y: t.y } : null;
}

/* ------------------------------------------------------------------ */
/* chained ball transfer detection                                     */
/* ------------------------------------------------------------------ */

export type ChainConflict = {
  seq: number;
  /** The action that depends on a transfer happening in the same sequence. */
  dependentActionId: string;
  dependentType: string;
  /** The transfer it depends on. */
  sourceActionId: string;
  actorLabel: string;
};

/**
 * A ball action whose actor only receives the ball from ANOTHER ball action in
 * the same sequence is ambiguous. Report it instead of inventing behaviour.
 */
export function findChainConflicts(frame: PlayFrame | undefined): ChainConflict[] {
  if (!frame) return [];
  const label = (id: string | null | undefined) =>
    frame.tokens.find((t) => t.id === id)?.label ?? "?";
  const out: ChainConflict[] = [];
  const seqs = [...new Set(frame.actions.map((a) => a.seq))].sort((a, b) => a - b);
  for (const seq of seqs) {
    const ballActions = frame.actions.filter((a) => a.seq === seq && BALL_ACTIONS.has(a.type));
    for (const dep of ballActions) {
      if (!dep.actor) continue;
      const source = ballActions.find((a) => a.id !== dep.id && a.target === dep.actor);
      if (source) {
        out.push({
          seq,
          dependentActionId: dep.id,
          dependentType: dep.type,
          sourceActionId: source.id,
          actorLabel: label(dep.actor),
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* step building                                                       */
/* ------------------------------------------------------------------ */

function intrinsicDuration(type: string, len: number) {
  const base = type === "pass" || type === "shot" ? 900 : 1100;
  const ms = MIN_MOVE_MS + len * base * 2.2;
  return Math.min(MAX_MOVE_MS, Math.max(MIN_MOVE_MS, ms));
}

/** Build the ordered, fully deterministic sequence timeline for a frame. */
export function buildSteps(frameIn: PlayFrame | undefined): PlayStep[] {
  if (!frameIn) return [];
  const frame = resolveLegacyActors(frameIn);
  const seqs = [...new Set(frame.actions.map((a) => a.seq))].sort((a, b) => a - b);
  let tokens = frame.tokens.map((t) => ({ ...t }));
  let ball = frame.tokens.find((t) => t.ball)?.id ?? null;
  const steps: PlayStep[] = [];

  for (const seq of seqs) {
    const raw = frame.actions
      .filter((a) => a.seq === seq)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
    const startTokens = tokens.map((t) => ({ ...t, ball: t.id === ball }));
    const startBall = ball;

    // Pass 1: end positions of every moving actor (absolute stored destinations).
    const endTokens = startTokens.map((t) => ({ ...t }));
    let endBall = ball;
    for (const a of raw) {
      const actorId = a.actor && startTokens.some((t) => t.id === a.actor) ? a.actor : null;
      const path = resolvePath(a);
      const end = path[path.length - 1];
      if (!actorId || !end) continue;
      if (BALL_ACTIONS.has(a.type)) {
        if (a.type === "shot") {
          if (endBall === actorId) endBall = null;
        } else if (a.passTo !== "space") {
          const targetId = a.target && startTokens.some((t) => t.id === a.target) ? a.target : null;
          // Possession only moves when the current owner actually passes it.
          if (targetId && startBall === actorId) endBall = targetId;
        }
      } else {
        const i = endTokens.findIndex((t) => t.id === actorId);
        if (i >= 0) endTokens[i] = { ...endTokens[i]!, x: end.x, y: end.y };
      }
    }

    // Pass 2: render-ready actions rebased onto live positions + stagger timing.
    const prepared = raw.map((a) => {
      const actorId = a.actor && startTokens.some((t) => t.id === a.actor) ? a.actor : null;
      const targetId =
        (a.type === "pass" || a.type === "handoff") &&
        a.passTo !== "space" &&
        a.target &&
        startTokens.some((t) => t.id === a.target)
          ? a.target
          : null;
      const base = resolvePath(a);
      const from = tokenPoint(startTokens, actorId);
      // A pass drawn with an explicit endpoint (lead pass / pass to space) keeps
      // that absolute destination. Legacy passes still retarget to the receiver.
      const to =
        a.type === "handoff" || (a.type === "pass" && !a.passTo)
          ? tokenPoint(endTokens, targetId)
          : null;
      const points = rebasePath(base, from, to);

      const len = pathLength(points);
      return {
        ...a,
        points,
        actorId,
        targetId,
        durationMs: intrinsicDuration(a.type, len),
        startFrac: 0,
      } as ResolvedAction;
    });

    const maxDur = prepared.reduce((m, a) => Math.max(m, a.durationMs), 0) || 1;
    const actions = prepared.map((a) => ({
      ...a,
      // Longest path starts first; everything finishes together.
      startFrac: Math.min(0.9, (maxDur - a.durationMs) / maxDur),
    }));

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

/** Token + ball state at the exact start of a sequence index (0-based). */
export function stateAtSequenceStart(frame: PlayFrame | undefined, index: number): PlaySample {
  const steps = buildSteps(frame);
  if (steps.length === 0) {
    const tokens = (frame?.tokens ?? []).map((t) => ({ ...t }));
    const owner = tokens.find((t) => t.ball)?.id ?? null;
    return { tokens, ball: tokenPoint(tokens, owner), ballOwner: owner };
  }
  if (index >= steps.length) {
    const last = steps[steps.length - 1]!;
    return {
      tokens: last.endTokens.map((t) => ({ ...t })),
      ball: tokenPoint(last.endTokens, last.endBall),
      ballOwner: last.endBall,
    };
  }
  const step = steps[Math.max(0, index)]!;
  return {
    tokens: step.startTokens.map((t) => ({ ...t })),
    ball: tokenPoint(step.startTokens, step.startBall),
    ballOwner: step.startBall,
  };
}

/** Position of every token and the ball at a point inside one sequence. */
export function sampleStep(step: PlayStep, phase: PlayPhase, progress: number): PlaySample {
  if (phase === "show") {
    const tokens = step.startTokens.map((t) => ({ ...t, ball: t.id === step.startBall }));
    return { tokens, ball: tokenPoint(tokens, step.startBall), ballOwner: step.startBall };
  }

  const p = Math.min(1, Math.max(0, progress));
  const tokens = step.startTokens.map((t) => ({ ...t }));

  const localOf = (a: ResolvedAction) => {
    const span = 1 - a.startFrac || 1;
    return Math.min(1, Math.max(0, (p - a.startFrac) / span));
  };

  // Movement: strictly by immutable actor ID.
  for (const a of step.actions) {
    if (BALL_ACTIONS.has(a.type)) continue;
    if (!a.actorId) continue;
    const i = tokens.findIndex((t) => t.id === a.actorId);
    if (i < 0) continue;
    const pt = getPointAlongPath(a.points, ease(localOf(a)));
    tokens[i] = { ...tokens[i]!, x: pt.x, y: pt.y };
  }

  // Possession: only a completed transfer by the CURRENT owner changes it.
  let owner: string | null = step.startBall;
  let ball: Point | null = tokenPoint(tokens, owner);

  const transfer = step.actions.find(
    (a) => BALL_ACTIONS.has(a.type) && a.actorId && a.actorId === step.startBall,
  );
  if (transfer) {
    const local = localOf(transfer);
    if (local <= 0) {
      owner = step.startBall;
      ball = tokenPoint(tokens, owner);
    } else if (local >= 1) {
      owner = step.endBall;
      ball = owner ? tokenPoint(tokens, owner) : getPointAlongPath(transfer.points, 1);
    } else {
      // In flight: nobody owns it.
      owner = null;
      const from = tokenPoint(tokens, transfer.actorId);
      const to = transfer.targetId ? tokenPoint(tokens, transfer.targetId) : null;
      const live = rebasePath(transfer.points, from, to);
      ball = getPointAlongPath(live, ease(local));
    }
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
  const clamped = Math.min(Math.max(0, ms), tl.totalMs - 1);
  const idx = Math.min(tl.steps.length - 1, Math.floor(clamped / per));
  const step = tl.steps[idx]!;
  const within = clamped - idx * per;
  const phase: PlayPhase = within < SHOW_MS ? "show" : "do";
  const progress = phase === "show" ? 0 : (within - SHOW_MS) / DO_MS;
  return { index: idx, step, phase, progress, sample: sampleStep(step, phase, progress) };
}

/**
 * Deterministic render-only nudge so tokens sharing a destination stay visible.
 * Stored basketball coordinates are never changed.
 */
export function withVisualOffsets(tokens: PlayToken[]): PlayToken[] {
  const groups = new Map<string, PlayToken[]>();
  for (const t of tokens) {
    const key = `${Math.round(t.x * 60)}:${Math.round(t.y * 60)}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  const moved = new Map<string, { x: number; y: number }>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = list.slice().sort((a, b) => a.id.localeCompare(b.id));
    const r = 0.018;
    sorted.forEach((t, i) => {
      const angle = (2 * Math.PI * i) / sorted.length;
      moved.set(t.id, { x: t.x + Math.cos(angle) * r, y: t.y + Math.sin(angle) * r * 1.6 });
    });
  }
  return tokens.map((t) => {
    const m = moved.get(t.id);
    return m ? { ...t, x: m.x, y: m.y } : t;
  });
}
