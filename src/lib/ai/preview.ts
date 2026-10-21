/**
 * Pure preview builders for AI-extracted schedule events and roster players.
 * Browser-safe and deterministic: the server builds the preview the coach
 * reviews and rebuilds it from the coach's edits before anything is saved.
 * Nothing here invents a missing date, time, jersey or name.
 */
import { AI_LIMITS } from "./limits";

export type PreviewStatus = "ready" | "review" | "duplicate";

/* ---------------- schedule ---------------- */

export type ExtractedEvent = {
  event_type: "game" | "practice" | "event";
  title?: string | null | undefined;
  date: string | null;
  starts_at: string | null;
  ends_at?: string | null | undefined;
  opponent?: string | null | undefined;
  location?: string | null | undefined;
  notes?: string | null | undefined;
  confidence?: number | null | undefined;
};

export type EventPreviewItem = {
  key: string;
  include: boolean;
  status: PreviewStatus;
  issues: string[];
  conflict: string | null;
  event_type: "game" | "practice" | "event";
  title: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  opponent: string | null;
  location: string | null;
  notes: string | null;
  confidence: number;
};

export type ExistingEvent = {
  event_type: string;
  title: string;
  starts_local: string;
  status?: string;
};

const DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-10-22" (or an ISO date-time) → "2026-10-22"; anything unreadable → null. */
export function normalizeDate(value: string | null | undefined): string | null {
  const m = DATE.exec(String(value ?? "").trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!];
  if (y < 2000 || y > 2100) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d)
    return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** "16:30", "4:30 PM", "4pm", "2026-10-22T16:30" → "16:30"; unreadable → null. */
export function normalizeTime(value: string | null | undefined): string | null {
  let v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  const iso = /t(\d{1,2}):(\d{2})/.exec(v);
  if (iso) v = `${iso[1]}:${iso[2]}`;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(v.replace(/\s+/g, " "));
  if (!m) return null;
  let h = +m[1]!;
  const mi = m[2] ? +m[2] : 0;
  const ampm = m[3]?.[0];
  if (!m[2] && !ampm) return null; // a bare "4" is not a time
  if (mi > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === "p" && h !== 12) h += 12;
    if (ampm === "a" && h === 12) h = 0;
  } else if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

const clean = (v: string | null | undefined, max: number) => {
  const s = String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, max) : null;
};

const confidenceOf = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;

function defaultTitle(type: ExtractedEvent["event_type"], opponent: string | null) {
  if (type === "game") return opponent ? `vs ${opponent.replace(/^(vs\.?|@|at)\s+/i, "")}` : "Game";
  if (type === "practice") return "Practice";
  return "Team event";
}

const minutesOf = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

export function to12h(hhmm: string | null): string {
  if (!hhmm) return "Time?";
  const h = +hhmm.slice(0, 2);
  const m = hhmm.slice(3, 5);
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

export function dateLabel(date: string | null): string {
  if (!date) return "Date?";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function buildEventPreview(
  raw: ExtractedEvent[],
  existing: ExistingEvent[] = [],
): EventPreviewItem[] {
  const items = raw.slice(0, AI_LIMITS.maxExtractedEvents).map((e, i): EventPreviewItem => {
    const type: EventPreviewItem["event_type"] =
      e.event_type === "game" || e.event_type === "practice" ? e.event_type : "event";
    const opponent = clean(e.opponent, 80);
    const title = clean(e.title, 120) ?? defaultTitle(type, opponent);
    const date = normalizeDate(e.date);
    const start = normalizeTime(e.starts_at);
    const end = normalizeTime(e.ends_at);
    const confidence = confidenceOf(e.confidence);
    const issues: string[] = [];
    if (!date) issues.push(e.date ? `Date "${e.date}" unclear` : "No date found");
    if (!start) issues.push(e.starts_at ? `Time "${e.starts_at}" unclear` : "No start time found");
    if (start && end && minutesOf(end) <= minutesOf(start)) issues.push("End time is before start");
    if (confidence < AI_LIMITS.reviewConfidence) issues.push("Hard to read — please check");

    let status: PreviewStatus = issues.length ? "review" : "ready";
    let conflict: string | null = null;
    if (date && start) {
      const local = `${date}T${start}`;
      const sameDay = existing.filter(
        (x) => x.starts_local.slice(0, 10) === date && x.status !== "cancelled",
      );
      const dup = sameDay.find(
        (x) =>
          x.starts_local.slice(0, 16) === local &&
          (x.event_type === type || x.title.toLowerCase() === title.toLowerCase()),
      );
      if (dup) {
        status = "duplicate";
        issues.push(`Already on the schedule: ${dup.title} at ${to12h(start)}`);
      } else {
        const near = sameDay.find(
          (x) => Math.abs(minutesOf(x.starts_local.slice(11, 16)) - minutesOf(start)) < 90,
        );
        if (near) conflict = `Close to ${near.title} at ${to12h(near.starts_local.slice(11, 16))}`;
      }
    }
    return {
      key: `e${i}`,
      include: status === "ready",
      status,
      issues,
      conflict,
      event_type: type,
      title,
      date,
      start_time: start,
      end_time: end,
      opponent,
      location: clean(e.location, 160),
      notes: clean(e.notes, 2000),
      confidence,
    };
  });
  // Two identical rows in the same upload: keep the first.
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.date || !it.start_time) continue;
    const k = `${it.date}T${it.start_time}|${it.event_type}|${it.title.toLowerCase()}`;
    if (seen.has(k) && it.status !== "duplicate") {
      it.status = "duplicate";
      it.include = false;
      it.issues.push("Listed twice in this upload");
    }
    seen.add(k);
  }
  return items;
}

