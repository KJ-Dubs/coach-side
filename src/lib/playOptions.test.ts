import { describe, expect, it } from "vitest";
import { buildSteps, listOptionGroups, stateAtSequenceStart } from "@/lib/playAnimation";
import {
  addOptionBranch,
  conflictToOption,
  createOptionPoint,
  deleteOptionBranch,
  duplicateOptionBranch,
  optionForSeq,
  updateOptionBranch,
} from "@/lib/playOptions";
import type { PlayAction, PlayFrame } from "@/lib/types";

let n = 0;
const id = () => `id${++n}`;
const tokens = [
  { id: "p1", label: "1", x: 0.5, y: 0.5, ball: true, team: "offense" as const },
  { id: "p2", label: "2", x: 0.7, y: 0.2, ball: false, team: "offense" as const },
  { id: "p5", label: "5", x: 0.8, y: 0.6, ball: false, team: "offense" as const },
];
const mv = (actor: string, seq: number, x: number, y: number, from = { x: 0.5, y: 0.5 }): PlayAction => ({
  id: id(), type: "cut", seq, actor, points: [from, { x, y }],
});

function shared(): PlayFrame {
  return {
    id: "f", play_id: "p", idx: 0, note: null, tokens,
    actions: [
      mv("p2", 1, 0.75, 0.3), mv("p5", 2, 0.85, 0.5), mv("p2", 3, 0.7, 0.15),
      { id: id(), type: "pass", seq: 4, actor: "p1", target: "p2", passTo: "receiver", transfersBall: true, points: [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.15 }] },
    ],
  };
}

function add(f: PlayFrame, group: string, key: string, a: PlayAction): PlayFrame {
  return { ...f, actions: [...f.actions, { ...a, option: optionForSeq(f, group, key, a.seq)! }] };
}

describe("multi-sequence options", () => {
  it("A/B/C start from the end of sequence 4 and keep their own lengths", () => {
    let f = shared();
    const p = createOptionPoint(f, 5, "3 Point Shot", "Defense stays home", id);
    f = p.frame;
    f = add(f, p.group, "a", { id: id(), type: "shot", seq: 5, actor: "p2", points: [{ x: 0.7, y: 0.15 }, { x: 0.95, y: 0.5 }] });
    const b = addOptionBranch(f, p.group, "Pass Inside", "Defender runs out", id)!;
    f = b.frame;
    f = add(f, p.group, "b", { id: id(), type: "pass", seq: 5, actor: "p2", target: "p5", passTo: "receiver", transfersBall: true, points: [{ x: 0.7, y: 0.15 }, { x: 0.85, y: 0.5 }] });
    f = add(f, p.group, "b", { id: id(), type: "shot", seq: 6, actor: "p5", points: [{ x: 0.85, y: 0.5 }, { x: 0.95, y: 0.5 }] });
    const c = addOptionBranch(f, p.group, "Drop for Cutter", "Help collapses", id)!;
    f = c.frame;
    f = add(f, p.group, "c", { id: id(), type: "pass", seq: 5, actor: "p2", target: "p5", passTo: "receiver", transfersBall: true, points: [{ x: 0.7, y: 0.15 }, { x: 0.85, y: 0.5 }] });
    f = add(f, p.group, "c", mv("p1", 6, 0.9, 0.55));
    f = add(f, p.group, "c", { id: id(), type: "pass", seq: 7, actor: "p5", target: "p1", passTo: "receiver", transfersBall: true, points: [{ x: 0.85, y: 0.5 }, { x: 0.9, y: 0.55 }] });
    f = add(f, p.group, "c", { id: id(), type: "shot", seq: 8, actor: "p1", points: [{ x: 0.9, y: 0.55 }, { x: 0.95, y: 0.5 }] });

    const g = listOptionGroups(f)[0]!;
    expect(g.seq).toBe(5);
    expect(g.branches.map((x) => [x.key, x.length, x.condition])).toEqual([
      ["a", 1, "Defense stays home"], ["b", 2, "Defender runs out"], ["c", 4, "Help collapses"],
    ]);
    const end4 = buildSteps(f, { [p.group]: "a" })[3]!;
    for (const k of ["a", "b", "c"]) {
      const s = buildSteps(f, { [p.group]: k });
      expect(s.length).toBe(4 + { a: 1, b: 2, c: 4 }[k]!);
      expect(s[4]!.startTokens).toEqual(end4.endTokens);
      expect(stateAtSequenceStart(f, 4, { [p.group]: k }).ballOwner).toBe("p2");
    }
    const cSteps = buildSteps(f, { [p.group]: "c" });
    expect(cSteps[5]!.startBall).toBe("p5");
    expect(cSteps[7]!.startBall).toBe("p1");

    // Editing C never touches A or B.
    const before = f.actions.filter((a) => a.option?.key !== "c");
    const edited = updateOptionBranch(f, p.group, "c", { label: "Drop", condition: "" });
    expect(edited.actions.filter((a) => a.option?.key !== "c")).toEqual(before);
    const dup = duplicateOptionBranch(f, p.group, "b", id)!;
    expect(dup.key).toBe("d");
    const without = deleteOptionBranch(f, p.group, "b");
    expect(listOptionGroups(without)[0]!.branches.map((x) => x.key)).toEqual(["a", "c"]);
    expect(without.actions.filter((a) => !a.option).length).toBe(4);
    const none = ["a", "b", "c"].reduce((acc, k) => deleteOptionBranch(acc, p.group, k), f);
    expect(listOptionGroups(none)).toEqual([]);
  });

  it("legacy same-sequence options still play", () => {
    const f = shared();
    const a4 = f.actions[3]!;
    const legacy: PlayFrame = {
      ...f,
      actions: [
        ...f.actions.slice(0, 3),
        { ...a4, option: { group: "g", key: "a", label: "Option A" } },
        { ...a4, id: "alt", target: "p5", points: [a4.points[0]!, { x: 0.85, y: 0.5 }], option: { group: "g", key: "b", label: "Option B" } },
      ],
    };
    expect(listOptionGroups(legacy)[0]).toMatchObject({ seq: 4 });
    expect(buildSteps(legacy, { g: "b" })[3]!.endBall).toBe("p5");
    expect(buildSteps(legacy, { g: "a" })[3]!.endBall).toBe("p2");
  });

  it("a clashing outcome becomes an option point", () => {
    const f = shared();
    const rival = f.actions[3]!;
    const res = conflictToOption(f, rival.id, { ...rival, id: "new", target: "p5", points: [rival.points[0]!, { x: 0.85, y: 0.5 }] }, id)!;
    const g = listOptionGroups(res.frame)[0]!;
    expect(g.seq).toBe(4);
    expect(g.branches.map((b) => b.key)).toEqual(["a", "b"]);
    expect(buildSteps(res.frame, { [res.group]: "b" })[3]!.endBall).toBe("p5");
  });
});
