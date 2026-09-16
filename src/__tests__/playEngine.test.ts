import { describe, expect, it } from "vitest";
import {
  buildSteps,
  findChainConflicts,
  sampleStep,
  stateAtSequenceStart,
  withVisualOffsets,
} from "@/lib/playAnimation";
import type { PlayAction, PlayFrame, PlayToken } from "@/lib/types";

const tok = (id: string, x: number, y: number, ball = false): PlayToken => ({
  id,
  label: id.slice(1),
  x,
  y,
  ball,
  team: "offense",
});

const act = (
  id: string,
  type: PlayAction["type"],
  seq: number,
  pts: [number, number][],
  actor: string,
  target?: string,
): PlayAction => ({
  id,
  type,
  seq,
  points: pts.map(([x, y]) => ({ x, y })),
  actor,
  ...(target ? { target, transfersBall: true } : {}),
});

const frame = (tokens: PlayToken[], actions: PlayAction[]): PlayFrame => ({
  id: "f",
  play_id: "p",
  idx: 0,
  tokens,
  actions,
  note: null,
});

describe("deterministic play engine", () => {
  it("A. jumping to a later sequence uses the previous end state, repeatably", () => {
    const f = frame(
      [tok("p5", 0.1, 0.1, true), tok("p1", 0.9, 0.9)],
      [
        act("a1", "cut", 2, [[0.1, 0.1], [0.3, 0.2]], "p5"),
        act("a2", "cut", 5, [[0.3, 0.2], [0.5, 0.4]], "p5"),
        act("a3", "cut", 6, [[0.5, 0.4], [0.8, 0.5]], "p5"),
      ],
    );
    const runs = Array.from({ length: 10 }, () => stateAtSequenceStart(f, 2));
    for (const r of runs) {
      const p5 = r.tokens.find((t) => t.id === "p5")!;
      expect(p5.x).toBeCloseTo(0.5, 10);
      expect(p5.y).toBeCloseTo(0.4, 10);
    }
    expect(JSON.stringify(runs[0])).toBe(JSON.stringify(runs[9]));
  });

  it("B/C. crossing routes never swap identity, destination or possession", () => {
    const f = frame(
      [tok("p1", 0.2, 0.2, true), tok("p3", 0.2, 0.8), tok("p5", 0.8, 0.2)],
      [
        act("a1", "cut", 1, [[0.2, 0.2], [0.8, 0.8]], "p1"),
        act("a2", "cut", 1, [[0.2, 0.8], [0.8, 0.2]], "p3"),
        act("a3", "cut", 1, [[0.8, 0.2], [0.2, 0.2]], "p5"),
      ],
    );
    const step = buildSteps(f)[0]!;
    for (const q of [0, 0.25, 0.5, 0.75, 1]) {
      const s = sampleStep(step, "do", q);
      expect(s.ballOwner).toBe("p1");
    }
    const end = sampleStep(step, "do", 1);
    expect(end.tokens.find((t) => t.id === "p1")!.x).toBeCloseTo(0.8, 6);
    expect(end.tokens.find((t) => t.id === "p3")!.y).toBeCloseTo(0.2, 6);
  });

  it("D. dribbling keeps the ball attached to the dribbler", () => {
    const f = frame(
      [tok("p1", 0.2, 0.5, true), tok("p2", 0.8, 0.5)],
      [act("a1", "dribble", 1, [[0.2, 0.5], [0.6, 0.5]], "p1")],
    );
    const step = buildSteps(f)[0]!;
    for (const q of [0, 0.5, 1]) {
      const s = sampleStep(step, "do", q);
      expect(s.ballOwner).toBe("p1");
      const p1 = s.tokens.find((t) => t.id === "p1")!;
      expect(s.ball!.x).toBeCloseTo(p1.x, 6);
    }
  });

  it("E. a pass transfers possession only on arrival", () => {
    const f = frame(
      [tok("p1", 0.2, 0.5, true), tok("p2", 0.8, 0.5)],
      [act("a1", "pass", 1, [[0.2, 0.5], [0.8, 0.5]], "p1", "p2")],
    );
    const step = buildSteps(f)[0]!;
    expect(sampleStep(step, "show", 0).ballOwner).toBe("p1");
    expect(sampleStep(step, "do", 0.5).ballOwner).toBeNull();
    expect(sampleStep(step, "do", 1).ballOwner).toBe("p2");
    expect(step.endBall).toBe("p2");
  });

  it("F. chained ball transfers in one sequence are detected", () => {
    const f = frame(
      [tok("p1", 0.2, 0.5, true), tok("p2", 0.5, 0.5), tok("p3", 0.8, 0.5)],
      [
        act("a1", "pass", 1, [[0.2, 0.5], [0.5, 0.5]], "p1", "p2"),
        act("a2", "handoff", 1, [[0.5, 0.5], [0.8, 0.5]], "p2", "p3"),
      ],
    );
    const c = findChainConflicts(f);
    expect(c).toHaveLength(1);
    expect(c[0]!.dependentActionId).toBe("a2");
  });

  it("G. shared destinations keep coordinates but get visible offsets", () => {
    const f = frame(
      [tok("p1", 0.2, 0.2, true), tok("p2", 0.8, 0.8)],
      [
        act("a1", "cut", 1, [[0.2, 0.2], [0.5, 0.5]], "p1"),
        act("a2", "cut", 1, [[0.8, 0.8], [0.5, 0.5]], "p2"),
      ],
    );
    const step = buildSteps(f)[0]!;
    const a = step.endTokens.find((t) => t.id === "p1")!;
    const b = step.endTokens.find((t) => t.id === "p2")!;
    expect(a.x).toBeCloseTo(0.5, 6);
    expect(b.x).toBeCloseTo(0.5, 6);
    const shown = withVisualOffsets(step.endTokens);
    const sa = shown.find((t) => t.id === "p1")!;
    const sb = shown.find((t) => t.id === "p2")!;
    expect(Math.hypot(sa.x - sb.x, sa.y - sb.y)).toBeGreaterThan(0.02);
    expect(JSON.stringify(withVisualOffsets(step.endTokens))).toBe(JSON.stringify(shown));
  });

  it("H. editing an early sequence cascades later starts, destinations absolute", () => {
    const base = [
      act("a1", "cut", 1, [[0.1, 0.1], [0.3, 0.3]], "p1"),
      act("a2", "cut", 2, [[0.3, 0.3], [0.6, 0.6]], "p1"),
      act("a3", "cut", 3, [[0.6, 0.6], [0.9, 0.9]], "p1"),
    ];
    const edited = base.map((a) =>
      a.id === "a1" ? act("a1", "cut", 1, [[0.1, 0.1], [0.2, 0.7]], "p1") : a,
    );
    const f = frame([tok("p1", 0.1, 0.1, true)], edited);
    const steps = buildSteps(f);
    expect(steps[1]!.startTokens[0]!.y).toBeCloseTo(0.7, 6);
    // absolute destinations preserved
    expect(steps[1]!.endTokens[0]!.x).toBeCloseTo(0.6, 6);
    expect(steps[2]!.endTokens[0]!.x).toBeCloseTo(0.9, 6);
  });

  it("I/J. a 24 sequence play stays stable and jumps directly", () => {
    const actions: PlayAction[] = [];
    for (let i = 1; i <= 24; i++) {
      actions.push(
        act(`a${i}`, "cut", i, [[i / 30, 0.2], [(i + 1) / 30, 0.25]], i % 2 ? "p1" : "p2"),
      );
    }
    const f = frame([tok("p1", 1 / 30, 0.2, true), tok("p2", 0.5, 0.5)], actions);
    const steps = buildSteps(f);
    expect(steps).toHaveLength(24);
    const jump = stateAtSequenceStart(f, 6);
    expect(jump.ballOwner).toBe("p1");
    expect(JSON.stringify(stateAtSequenceStart(f, 6))).toBe(JSON.stringify(jump));
    // no teleporting: each step starts where the previous ended
    for (let i = 1; i < steps.length; i++) {
      expect(JSON.stringify(steps[i]!.startTokens)).toBe(JSON.stringify(steps[i - 1]!.endTokens));
    }
  });

  it("legacy actions with no actor are bound once, deterministically", () => {
    const legacy: PlayFrame = frame(
      [tok("p1", 0.2, 0.5, true), tok("p2", 0.8, 0.5)],
      [
        {
          id: "a1",
          type: "pass",
          seq: 1,
          points: [
            { x: 0.2, y: 0.5 },
            { x: 0.8, y: 0.5 },
          ],
        },
      ],
    );
    const step = buildSteps(legacy)[0]!;
    expect(step.actions[0]!.actorId).toBe("p1");
    expect(step.endBall).toBe("p2");
  });
});
