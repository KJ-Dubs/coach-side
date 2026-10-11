import { BALL_ACTIONS, OPTION_MARKER, isOptionMarker, listOptionGroups, type OptionGroup } from "@/lib/playAnimation";
import type { PlayAction, PlayFrame } from "@/lib/types";

/**
 * Pure OPTION authoring helpers. An option point is a group anchored at a
 * sequence number; every branch (A–F) starts from the exact end state of the
 * shared sequence before it. Branch actions keep an absolute `seq` plus a
 * 1-based `branchSeq`, so editing one branch never touches another.
 */

export const MAX_OPTIONS = 6;
type Opt = NonNullable<PlayAction["option"]>;
type NewId = () => string;

export const optionLetter = (key: string) => key.toUpperCase();

export function groupOf(frame: PlayFrame | undefined, group: string): OptionGroup | undefined {
  return listOptionGroups(frame).find((g) => g.group === group);
}

/** True for option points that own their own multi-sequence path. */
export function isPathGroup(frame: PlayFrame | undefined, group: string) {
  return (frame?.actions ?? []).some((a) => a.option?.group === group && a.option.branchSeq);
}

export function nextOptionKey(frame: PlayFrame, group: string): string | null {
  const used = new Set(frame.actions.flatMap((a) => a.option?.group === group ? [a.option.key] : []));
  for (let i = 0; i < MAX_OPTIONS; i++) {
    const k = String.fromCharCode(97 + i);
    if (!used.has(k)) return k;
  }
  return null;
}

function marker(newId: NewId, seq: number, option: Opt): PlayAction {
  return { id: newId(), type: "move", seq, points: [], label: OPTION_MARKER, option };
}

const clean = (s: string | undefined) => (s ?? "").trim();

function optionMeta(group: string, key: string, label: string, condition: string | undefined, branchSeq: number): Opt {
  const c = clean(condition);
  return { group, key, label: clean(label) || `Option ${optionLetter(key)}`, ...(c ? { condition: c } : {}), branchSeq };
}

/** Start a new option point at `anchorSeq` with Option A. */
export function createOptionPoint(
  frame: PlayFrame,
  anchorSeq: number,
  label: string,
  condition: string | undefined,
  newId: NewId,
) {
  const group = newId();
  const key = "a";
  return {
    frame: { ...frame, actions: [...frame.actions, marker(newId, anchorSeq, optionMeta(group, key, label, condition, 1))] },
    group,
    key,
  };
}

/** Add Option B, C… to an existing option point, starting empty. */
export function addOptionBranch(frame: PlayFrame, group: string, label: string, condition: string | undefined, newId: NewId) {
  const g = groupOf(frame, group);
  const key = nextOptionKey(frame, group);
  if (!g || !key) return null;
  return {
    frame: { ...frame, actions: [...frame.actions, marker(newId, g.seq, optionMeta(group, key, label, condition, 1))] },
    key,
  };
}

/** Option metadata a newly drawn action at `seq` should carry inside a branch. */
export function optionForSeq(frame: PlayFrame, group: string, key: string, seq: number): Opt | undefined {
  const g = groupOf(frame, group);
  const b = g?.branches.find((x) => x.key === key);
  if (!g || !b || seq < g.seq) return undefined;
  return optionMeta(group, key, b.label, b.condition, seq - g.seq + 1);
}

export function updateOptionBranch(frame: PlayFrame, group: string, key: string, patch: { label?: string; condition?: string }): PlayFrame {
  return {
    ...frame,
    actions: frame.actions.map((a) => {
      if (a.option?.group !== group || a.option.key !== key) return a;
      const next: Opt = { ...a.option };
      if (patch.label !== undefined) next.label = clean(patch.label) || `Option ${optionLetter(key)}`;
      if (patch.condition !== undefined) {
        const c = clean(patch.condition);
        if (c) next.condition = c;
        else delete next.condition;
      }
      return { ...a, option: next };
    }),
  };
}

