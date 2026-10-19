import type { DrillFrame, DrillObject } from "./drills";
import type { PlayAction, PlayToken } from "./types";
import { getPointAlongPath, resolvePath, type Point } from "./playPath";
import { inferPassReceiver } from "./playAnimation";

export type DrillBallState = {
  id: string;
  x: number;
  y: number;
  ownerTokenId: string | null;
  state: "free" | "possessed" | "in-flight";
  assignedOrder: number;
  startSeq: number;
};

export type DrillBallSample = DrillBallState & { point: Point };

const PRIMARY_ID = "drill-primary-ball";

function tokenPoint(tokens: PlayToken[], id: string | null) {
  const token = tokens.find((item) => item.id === id);
  return token ? { x: token.x, y: token.y } : null;
}

export function normalizeDrillBalls(frame: DrillFrame | undefined): DrillBallState[] {
  if (!frame) return [];
  const stored: DrillBallState[] = frame.objects
    .filter((object) => object.type === "ball")
    .map((object, index) => ({
      id: object.id,
      x: object.x,
      y: object.y,
      ownerTokenId: object.ownerTokenId ?? null,
      state: object.ownerTokenId ? "possessed" as const : "free" as const,
      assignedOrder: object.assignedOrder ?? index,
      startSeq: object.startSeq ?? 1,
    }));
  const owner = frame.tokens.find((token) => token.ball);
  if (owner && !stored.some((ball) => ball.id === PRIMARY_ID)) {
    stored.unshift({ id: PRIMARY_ID, x: owner.x, y: owner.y, ownerTokenId: owner.id, state: "possessed", assignedOrder: -1, startSeq: 1 });
  }
  return stored;
}

export function ballsToObjects(objects: DrillObject[], balls: DrillBallState[]): DrillObject[] {
  const nonBalls = objects.filter((object) => object.type !== "ball");
  return [
    ...nonBalls,
    ...balls.map((ball) => ({
      id: ball.id,
      type: "ball" as const,
      x: ball.x,
      y: ball.y,
      ownerTokenId: ball.ownerTokenId,
      ballState: ball.ownerTokenId ? "possessed" as const : "free" as const,
      assignedOrder: ball.assignedOrder,
      startSeq: ball.startSeq,
      ballSetups: objects.find((object) => object.id === ball.id)?.ballSetups ?? [],
    })),
  ];
}

export function materializeDrillBalls(frame: DrillFrame): DrillFrame {
  const balls = normalizeDrillBalls(frame);
  return {
    ...frame,
    tokens: frame.tokens.map((token) => ({ ...token, ball: false })),
    objects: ballsToObjects(frame.objects, balls),
  };
}

export function setDrillBallSetup(
  frame: DrillFrame,
  ballId: string,
  seq: number,
  point: Point,
  ownerTokenId: string | null,
): DrillFrame {
  const order = Date.now();
  return {
    ...frame,
    objects: frame.objects.map((object) => {
      if (object.id !== ballId || object.type !== "ball") return object;
      if (seq <= (object.startSeq ?? 1)) {
        return { ...object, x: point.x, y: point.y, ownerTokenId, ballState: ownerTokenId ? "possessed" : "free", assignedOrder: order };
      }
      const setups = (object.ballSetups ?? []).filter((setup) => setup.seq !== seq);
      return { ...object, ballSetups: [...setups, { seq, x: point.x, y: point.y, ownerTokenId, assignedOrder: order }] };
    }),
  };
}

export function ballOwnedBy(balls: DrillBallState[], tokenId: string) {
  return balls
    .filter((ball) => ball.ownerTokenId === tokenId)
    .sort((a, b) => b.assignedOrder - a.assignedOrder)[0] ?? null;
}

export type ShownDrillBall = { id: string; point: Point; ownerId: string | null };

