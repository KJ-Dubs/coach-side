import { describe, expect, it } from "vitest";
import { findChainConflicts, resolveLegacyActors } from "./playAnimation";
import { buildSequentialSteps } from "./playSequence";
import type { PlayFrame } from "./types";

const fixture = (): PlayFrame => ({
  id: "legacy-frame", play_id: "legacy-play", idx: 0, note: "Keep note",
  tokens: [
    { id: "p1", label: "1", x: 0.2, y: 0.5, ball: true },
    { id: "p2", label: "2", x: 0.7, y: 0.5, ball: false },
  ],
  actions: [
    { id: "move", type: "cut", seq: 1, points: [{ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 }] },
    { id: "pass", type: "pass", seq: 2, points: [{ x: 0.4, y: 0.5 }, { x: 0.7, y: 0.5 }] },
  ],
});

// Match the editor's validation of saved actions rather than render-only actorId.
function lastInvalid(frame: PlayFrame) {
  const step = buildSequentialSteps(frame).at(-1);
  const actions = frame.actions.filter((a) => step?.actions.some((s) => s.id === a.id));
  return actions.some((a) => !a.actor || (a.type === "handoff" && !a.target) ||
    (a.type === "pass" && !a.target && a.passTo !== "space")) ||
    findChainConflicts({ ...frame, actions }).some((c) => c.seq === step?.seq);
}

describe("legacy editor frame loading", () => {
  it("reproduces repair warning, then resolves projected links without altering source geometry", () => {
    const raw = fixture();
    const original = structuredClone(raw);
    expect(lastInvalid(raw)).toBe(true);
    const loaded = resolveLegacyActors(raw);
    expect(loaded.actions[0]?.actor).toBe("p1");
    expect(loaded.actions[1]).toMatchObject({ actor: "p1", target: "p2", transfersBall: true });
    expect(lastInvalid(loaded)).toBe(false);
    expect(buildSequentialSteps(loaded)).toEqual(buildSequentialSteps(raw));
    expect(raw).toEqual(original);
    expect(loaded.tokens).toEqual(raw.tokens);
    expect(loaded.actions.map((a) => a.points)).toEqual(raw.actions.map((a) => a.points));
    const reloaded = resolveLegacyActors(JSON.parse(JSON.stringify(loaded)));
    expect(reloaded).toEqual(loaded);
    expect(lastInvalid(reloaded)).toBe(false);
  });

  it.each(["pass", "handoff"] as const)("fills missing %s receivers", (type) => {
    const raw = fixture();
    raw.actions = [{ id: "transfer", type, seq: 1,
      points: [{ x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 }] }];
    const loaded = resolveLegacyActors(raw);
    expect(loaded.actions[0]).toMatchObject({ actor: "p1", target: "p2", type });
    expect(loaded.note).toBe(raw.note);
    expect(lastInvalid(loaded)).toBe(false);
  });

  it("retains explicit links and OPTION metadata", () => {
    const raw = resolveLegacyActors(fixture());
    raw.actions = raw.actions.map((a) => ({ ...a, option: {
      group: "g", key: "a", label: "Alternate", condition: "Help", branchSeq: a.seq,
    } }));
    expect(resolveLegacyActors(raw)).toBe(raw);
  });

  it("still requires repair for genuinely unresolvable actions", () => {
    const raw = fixture();
    raw.actions = [{ id: "unbound", type: "pass", seq: 1,
      points: [{ x: 0.95, y: 0.95 }, { x: 0.9, y: 0.1 }] }];
    expect(lastInvalid(resolveLegacyActors(raw))).toBe(true);
  });

  it("allows passes to space without inventing receivers", () => {
    const raw = fixture();
    raw.actions = [{ id: "space", type: "pass", seq: 1, passTo: "space",
      points: [{ x: 0.2, y: 0.5 }, { x: 0.9, y: 0.1 }] }];
    const loaded = resolveLegacyActors(raw);
    expect(loaded.actions[0]?.target).toBeUndefined();
    expect(lastInvalid(loaded)).toBe(false);
  });
});