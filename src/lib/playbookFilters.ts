import { normalizeIndex, searchScore } from "./playIndex";
import { normalizeCategory, type Play } from "./types";

/**
 * Playbook concept filters. Each filter only reads the coach-saved index
 * (concepts/defenses/outcomes/actions/tags, legacy situation) and Play Type —
 * nothing is inferred from the drawing here.
 */
export type ConceptFilter = { key: string; label: string; match: (p: Play) => boolean };

const lc = (xs: (string | null | undefined)[]) => xs.filter(Boolean).map((x) => x!.toLowerCase());

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