/** Recover explicit visible/setup assignment, never proximity to a free ball. */
export function resolveDrillAuthoringBall(frame: DrillFrame, index: number, actor: string, shownBalls: ShownDrillBall[], shownTokens: PlayToken[]) {
  const active = drillStateAtSequenceStart(frame, index);
  const owned = ballOwnedBy(active.balls, actor);
  if (owned) return { frame, ball: owned };
  const token = shownTokens.find((item) => item.id === actor);
  const sequences = actionsBySequence(frame);
  const seq = sequences[index] ?? ((sequences.at(-1) ?? 0) + 1);
  const visible = shownBalls.find((item) => item.ownerId === actor && active.balls.some((ball) => ball.id === item.id));
  const persisted = token ? shownBalls.find((item) => {
    const ball = active.balls.find((candidate) => candidate.id === item.id);
    if (!ball || ball.ownerTokenId !== null || item.ownerId !== null) return false;
    const object = frame.objects.find((candidate) => candidate.id === item.id);
    const setup = object?.ballSetups?.filter((candidate) => candidate.seq <= seq).sort((a, b) => b.seq - a.seq)[0];
    const owner = setup ? setup.ownerTokenId : object?.ownerTokenId;
    return owner === actor && Math.hypot(item.point.x - token.x, item.point.y - token.y) <= 0.06;
  }) : undefined;
  const candidate = visible ?? persisted;
  if (!candidate || !token) return { frame, ball: null };
  const next = setDrillBallSetup(materializeDrillBalls(frame), candidate.id, seq, token, actor);
  return { frame: next, ball: ballOwnedBy(drillStateAtSequenceStart(next, index).balls, actor) };
}

/** Complete authoring path shared by the editor and possession regression tests. */
export function addDrillAction(frame: DrillFrame, index: number, action: PlayAction, shownBalls: ShownDrillBall[], shownTokens: PlayToken[]) {
  if (!action.actor) return null;
  const resolved = resolveDrillAuthoringBall(frame, index, action.actor, shownBalls, shownTokens);
  if ((action.type === "pass" || action.type === "dribble") && !resolved.ball) return null;
  const base = { ...action, ...(resolved.ball ? { ballId: resolved.ball.id } : {}) };
  const receiver = action.type === "pass" ? inferPassReceiver(shownTokens, frame.actions.filter((item) => item.seq === action.seq && !["pass", "handoff", "shot"].includes(item.type)), base) : null;
  const bound: PlayAction = action.type === "pass"
    ? { ...base, ...(receiver ? { target: receiver.id } : {}), transfersBall: !!receiver, passTo: receiver ? "receiver" : "space" }
    : base;
  return { frame: { ...resolved.frame, actions: [...resolved.frame.actions, bound] }, action: bound, receiver };
}

function actionsBySequence(frame: DrillFrame) {
  return [...new Set(frame.actions.map((action) => action.seq))].sort((a, b) => a - b);
}

function endTokensForSequence(tokens: PlayToken[], actions: PlayAction[]) {
  const next = tokens.map((token) => ({ ...token, ball: false }));
  for (const action of actions) {
    if (action.type === "pass" || action.type === "handoff" || action.type === "shot") continue;
    const end = resolvePath(action).at(-1);
    const index = next.findIndex((token) => token.id === action.actor);
    const token = next[index];
    if (end && token) next[index] = { ...token, x: end.x, y: end.y };
  }
  return next;
}

function advanceBalls(balls: DrillBallState[], endTokens: PlayToken[], actions: PlayAction[]) {
  const next = balls.map((ball) => ({ ...ball }));
  for (const action of actions.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    if (!action.ballId || !action.actor) continue;
    const index = next.findIndex((ball) => ball.id === action.ballId && ball.ownerTokenId === action.actor);
    if (index < 0) continue;
    const current = next[index];
    if (!current) continue;
    const end = resolvePath(action).at(-1);
    if (action.type === "pass" && action.passTo !== "space" && action.target) {
      const target = tokenPoint(endTokens, action.target);
      next[index] = { ...current, ...(target ?? end ?? { x: current.x, y: current.y }), ownerTokenId: action.target, state: "possessed" };
    } else if (action.type === "shot") {
      next[index] = { ...current, ...(end ?? { x: current.x, y: current.y }), ownerTokenId: null, state: "free" };
    } else {
      const owner = tokenPoint(endTokens, action.actor);
      if (owner) next[index] = { ...current, ...owner, state: "possessed" };
    }
  }
  return next.map((ball) => {
    const owner = tokenPoint(endTokens, ball.ownerTokenId);
    return owner ? { ...ball, ...owner, state: "possessed" as const } : ball;
  });
}

