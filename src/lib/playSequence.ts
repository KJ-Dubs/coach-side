import { buildSteps, listOptionGroups, sampleStep, type PlayStep } from "./playAnimation";
import type { PlayFrame } from "./types";

export type SequenceStep = PlayStep & {
  label: string;
  option?: { group: string; key: string; anchorSeq: number; branchSeq: number };
};

/**
 * Read-only teaching timeline. An option group at sequence N holds
 * alternatives to sequence N: NA/NB/NC each start from the START of N (the
 * end of N-1), play after base N, and never feed the main path — sequence
 * N+1 continues from the main-path end of N.
 */
export function buildSequentialSteps(frame: PlayFrame | undefined): SequenceStep[] {
  if (!frame) return [];
  const main = buildSteps({ ...frame, actions: frame.actions.filter((a) => !a.option) });
  const groups = listOptionGroups(frame);
  const result: SequenceStep[] = [];
  const appendOptions = (from: number, to: number) => {
    for (const group of groups.filter((g) => g.seq > from && g.seq <= to)) {
      const before = main.filter((s) => s.seq < group.seq).at(-1);
      const tokens = before?.endTokens ?? frame.tokens;
      const anchorSeq = group.seq;
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
        path.forEach((step, i) => {
          const label = `${anchorSeq}${branch.key.toUpperCase()}${i ? `.${i + 1}` : ""}`;
          result.push({
            ...step,
            actions: step.actions.map((action) => ({ ...action, displaySeq: label })),
            label,
            option: { group: group.group, key: branch.key, anchorSeq, branchSeq: i + 1 },
          });
        });
      }
    }
  };
  let previous = -Infinity;
  for (const step of main) {
    // Options for sequences with no base step of their own come first.
    appendOptions(previous, step.seq - 1);
    result.push({ ...step, label: String(step.seq) });
    appendOptions(step.seq - 1, step.seq);
    previous = step.seq;
  }
  appendOptions(previous, Infinity);
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
