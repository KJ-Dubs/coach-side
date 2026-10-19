import { describe, expect, it } from "vitest";
import type { DrillFrame } from "./drills";
import type { PlayAction } from "./types";
import { addDrillAction, ballOwnedBy, drillStateAtSequenceStart, materializeDrillBalls, resolveDrillAuthoringBall, sampleDrillBalls, setDrillBallSetup } from "./drillBalls";

function fresh(): DrillFrame {
  return { id: "draft", drill_id: "draft", idx: 0, note: null, actions: [],
    tokens: [
      { id: "p1", label: "1", x: .58, y: .5, ball: false },
      { id: "p2", label: "2", x: .7, y: .24, ball: false },
      { id: "p4", label: "4", x: .8, y: .7, ball: false },
      { id: "p5", label: "5", x: .9, y: .4, ball: false },
    ], objects: [{ id: "A", type: "ball", x: .58, y: .5, ownerTokenId: "p1", startSeq: 1 }] };
}
function author(frame: DrillFrame, index: number, actor: string, target: string, type: PlayAction["type"] = "pass") {
  const state = drillStateAtSequenceStart(frame, index);
  const from = state.tokens.find((token) => token.id === actor);
  const to = state.tokens.find((token) => token.id === target);
  if (!from || !to) throw new Error("Missing test player");
  const balls = sampleDrillBalls(state.balls, [], state.tokens, 0).map((ball) => ({ id: ball.id, point: ball.point, ownerId: ball.ownerTokenId }));
  const added = addDrillAction(frame, index, { id: `action-${frame.actions.length}`, seq: index + 1, actor, type, points: [from, to] }, balls, state.tokens);
  return added;
}
function required<T>(value: T | null): T {
  if (!value) throw new Error("Expected successful authoring");
  return value;
}

describe("Drill Maker ball authoring", () => {
  it("binds the default ball to #1's pass to #2", () => {
    const result = required(author(fresh(), 0, "p1", "p2"));
    expect(result.action).toMatchObject({ ballId: "A", actor: "p1", target: "p2", transfersBall: true, passTo: "receiver" });
  });
  it("recognizes an extra ball immediately after drag assignment to #4", () => {
    const frame = fresh();
    frame.objects.push({ id: "B", type: "ball", x: .5, y: .5 });
    const assigned = setDrillBallSetup(frame, "B", 1, { x: .8, y: .7 }, "p4");
    expect(required(author(assigned, 0, "p4", "p5")).action).toMatchObject({ ballId: "B", target: "p5" });
  });
  it("carries transferred ownership to Step 2 for another pass", () => {
    const frame = required(author(fresh(), 0, "p1", "p2")).frame;
    expect(ballOwnedBy(drillStateAtSequenceStart(frame, 1).balls, "p2")?.id).toBe("A");
    expect(required(author(frame, 1, "p2", "p1")).action).toMatchObject({ ballId: "A", target: "p1" });
  });
  it("allows the receiver to dribble in Step 2", () => {
    const frame = required(author(fresh(), 0, "p1", "p2")).frame;
    expect(required(author(frame, 1, "p2", "p5", "dribble")).action.ballId).toBe("A");
  });
  it("passes two independent balls in the same sequence and replay", () => {
    const frame = fresh();
    frame.objects.push({ id: "B", type: "ball", x: .8, y: .7, ownerTokenId: "p4" });
    const first = required(author(frame, 0, "p1", "p2")).frame;
    const both = required(author(first, 0, "p4", "p5")).frame;
    const start = drillStateAtSequenceStart(both, 0);
    expect(sampleDrillBalls(start.balls, both.actions, start.tokens, .5).map((ball) => ball.state)).toEqual(["in-flight", "in-flight"]);
    expect(sampleDrillBalls(start.balls, both.actions, start.tokens, 1).map((ball) => [ball.id, ball.ownerTokenId])).toEqual([["A", "p2"], ["B", "p5"]]);
    expect(drillStateAtSequenceStart(both, 1).balls.map((ball) => [ball.id, ball.ownerTokenId])).toEqual([["A", "p2"], ["B", "p5"]]);
  });
  it("rejects a free ball even at the player's exact position", () => {
    const frame = fresh();
    frame.objects = [{ id: "B", type: "ball", x: .8, y: .7, ownerTokenId: null }];
    expect(author(frame, 0, "p4", "p5")).toBeNull();
  });
  it("uses the current projected receiver position instead of its base position", () => {
    const frame = fresh();
    frame.actions.push({ id: "move", seq: 1, type: "move", actor: "p2", points: [{ x: .7, y: .24 }, { x: .9, y: .15 }] });
    const added = required(author(frame, 1, "p1", "p2"));
    expect(added.action).toMatchObject({ target: "p2", passTo: "receiver" });
    expect(added.action.points.at(-1)).toMatchObject({ x: .9, y: .15 });
  });
  it("preserves assignments and transfers through materialized JSON save/reload", () => {
    const first = required(author(fresh(), 0, "p1", "p2")).frame;
    const assigned = setDrillBallSetup(first, "A", 2, { x: .8, y: .7 }, "p4");
    const passed = required(author(assigned, 1, "p4", "p5")).frame;
    const reloaded: DrillFrame = JSON.parse(JSON.stringify(materializeDrillBalls(passed)));
    expect(ballOwnedBy(drillStateAtSequenceStart(reloaded, 2).balls, "p5")?.id).toBe("A");
    expect(reloaded.actions[1]).toMatchObject({ ballId: "A", target: "p5", transfersBall: true });
  });
  it("normalizes a visibly attached ball before saving the new action", () => {
    const frame = fresh();
    frame.objects[0].ownerTokenId = null;
    const result = resolveDrillAuthoringBall(frame, 0, "p1", [{ id: "A", point: { x: .58, y: .5 }, ownerId: "p1" }], frame.tokens);
    expect(result.ball?.ownerTokenId).toBe("p1");
    expect(result.frame.objects[0].ownerTokenId).toBe("p1");
  });
  it("does not move a ball introduced in Step 2 through Step 1", () => {
    const frame = fresh();
    frame.actions.push({ id: "move", seq: 1, type: "move", actor: "p4", points: [{ x: .8, y: .7 }, { x: .6, y: .7 }] });
    frame.objects.push({ id: "B", type: "ball", x: .8, y: .7, ownerTokenId: null, startSeq: 2 });
    expect(drillStateAtSequenceStart(frame, 0).balls.map((ball) => ball.id)).toEqual(["A"]);
    expect(drillStateAtSequenceStart(frame, 1).balls.find((ball) => ball.id === "B")).toMatchObject({ x: .8, y: .7, ownerTokenId: null });
  });
});