/* ---------------- roster ---------------- */

export type ExtractedPlayer = {
  jersey: string | null;
  name: string | null;
  position?: string | null | undefined;
  confidence?: number | null | undefined;
};

export type PlayerPreviewItem = {
  key: string;
  include: boolean;
  status: PreviewStatus;
  issues: string[];
  jersey: string;
  name: string;
  position: string | null;
  confidence: number;
};

export type RosterPlayer = { jersey: string; name: string };

export function normalizeJersey(value: string | null | undefined): string | null {
  const v = String(value ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/^no\.?\s*/i, "");
  return /^\d{1,3}$/.test(v) ? v : null;
}

export function buildRosterPreview(
  raw: ExtractedPlayer[],
  roster: RosterPlayer[] = [],
): PlayerPreviewItem[] {
  const byJersey = new Map(roster.map((p) => [p.jersey, p.name]));
  const byName = new Map(roster.map((p) => [p.name.trim().toLowerCase(), p.jersey]));
  const seenJersey = new Set<string>();
  return raw.slice(0, AI_LIMITS.maxExtractedPlayers).map((p, i): PlayerPreviewItem => {
    const jersey = normalizeJersey(p.jersey);
    const name = clean(p.name, 80);
    const position = clean(p.position, 20);
    const confidence = confidenceOf(p.confidence);
    const issues: string[] = [];
    let status: PreviewStatus = "ready";
    if (!jersey) issues.push(p.jersey ? `Jersey "${p.jersey}" unclear` : "No jersey number");
    if (!name) issues.push("No name found");
    if (confidence < AI_LIMITS.reviewConfidence) issues.push("Hard to read — check spelling");
    if (issues.length) status = "review";
    if (jersey && byJersey.has(jersey)) {
      status = "duplicate";
      issues.push(`#${jersey} is already ${byJersey.get(jersey)}`);
    } else if (jersey && seenJersey.has(jersey)) {
      status = "review";
      issues.push(`#${jersey} appears twice in this list`);
    }
    if (name && byName.has(name.toLowerCase()) && byName.get(name.toLowerCase()) !== jersey) {
      if (status === "ready") status = "review";
      issues.push(`${name} is already on the roster as #${byName.get(name.toLowerCase())}`);
    }
    if (jersey) seenJersey.add(jersey);
    return {
      key: `p${i}`,
      include: status === "ready",
      status,
      issues,
      jersey: jersey ?? String(p.jersey ?? "").slice(0, 4),
      name: name ?? "",
      position,
      confidence,
    };
  });
}

export function previewCounts(items: { status: PreviewStatus }[]) {
  return {
    total: items.length,
    ready: items.filter((i) => i.status === "ready").length,
    review: items.filter((i) => i.status === "review").length,
    duplicate: items.filter((i) => i.status === "duplicate").length,
  };
}