export function duplicateOptionBranch(frame: PlayFrame, group: string, key: string, newId: NewId) {
  const nk = nextOptionKey(frame, group);
  if (!nk) return null;
  const src = frame.actions.filter((a) => a.option?.group === group && a.option.key === key);
  const label = `${src[0]?.option?.label ?? "Option"} copy`;
  const copies = src.flatMap((a) => a.option ? [{ ...a, id: newId(), option: { ...a.option, key: nk, label } }] : []);
  return { frame: { ...frame, actions: [...frame.actions, ...copies] }, key: nk };
}

/** Remove one option. Shared sequences and other options are untouched. */
export function deleteOptionBranch(frame: PlayFrame, group: string, key: string): PlayFrame {
  return { ...frame, actions: frame.actions.filter((a) => !(a.option?.group === group && a.option.key === key)) };
}

/**
 * Insert an empty sequence right after `seq`. Inside an option only that
 * option's later actions shift; on the shared path everything later shifts.
 */
export function insertSequenceAfter(frame: PlayFrame, seq: number, branch?: { group: string; key: string }): PlayFrame {
  return {
    ...frame,
    actions: frame.actions.map((a) => {
      if (a.seq <= seq) return a;
      if (branch && (a.option?.group !== branch.group || a.option.key !== branch.key)) return a;
      return shiftAction(a, 1, !!branch);
    }),
  };
}

function shiftAction(a: PlayAction, by: number, withinBranch: boolean): PlayAction {
  const next = { ...a, seq: a.seq + by };
  if (withinBranch && a.option?.branchSeq) next.option = { ...a.option, branchSeq: a.option.branchSeq + by };
  return next;
}

/** Delete one sequence of an option, closing the gap inside that option only. */
export function deleteBranchSequence(frame: PlayFrame, group: string, key: string, seq: number, newId: NewId): PlayFrame {
  const g = groupOf(frame, group);
  const b = g?.branches.find((x) => x.key === key);
  const mine = (a: PlayAction) => a.option?.group === group && a.option.key === key;
  let actions = frame.actions
    .filter((a) => !(mine(a) && a.seq === seq))
    .map((a) => (mine(a) && a.seq > seq ? shiftAction(a, -1, true) : a));
  if (g && b && !actions.some(mine)) {
    actions = [...actions, marker(newId, g.seq, optionMeta(group, key, b.label, b.condition, 1))];
  }
  return { ...frame, actions };
}

/**
 * The coach drew a second ball outcome for the same player in one sequence.
 * Turn it into a proper option point at that sequence instead of a lone
 * same-sequence alternative.
 */
export function conflictToOption(frame: PlayFrame, rivalId: string, action: PlayAction, newId: NewId) {
  const rival = frame.actions.find((a) => a.id === rivalId);
  if (!rival) return null;
  const S = action.seq;

  if (rival.option) {
    const { group, key: rivalKey } = rival.option;
    const g = groupOf(frame, group);
    const key = nextOptionKey(frame, group);
    if (!g || !key) return null;
    const label = `Option ${optionLetter(key)}`;
    const path = isPathGroup(frame, group);
    // The new option repeats the rival option's earlier sequences, then diverges.
    const before = frame.actions
      .filter((a) => a.option?.group === group && a.option.key === rivalKey && a.seq < S && !isOptionMarker(a))
      .map((a) => ({ ...a, id: newId(), option: { ...a.option!, key, label } }));
    const opt: Opt = path ? optionMeta(group, key, label, undefined, S - g.seq + 1) : { group, key, label };
    return { frame: { ...frame, actions: [...frame.actions, ...before, { ...action, option: opt }] }, group, key };
  }

  const group = newId();
  const shared = (a: PlayAction) => !a.option && a.seq >= S;
  const companions = frame.actions
    .filter(
      (a) =>
        !a.option &&
        a.seq === S &&
        a.id !== rivalId &&
        !(BALL_ACTIONS.has(a.type) && a.actor === action.actor),
    )
    .map((a) => ({ ...a, id: newId(), option: optionMeta(group, "b", "Option B", undefined, 1) }));
  const actions = frame.actions.map((a) =>
    shared(a) ? { ...a, option: optionMeta(group, "a", "Option A", undefined, a.seq - S + 1) } : a,
  );
  return {
    frame: {
      ...frame,
      actions: [...actions, ...companions, { ...action, option: optionMeta(group, "b", "Option B", undefined, 1) }],
    },
    group,
    key: "b",
  };
}
