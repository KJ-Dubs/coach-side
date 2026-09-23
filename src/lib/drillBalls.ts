import type { DrillFrame, DrillObject } from "./drills";
import type { PlayAction, PlayToken } from "./types";
import { getPointAlongPath, resolvePath, type Point } from "./playPath";

export type DrillBallState = {
  id: string;
  x: number;
  y: number;
  ownerTokenId: string | null;
  state: "free" | "possessed" | "in-flight";
  assignedOrder: number;
};

export type DrillBallSample = DrillBallState & { point: Point };

const PRIMARY_ID = "drill-primary-ball";

function tokenPoint(tokens: PlayToken[], id: string | null) {
  const token = tokens.find((item) => item.id === id);
  return token ? { x: token.x, y: token.y } : null;
}

export function normalizeDrillBalls(frame: DrillFrame | undefined): DrillBallState[] {
  if (!frame) return [];
  const stored = frame.objects
    .filter((object) => object.type === "ball")
    .map((object, index) => ({
      id: object.id,
      x: object.x,
      y: object.y,
      ownerTokenId: object.ownerTokenId ?? null,
      state: object.ownerTokenId ? "possessed" as const : "free" as const,
      assignedOrder: object.assignedOrder ?? index,
    }));
  if (stored.length) return stored;
  const owner = frame.tokens.find((token) => token.ball);
  if (!owner) return [];
  return [{ id: PRIMARY_ID, x: owner.x, y: owner.y, ownerTokenId: owner.id, state: "possessed", assignedOrder: 0 }];
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
    })),
  ];
}

export function ballOwnedBy(balls: DrillBallState[], tokenId: string) {
  return balls
    .filter((ball) => ball.ownerTokenId === tokenId)
    .sort((a, b) => b.assignedOrder - a.assignedOrder)[0] ?? null;
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
    if (end && index >= 0) next[index] = { ...next[index]!, x: end.x, y: end.y };
  }
  return next;
}

function advanceBalls(balls: DrillBallState[], startTokens: PlayToken[], endTokens: PlayToken[], actions: PlayAction[]) {
  const next = balls.map((ball) => ({ ...ball }));
  for (const action of actions.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    if (!action.ballId || !action.actor) continue;
    const index = next.findIndex((ball) => ball.id === action.ballId && ball.ownerTokenId === action.actor);
    if (index < 0) continue;
    const current = next[index]!;
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
  for (let i = 0; i < Math.min(index, sequences.length); i += 1) {
    const actions = frame.actions.filter((action) => action.seq === sequences[i]);
    const endTokens = endTokensForSequence(tokens, actions);
    balls = advanceBalls(balls, tokens, endTokens, actions);
    tokens = endTokens;
  }
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
  return normalizeDrillBalls(frame).map((ball) => ({
    id: ball.id,
    ownerId: ball.ownerTokenId,
    point: tokenPoint(shown, ball.ownerTokenId) ?? { x: ball.x, y: ball.y },
  }));
}