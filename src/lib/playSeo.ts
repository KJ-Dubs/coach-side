import { normalizeIndex } from "./playIndex";
import { normalizeCategory } from "./types";

/**
 * Search-engine wording for a published Library play, built only from the
 * coach's own saved index (type, concepts, defenses, outcomes, actions, tags).
 * Pure: the page head, the visible "Indexed as" panel and tests share it.
 */

export type PlaySeoSource = {
  name: string;
  category: string;
  author_label?: string | null;
  situation?: string | null;
  defense_faced?: string | null;
  outcome?: string | null;
  concepts?: string[] | null;
  defenses?: string[] | null;
  outcomes?: string[] | null;
  primary_actions?: string[] | null;
  tags?: string[] | null;
};

export type PlaySeoTerms = {
  type: string;
  concepts: string[];
  defenses: string[];
  outcomes: string[];
  actions: string[];
  tags: string[];
};

export const PLAY_TITLE_MAX = 70;
const BRAND = " | CoachSide";

const TYPE_PHRASE: Record<string, string> = {
  Offense: "Offense",
  BLOB: "BLOB Inbound",
  SLOB: "SLOB Inbound",
  Defense: "Defense",
  "Press Break": "Press Break",
  Presses: "Press",
};

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export function playSeoTerms(p: PlaySeoSource): PlaySeoTerms {
  const idx = normalizeIndex(p);
  const type = normalizeCategory(p.category || "Offense");
  return {
    type,
    // The type already says BLOB/SLOB; don't repeat it as a concept.
    concepts: uniq(idx.concepts).filter((c) => c.toLowerCase() !== type.toLowerCase()),
    defenses: uniq(idx.defenses),
    outcomes: uniq(idx.outcomes),
    actions: uniq(idx.primary_actions),
    tags: uniq(idx.tags),
  };
}

/** Lower-cases ordinary words; keeps acronyms and numbered terms (BLOB, 5 Out, 2-3 zone). */
function phrase(term: string): string {
  if (/\d/.test(term) || /^[A-Z][A-Z-]+$/.test(term)) return term;
  return term.toLowerCase();
}

function list(terms: string[]): string {
  const t = terms.map(phrase);
  if (t.length <= 1) return t.join("");
  return `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}`;
}

function orList(terms: string[]): string {
  const t = terms.map(phrase);
  if (t.length <= 1) return t.join("");
  return `${t.slice(0, -1).join(", ")} or ${t[t.length - 1]}`;
}

/**
 * "Box Elevator – 5 Out Offense Basketball Play vs Man to Man | CoachSide".
 * Optional parts are added in priority order only while the title stays short.
 */
export function playSeoTitle(p: PlaySeoSource): string {
  const t = playSeoTerms(p);
  const name = (p.name || "Basketball Play").trim();
  const typePhrase = TYPE_PHRASE[t.type] ?? t.type;
  const lead = t.concepts[0];
  const core = `${name} – ${lead ? `${lead} ` : ""}${typePhrase} Basketball Play`;
  const fallback = `${name} – ${typePhrase} Basketball Play`;
  let title = core.length <= PLAY_TITLE_MAX ? core : fallback;
  if (title.length > PLAY_TITLE_MAX) return title;
  const extras = [
    t.defenses[0] ? ` vs ${t.defenses[0]}` : "",
    t.outcomes[0] ? ` for ${t.outcomes[0]}` : "",
  ];
  for (const extra of extras) {
    if (extra && title.length + extra.length <= PLAY_TITLE_MAX - BRAND.length) title += extra;
  }
  if (title.length + BRAND.length <= PLAY_TITLE_MAX) title += BRAND;
  return title;
}

export function playSeoDescription(p: PlaySeoSource): string {
  const t = playSeoTerms(p);
  const name = (p.name || "This play").trim();
  const typePhrase = (TYPE_PHRASE[t.type] ?? t.type).replace(/^(Offense|Defense)$/, (m) => m.toLowerCase());
  const concepts = t.concepts.length ? `${list(t.concepts)} ` : "";
  let s = `${name} is an animated ${concepts}${typePhrase} basketball play`;
  if (t.defenses.length) s += ` vs ${list(t.defenses)}`;
  if (t.outcomes.length) s += `, built for a ${orList(t.outcomes)}`;
  s += ".";
  if (t.actions.length) s += ` Key actions: ${list(t.actions)}.`;
  const by = p.author_label?.trim();
  s += by ? ` Watch it free on CoachSide, published by ${by}.` : " Watch it free on CoachSide.";
  return s;
}

/** Every indexed term, most specific first, for keywords and structured data. */
export function playSeoKeywords(p: PlaySeoSource): string[] {
  const t = playSeoTerms(p);
  const typePhrase = TYPE_PHRASE[t.type] ?? t.type;
  return uniq([
    `${typePhrase} basketball play`,
    ...t.concepts,
    ...t.defenses.map((d) => `vs ${d}`),
    ...t.outcomes,
    ...t.actions,
    ...t.tags,
    "animated basketball play",
  ]);
}
