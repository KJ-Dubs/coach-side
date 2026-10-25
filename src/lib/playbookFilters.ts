import { CONCEPTS, DEFENSES, OUTCOMES, PRIMARY_ACTIONS, normalizeIndex, searchScore } from "./playIndex";
import { PLAY_CATEGORIES, normalizeCategory, type Play } from "./types";

/**
 * Playbook concept filters. Each filter only reads the coach-saved index
 * (concepts/defenses/outcomes/actions/tags, legacy situation) and Play Type —
 * nothing is inferred from the drawing here.
 */
export type ConceptFilter = { key: string; label: string; match: (p: Play) => boolean };

const lc = (xs: (string | null | undefined)[]) => xs.flatMap((x) => x ? [x.toLowerCase()] : []);

function fields(p: Play) {
  const i = normalizeIndex(p);
  return {
    concepts: lc(i.concepts),
    defenses: lc(i.defenses),
    outcomes: lc(i.outcomes),
    actions: lc(i.primary_actions),
    tags: lc(i.tags),
    situation: (p.situation ?? "").toLowerCase(),
    category: normalizeCategory(p.category),
    time: (i.time_pressure ?? "").toLowerCase(),
  };
}

const has = (xs: string[], ...vals: string[]) => vals.some((v) => xs.includes(v.toLowerCase()));
const tagLike = (xs: string[], ...parts: string[]) => xs.some((x) => parts.some((p) => x.includes(p)));

export const CONCEPT_FILTERS: ConceptFilter[] = [
  { key: "three", label: "3-point looks", match: (p) => { const f = fields(p); return has(f.outcomes, "3-point look") || tagLike(f.tags, "three", "3pt", "3-point"); } },
  { key: "cuts", label: "Cuts", match: (p) => { const f = fields(p); return has(f.actions, "Cut", "Backdoor", "Flash") || has(f.concepts, "Backdoor") || tagLike(f.tags, "cut", "backdoor"); } },
  { key: "5out", label: "5-out", match: (p) => { const f = fields(p); return has(f.concepts, "5 Out") || tagLike(f.tags, "5 out", "5-out"); } },
  { key: "4out", label: "4-out 1-in", match: (p) => has(fields(p).concepts, "4 Out 1 In") },
  { key: "pnr", label: "Pick-and-roll", match: (p) => { const f = fields(p); return has(f.actions, "Ball screen") || tagLike(f.tags, "pick", "pnr", "ball screen"); } },
  { key: "screens", label: "Screens", match: (p) => { const f = fields(p); return tagLike(f.actions, "screen", "stagger") || tagLike(f.tags, "screen"); } },
  { key: "motion", label: "Motion", match: (p) => { const f = fields(p); return has(f.concepts, "Motion") || tagLike(f.tags, "motion"); } },
  { key: "transition", label: "Transition", match: (p) => { const f = fields(p); return f.situation === "transition" || tagLike(f.tags, "transition", "fast break"); } },
  { key: "post", label: "Post play", match: (p) => { const f = fields(p); return has(f.concepts, "Post", "High-Low", "Split Post") || has(f.actions, "Post entry", "High-low", "Split post") || has(f.outcomes, "Post touch"); } },
  { key: "zone", label: "vs Zone", match: (p) => { const f = fields(p); return tagLike(f.defenses, "zone") || tagLike(f.tags, "zone"); } },
  { key: "man", label: "vs Man-to-man", match: (p) => { const f = fields(p); return has(f.defenses, "Man to man", "Tight / denial", "Sagging man", "Switching") || tagLike(f.tags, "man to man", "man-to-man"); } },
  { key: "oob", label: "Out of bounds", match: (p) => { const f = fields(p); return f.category === "BLOB" || f.category === "SLOB" || has(f.concepts, "BLOB", "SLOB") || f.situation.includes("out of bounds"); } },
  { key: "press", label: "Press break", match: (p) => { const f = fields(p); return f.category === "Press Break" || f.situation === "press break" || has(f.defenses, "Full court press"); } },
  { key: "late", label: "Late game", match: (p) => { const f = fields(p); return (!!f.time && f.time !== "no rush") || f.situation === "end of quarter" || f.situation === "after timeout"; } },
];

