import { describe, expect, it } from "vitest";
import { buildSequentialSteps, mainEndState } from "./playSequence";
import { addOptionBranch, createOptionPoint, deleteOptionBranch, duplicateOptionBranch, optionForSeq, updateOptionBranch } from "./playOptions";
import { DO_MS, SHOW_MS, sampleTimeline } from "./playAnimation";
import type { PlayFrame, PlayAction } from "./types";

let serial = 0;
const id = () => `sequence-test-${++serial}`;
const move = (seq: number, x: number): PlayAction => ({ id: id(), type: "cut", seq, actor: "p", points: [{ x: 0.1, y: 0.5 }, { x, y: 0.5 }] });
function fixture() {
  let frame: PlayFrame = { id: "f", play_id: "p", idx: 0, note: null,
    tokens: [{ id: "p", label: "1", x: 0.1, y: 0.5, ball: true }],
    actions: [1, 2, 3, 4].map((n) => move(n, n / 10)) };
  const created = createOptionPoint(frame, 5, "Backdoor", "", id);
  frame = created.frame;
  for (const name of ["3 Pointer", "Screen/Slip"]) {
    const added = addOptionBranch(frame, created.group, name, "", id);
    if (added) frame = added.frame;
  }
  for (const [i, key] of ["a", "b", "c"].entries()) {
    const option = optionForSeq(frame, created.group, key, 5);
    if (!option) throw new Error("Missing fixture OPTION");
    frame = { ...frame, actions: [...frame.actions, { ...move(5, 0.6 + i / 10), option }] };
  }
  frame.actions.push(move(5, 0.5));
  return { frame, group: created.group };
}
describe("automatic anchored OPTION timeline", () => {
  it("plays 1–4, 4A/B/C and 5 without skipping B; resets siblings and continuation", () => {
    const { frame } = fixture();
    const steps = buildSequentialSteps(frame);
    expect(steps.map((s) => s.label)).toEqual(["1", "2", "3", "4", "4A", "4B", "4C", "5"]);
    const end4 = steps.find((s) => s.label === "4");
    for (const label of ["4A", "4B", "4C", "5"]) {
      expect(steps.find((s) => s.label === label)?.startTokens).toEqual(end4?.endTokens);
      expect(steps.find((s) => s.label === label)?.startBall).toBe("p");
    }
    const per = DO_MS + SHOW_MS;
    const seen = steps.map((_, i) => sampleTimeline({ steps, totalMs: steps.length * per }, i * per)?.step);
    expect(seen).toEqual(steps);
    expect(mainEndState(frame).tokens[0]?.x).toBe(0.5);
    expect(buildSequentialSteps(JSON.parse(JSON.stringify(frame)))).toEqual(steps);
  });
  it("keeps siblings independent, recomputes shared starts, and preserves CRUD", () => {
    const { frame, group } = fixture();
    const original = structuredClone(frame);
    const renamed = updateOptionBranch(frame, group, "b", { label: "Three", condition: "Help" });
    expect(renamed.actions.filter((a) => a.option?.key !== "b")).toEqual(frame.actions.filter((a) => a.option?.key !== "b"));
    const changed = { ...renamed, actions: renamed.actions.map((a) => a.seq === 4 ? { ...a, points: [{ x: 0.1, y: 0.5 }, { x: 0.45, y: 0.5 }] } : a) };
    expect(buildSequentialSteps(changed).filter((s) => s.option).every((s) => s.startTokens[0]?.x === 0.45)).toBe(true);
    const duplicate = duplicateOptionBranch(frame, group, "b", id);
    expect(buildSequentialSteps(duplicate?.frame).some((s) => s.label === "4D")).toBe(true);
    expect(buildSequentialSteps(deleteOptionBranch(frame, group, "b")).map((s) => s.label)).toEqual(["1", "2", "3", "4", "4A", "4C", "5"]);
    expect(frame).toEqual(original);
  });
  it("preserves empty and old multi-sequence OPTIONS and legacy names/actions", () => {
    const { frame, group } = fixture();
    const extra = optionForSeq(frame, group, "b", 6);
    if (!extra) throw new Error("Missing legacy OPTION");
    const old = { ...frame, actions: [...frame.actions, { ...move(6, 0.9), option: extra }] };
    const steps = buildSequentialSteps(old);
    expect(steps.map((s) => s.label)).toEqual(["1", "2", "3", "4", "4A", "4B", "4B.2", "4C", "5"]);
    expect(steps.find((s) => s.label === "4B.2")?.startTokens).toEqual(steps.find((s) => s.label === "4B")?.endTokens);
    const legacy = { ...frame, actions: frame.actions.map((a) => a.option ? { ...a, option: { group, key: a.option.key, label: a.option.label } } : a) };
    expect(buildSequentialSteps(legacy).filter((s) => s.option).length).toBe(3);
    const empty = createOptionPoint(frame, 6, "Empty", "", id);
    expect(buildSequentialSteps(empty.frame).find((s) => s.option?.group === empty.group)?.actions).toEqual([]);
  });
});