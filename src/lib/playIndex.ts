import type { PlayFrame } from "./types";

/**
 * The CoachSide play index: the small set of coaching answers that make a play
 * findable, plus the plain-language matching used by Library search and by the
 * "CoachSide suggests" tags. No AI — one shared vocabulary, one scorer.
 */

export const SITUATIONS = [
  "Half court set",
  "Quick hitter",
  "Baseline out of bounds",
  "Sideline out of bounds",
  "After timeout",
  "Transition",
  "Press break",
  "End of quarter",
] as const;

export const DEFENSES = [
  "Man to man",
  "Tight / denial",
  "Sagging man",
  "2-3 zone",
  "3-2 zone",
  "1-3-1 zone",
  "Switching",
  "Full court press",
] as const;

export const OUTCOMES = [
  "Rim finish",
  "3-point look",
  "Mid-range",
  "Post touch",
  "Free throws",
  "Reversal / reset",
] as const;

export const PRIMARY_ACTIONS = [
  "Ball screen",
  "Off-ball screen",
  "Down screen",
  "Flare screen",
  "Backdoor",
  "Handoff",
  "Cut",
  "Post entry",
  "Skip pass",
  "Dribble drive",
  "Stagger",
  "Flash",
] as const;

export const TIME_PRESSURE = [
  "No rush",
  "Under 10 seconds",
  "Under 5 seconds",
  "Last shot",
] as const;

export type PlayIndex = {
  situation: string | null;
  defense_faced: string | null;
  outcome: string | null;
  primary_actions: string[];
  time_pressure: string | null;
  tags: string[];
};

export const EMPTY_INDEX: PlayIndex = {
  situation: null,
  defense_faced: null,
  outcome: null,
  primary_actions: [],
  time_pressure: null,
  tags: [],
};

/* ------------ suggestions read from the coach's own drawing ------------ */

function feet(p: { x: number; y: number }) {
  return { x: p.x * 94, y: p.y * 50 };
}

function rimFor(attackBasket: string) {
  return attackBasket === "left" ? { x: 5.25, y: 25 } : { x: 88.75, y: 25 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Reads the play's own frames and proposes index answers. Everything returned
 * here is only ever a suggestion — a coach's own answer always wins.
 */
export function suggestFromFrames(
  frames: PlayFrame[],
  attackBasket: string,
): { actions: string[]; outcome: string | null; tags: string[] } {
  const rim = rimFor(attackBasket);
  const actions = new Set<string>();
  const tags = new Set<string>();
  let outcome: string | null = null;

  for (const f of frames) {
    for (const a of f.actions ?? []) {
      const pts = a.points ?? [];
      const end = pts.length ? feet(pts[pts.length - 1]!) : null;
      const start = pts.length ? feet(pts[0]!) : null;
      if (a.type === "screen") {
        actions.add("Off-ball screen");
        tags.add("screening");
      }
      if (a.type === "handoff") {
        actions.add("Handoff");
        tags.add("handoff");
      }
      if (a.type === "dribble") {
        actions.add("Dribble drive");
      }
      if (a.type === "cut" || a.type === "curl") {
        actions.add("Cut");
        if (end && dist(end, rim) < 8) tags.add("rim cut");
      }
      if (a.type === "pass" && start && end) {
        if (Math.abs(start.y - end.y) > 26) actions.add("Skip pass");
        if (dist(end, rim) < 12) actions.add("Post entry");
      }
      if (a.type === "shot" && start) {
        const d = dist(start, rim);
        outcome = d > 22 ? "3-point look" : d < 6 ? "Rim finish" : "Mid-range";
        tags.add(d > 22 ? "three" : d < 6 ? "finishing" : "mid-range");
      }
    }
  }
  return { actions: [...actions], outcome, tags: [...tags] };
}

/* ------------------------- plain-language search ------------------------- */

const SYNONYMS: Record<string, string[]> = {
  "3": ["3-point look", "three"],
  "3pt": ["3-point look", "three"],
  three: ["3-point look", "three"],
  point: ["3-point look"],
  layup: ["Rim finish", "finishing"],
  rim: ["Rim finish", "finishing"],
  finish: ["Rim finish", "finishing"],
  backdoor: ["Backdoor"],
  tight: ["Tight / denial"],
  denial: ["Tight / denial"],
  deny: ["Tight / denial"],
  zone: ["2-3 zone", "3-2 zone", "1-3-1 zone"],
  man: ["Man to man"],
  switch: ["Switching"],
  press: ["Press break", "Full court press"],
  blob: ["Baseline out of bounds", "BLOB"],
  slob: ["Sideline out of bounds", "SLOB"],
  ato: ["After timeout"],
  timeout: ["After timeout"],
  end: ["End of quarter", "Last shot"],
  game: ["Last shot", "End of quarter"],
  last: ["Last shot"],
  buzzer: ["Last shot"],
  quick: ["Quick hitter"],
  ball: ["Ball screen"],
  screen: ["Ball screen", "Off-ball screen", "screening"],
  pick: ["Ball screen", "screening"],
  handoff: ["Handoff"],
  dho: ["Handoff"],
  post: ["Post entry", "Post touch"],
  skip: ["Skip pass"],
  transition: ["Transition"],
  drive: ["Dribble drive"],
};

function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export type Searchable = {
  name: string;
  category: string;
  creator?: string | null | undefined;
  situation?: string | null | undefined;
  defense_faced?: string | null | undefined;
  outcome?: string | null | undefined;
  primary_actions?: string[] | undefined;
  time_pressure?: string | null | undefined;
  tags?: string[] | undefined;
};

/** 0 = no match. Higher = better match. */
export function searchScore(item: Searchable, query: string): number {
  const q = query.trim();
  if (!q) return 1;
  const haystack = [
    item.name,
    item.category,
    item.creator ?? "",
    item.situation ?? "",
    item.defense_faced ?? "",
    item.outcome ?? "",
    item.time_pressure ?? "",
    ...(item.primary_actions ?? []),
    ...(item.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes(q.toLowerCase())) return 100;

  let score = 0;
  for (const word of tokenize(q)) {
    if (item.name.toLowerCase().includes(word)) score += 8;
    else if (haystack.includes(word)) score += 4;
    for (const mapped of SYNONYMS[word] ?? []) {
      if (haystack.includes(mapped.toLowerCase())) score += 5;
    }
  }
  return score;
}