export const SORTS = [
  { key: "newest", label: "Newest added" },
  { key: "oldest", label: "Oldest" },
  { key: "updated", label: "Recently updated" },
  { key: "az", label: "A–Z" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

const time = (s?: string | null) => (s ? Date.parse(s) || 0 : 0);

export function sortPlays(plays: Play[], sort: SortKey): Play[] {
  const out = [...plays];
  const byName = (a: Play, b: Play) => a.name.localeCompare(b.name);
  if (sort === "az") return out.sort(byName);
  if (sort === "oldest") return out.sort((a, b) => time(a.created_at) - time(b.created_at) || byName(a, b));
  if (sort === "updated")
    return out.sort((a, b) => time(b.updated_at ?? b.created_at) - time(a.updated_at ?? a.created_at) || byName(a, b));
  return out.sort((a, b) => time(b.created_at) - time(a.created_at) || byName(a, b));
}

/** Text search across name, Play Type, saved index/tags and folder names. */
export function matchesQuery(p: Play, query: string, folderNames: string[]): boolean {
  const q = query.trim();
  if (!q) return true;
  if (folderNames.some((n) => n.toLowerCase().includes(q.toLowerCase()))) return true;
  return searchScore({ ...normalizeIndex(p), name: p.name, category: p.category, situation: p.situation ?? null }, q) > 0;
}

/** Selected concept filters combine with AND so each pick narrows the list. */
export function matchesConcepts(p: Play, keys: string[]): boolean {
  return keys.every((k) => CONCEPT_FILTERS.find((f) => f.key === k)?.match(p) ?? true);
}

export type DiscoveryFilter = ConceptFilter & { group: string; category?: string };
export type DiscoverySection = { label: string; choices: DiscoveryFilter[] };
const indexedChoice = (field: "concepts" | "defenses" | "outcomes" | "actions", value: string): DiscoveryFilter => ({
  key: `${field}:${value}`, label: value, group: field,
  match: (p) => has(fields(p)[field], value),
});
const conceptChoice = (key: string, group: string): DiscoveryFilter[] => {
  const filter = CONCEPT_FILTERS.find((f) => f.key === key);
  return filter ? [{ ...filter, group }] : [];
};

/** Display sections use saved vocabulary; independent facets stay AND-able.
 * For example 5 Out + 3-point looks describes structure AND outcome, even
 * though both convenient shortcuts are displayed in Concept / Structure. */
export const DISCOVERY_SECTIONS: DiscoverySection[] = [
  { label: "Play Type", choices: PLAY_CATEGORIES.map((category) => ({
    key: `type:${category}`, label: category, category, group: "type",
    match: (p) => normalizeCategory(p.category) === category,
  })) },
  { label: "Concept / Structure", choices: [
    ...CONCEPTS.filter((v) => v !== "BLOB" && v !== "SLOB").map((v) => indexedChoice("concepts", v)),
    ...["cuts", "screens", "pnr"].flatMap((key) => conceptChoice(key, "actions")),
    ...conceptChoice("transition", "context"),
    ...conceptChoice("three", "outcomes"),
    ...conceptChoice("oob", "context"),
    ...conceptChoice("late", "context"),
  ] },
  { label: "Defense Faced", choices: [
    ...conceptChoice("zone", "defenses"), ...conceptChoice("man", "defenses"),
    ...conceptChoice("press", "defenses"),
    ...DEFENSES.map((v) => indexedChoice("defenses", v)),
  ] },
  { label: "Outcome / Action", choices: [
    ...OUTCOMES.map((v) => indexedChoice("outcomes", v)),
    ...PRIMARY_ACTIONS.map((v) => indexedChoice("actions", v)),
  ] },
];
export const DISCOVERY_FILTERS = DISCOVERY_SECTIONS.flatMap((s) => s.choices);

/** OR for alternative values of one facet; AND for independent facets. */
export function matchesDiscovery(p: Play, keys: string[]): boolean {
  const groups = new Map<string, DiscoveryFilter[]>();
  for (const key of keys) {
    const filter = DISCOVERY_FILTERS.find((f) => f.key === key);
    if (filter) groups.set(filter.group, [...(groups.get(filter.group) ?? []), filter]);
  }
  return [...groups.values()].every((choices) => choices.some((f) => f.match(p)));
}

/**
 * A coach's team Playbook: plays whose source team is this team plus every
 * explicit team assignment — the same rule My Playbook uses for a team scope.
 */
export function playsForTeam(
  plays: Play[],
  assignments: { play_id: string; team_id: string }[],
  teamId: string | null,
): Play[] {
  if (!teamId) return [];
  const assigned = new Set(assignments.filter((a) => a.team_id === teamId).map((a) => a.play_id));
  return plays.filter((p) => p.team_id === teamId || assigned.has(p.id));
}

/** Timeout shortcuts. Each is an existing discovery filter key, never a new tag. */
export const BOARD_SITUATIONS: { label: string; key: string }[] = [
  { label: "BLOB", key: "type:BLOB" },
  { label: "SLOB", key: "type:SLOB" },
  { label: "Need 3", key: "three" },
  { label: "vs Zone", key: "zone" },
  { label: "vs Man", key: "man" },
  { label: "Press Break", key: "press" },
  { label: "Late Game", key: "late" },
];
