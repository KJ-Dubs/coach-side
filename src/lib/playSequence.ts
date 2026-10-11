import { buildSteps, listOptionGroups, sampleStep, type PlayStep } from "./playAnimation";
import type { PlayFrame } from "./types";

export type SequenceStep = PlayStep & {
  label: string;
  option?: { group: string; key: string; anchorSeq: number; branchSeq: number };
};

/** Read-only teaching timeline: alternate paths never feed the main path. */
export function buildSequentialSteps(frame: PlayFrame | undefined): SequenceStep[] {
  if (!frame) return [];
  const main = buildSteps({ ...frame, actions: frame.actions.filter((a) => !a.option) });
  const groups = listOptionGroups(frame);
  const result: SequenceStep[] = [];
  const appendOptions = (before: number, after: number) => {
    for (const group of groups.filter((g) => g.seq > after && g.seq <= before)) {
      const anchor = main.filter((s) => s.seq < group.seq).at(-1);
      const anchorSeq = anchor?.seq ?? Math.max(1, group.seq - 1);
      const tokens = anchor?.endTokens ?? frame.tokens;
      for (const branch of group.branches) {
        const path = buildSteps(
          {
            ...frame,
            tokens,
            actions: frame.actions.filter(
              (a) => a.option?.group === group.group && a.option.key === branch.key,
            ),
          },
          { [group.group]: branch.key },
        );
        path.forEach((step, i) =>
          result.push({
            ...step,
            actions: step.actions.map((action) => ({
              ...action,
              displaySeq: `${anchorSeq}${branch.key.toUpperCase()}${i ? `.${i + 1}` : ""}`,
            })),
            label: `${anchorSeq}${branch.key.toUpperCase()}${i ? `.${i + 1}` : ""}`,
            option: { group: group.group, key: branch.key, anchorSeq, branchSeq: i + 1 },
          }),
        );
      }
    }
  };
  let previous = -Infinity;
  for (const step of main) {
    appendOptions(step.seq, previous);
    result.push({ ...step, label: String(step.seq) });
    previous = step.seq;
  }
  appendOptions(Infinity, previous);
  return result;
}

/** New ordinary sequences always resume the canonical main-path end. */
export function mainEndState(frame: PlayFrame | undefined) {
  const main = frame ? { ...frame, actions: frame.actions.filter((a) => !a.option) } : undefined;
  const last = buildSteps(main).at(-1);
  if (last) return sampleStep(last, "do", 1);
  const tokens = (frame?.tokens ?? []).map((t) => ({ ...t }));
  const owner = tokens.find((t) => t.ball);
  return { tokens, ballOwner: owner?.id ?? null, ball: owner ? { x: owner.x, y: owner.y } : null };
}
