/**
 * Search-engine wording for a published Library drill, built only from the
 * coach's saved drill details (name, category, minutes, group size, level,
 * skill focus, equipment). Pure: the page head and tests share it.
 */

export type DrillSeoSource = {
  name: string;
  category: string;
  duration_minutes: number | null;
  group_size: string | null;
  difficulty?: string | null;
  skill_focus?: string[] | null;
  equipment?: string[] | null;
  library_author_name?: string | null;
};

export const DRILL_TITLE_MAX = 70;
const BRAND = " | CoachSide";

const GROUP_PHRASE: Record<string, string> = {
  Individual: "individual players",
  Pairs: "pairs",
  "Small group": "small groups",
  Team: "a full team",
};

function minutes(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function list(terms: string[]): string {
  const t = terms.map((s) => s.trim()).filter(Boolean);
  if (t.length <= 1) return t.join("");
  return `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}`;
}

/**
 * "Mikan Series – Finishing Basketball Drill, 6 min, Individual | CoachSide".
 * Minutes and group size are added only while the title stays short.
 */
export function drillSeoTitle(d: DrillSeoSource): string {
  const name = (d.name || "Basketball Drill").trim();
  const category = (d.category || "").trim();
  let title = `${name} – ${category ? `${category} ` : ""}Basketball Drill`;
  if (title.length > DRILL_TITLE_MAX) return title;
  const m = minutes(d.duration_minutes);
  const extras = [m ? `, ${m} min` : "", d.group_size ? `, ${d.group_size.trim()}` : ""];
  // Drill details outrank the brand suffix when space is tight.
  for (const extra of extras) {
    if (extra && title.length + extra.length <= DRILL_TITLE_MAX) title += extra;
  }
  if (title.length + BRAND.length <= DRILL_TITLE_MAX) title += BRAND;
  return title;
}

export function drillSeoDescription(d: DrillSeoSource): string {
  const name = (d.name || "This drill").trim();
  const m = minutes(d.duration_minutes);
  const category = (d.category || "").trim().toLowerCase();
  const group = d.group_size ? GROUP_PHRASE[d.group_size.trim()] ?? d.group_size.trim().toLowerCase() : null;
  const article = m ? (/^(8|11|18)/.test(String(m)) ? "an" : "a") : /^[aeiou]/.test(category) ? "an" : "a";
  let s = `${name} is ${article} ${m ? `${m}-minute ` : ""}${category ? `${category} ` : ""}basketball drill`;
  if (group) s += ` for ${group}`;
  s += ".";
  const skills = (d.skill_focus ?? []).filter(Boolean);
  if (skills.length) s += ` Skill focus: ${list(skills)}.`;
  if (d.difficulty?.trim()) s += ` Level: ${d.difficulty.trim().toLowerCase()}.`;
  const gear = (d.equipment ?? []).filter(Boolean);
  if (gear.length) s += ` Equipment: ${list(gear)}.`;
  s += " Includes step-by-step instructions, coaching points and a court diagram.";
  const by = d.library_author_name?.trim();
  s += by ? ` Free on CoachSide, published by ${by}.` : " Free on CoachSide.";
  return s;
}

export function drillSeoKeywords(d: DrillSeoSource): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string | null | undefined) => {
    const t = v?.trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };
  add(d.category ? `${d.category.trim().toLowerCase()} basketball drill` : null);
  (d.skill_focus ?? []).forEach(add);
  add(d.group_size ? `${d.group_size.trim().toLowerCase()} basketball drill` : null);
  add(d.difficulty ? `${d.difficulty.trim().toLowerCase()} basketball drill` : null);
  add("basketball drill");
  return out;
}