export function drillStateAtSequenceStart(frame: DrillFrame, index: number) {
  let tokens = frame.tokens.map((token) => ({ ...token, ball: false }));
  let balls = normalizeDrillBalls(frame);
  const sequences = actionsBySequence(frame);
  const requestedSeq = sequences[index] ?? ((sequences.at(-1) ?? 0) + 1);
  balls = balls.filter((ball) => ball.startSeq <= requestedSeq);
  const historySequences = [...new Set([
    ...sequences.slice(0, index),
    ...frame.objects.flatMap((object) => (object.ballSetups ?? []).map((setup) => setup.seq)),
  ])].filter((seq) => seq < requestedSeq).sort((a, b) => a - b);
  for (const currentSeq of historySequences) {
    balls = balls.map((ball) => {
      const setup = frame.objects.find((item) => item.id === ball.id)?.ballSetups
        ?.find((item) => item.seq === currentSeq);
      return setup
        ? { ...ball, x: setup.x, y: setup.y, ownerTokenId: setup.ownerTokenId, assignedOrder: setup.assignedOrder, state: setup.ownerTokenId ? "possessed" as const : "free" as const }
        : ball;
    });
    const actions = frame.actions.filter((action) => action.seq === currentSeq);
    const endTokens = endTokensForSequence(tokens, actions);
    balls = [
      ...advanceBalls(balls.filter((ball) => ball.startSeq <= currentSeq), endTokens, actions),
      ...balls.filter((ball) => ball.startSeq > currentSeq),
    ];
    tokens = endTokens;
  }
  balls = balls.map((ball) => {
    const object = frame.objects.find((item) => item.id === ball.id);
    const setup = object?.ballSetups?.find((item) => item.seq === requestedSeq);
    if (!setup) return ball;
    return { ...ball, x: setup.x, y: setup.y, ownerTokenId: setup.ownerTokenId, assignedOrder: setup.assignedOrder, state: setup.ownerTokenId ? "possessed" : "free" };
  });
  balls = balls.map((ball) => {
    const owner = tokenPoint(tokens, ball.ownerTokenId);
    return owner ? { ...ball, ...owner } : ball;
  });
  return { tokens, balls };
}

export function sampleDrillBalls(
  startBalls: DrillBallState[],
  actions: PlayAction[],
  sampledTokens: PlayToken[],
  progress: number,
): DrillBallSample[] {
  const p = Math.min(1, Math.max(0, progress));
  return startBalls.map((ball) => {
    const action = actions.find((item) => item.ballId === ball.id && item.actor === ball.ownerTokenId);
    if (action?.type === "pass" && action.passTo !== "space") {
      const path = resolvePath(action);
      if (p > 0 && p < 1) {
        const point = getPointAlongPath(path, p);
        return { ...ball, ...point, point, ownerTokenId: null, state: "in-flight" };
      }
      if (p >= 1 && action.target) {
        const point = tokenPoint(sampledTokens, action.target) ?? getPointAlongPath(path, 1);
        return { ...ball, ...point, point, ownerTokenId: action.target, state: "possessed" };
      }
    }
    if (action?.type === "shot" && p > 0) {
      const point = getPointAlongPath(resolvePath(action), p);
      return { ...ball, ...point, point, ownerTokenId: p < 1 ? null : ball.ownerTokenId, state: p < 1 ? "in-flight" : "free" };
    }
    const point = tokenPoint(sampledTokens, ball.ownerTokenId) ?? { x: ball.x, y: ball.y };
    return { ...ball, ...point, point, state: ball.ownerTokenId ? "possessed" : "free" };
  });
}

export function visibleDrillBalls(frame: DrillFrame | undefined, tokens?: PlayToken[]) {
  if (!frame) return [];
  const shown = tokens ?? frame.tokens;
  return normalizeDrillBalls(frame).filter((ball) => ball.startSeq <= 1).map((ball) => ({
    id: ball.id,
    ownerId: ball.ownerTokenId,
    point: tokenPoint(shown, ball.ownerTokenId) ?? { x: ball.x, y: ball.y },
  }));
}