/**
 * Team-timezone date helpers for connector schedule tools. Pure and
 * runtime-agnostic (Intl only), so they run on Workers and in tests.
 */
export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

type Parts = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function partsIn(ms: number, tz: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const get = (type: string) =>
    Number(fmt.formatToParts(new Date(ms)).find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}

/** Offset (ms) of `tz` from UTC at instant `ms`. */
function offsetAt(ms: number, tz: string): number {
  const p = partsIn(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Wall-clock time in `tz` → UTC instant (ms). */
export function zonedWallTimeToUtc(p: Parts, tz: string): number {
  const guess = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  let result = guess - offsetAt(guess, tz);
  // Re-check once across DST boundaries.
  const second = guess - offsetAt(result, tz);
  if (second !== result) result = second;
  return result;
}

const WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/i;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function validParts(p: Parts) {
  if (p.y < 2000 || p.y > 2100) return false;
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > 31) return false;
  if (p.h > 23 || p.mi > 59 || p.s > 59) return false;
  const check = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  return check.getUTCDate() === p.d && check.getUTCMonth() === p.mo - 1;
}

/**
 * Parse a date-time. Accepts ISO 8601 with an offset ("…Z", "…-07:00") or a
 * local wall time ("2026-10-23T16:30") interpreted in the team's timezone.
 * Returns a UTC ISO string, or null when invalid.
 */
export function parseEventDateTime(input: string, tz: string): string | null {
  const value = input.trim();
  if (WITH_OFFSET.test(value)) {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return null;
    const y = new Date(ms).getUTCFullYear();
    if (y < 2000 || y > 2100) return null;
    return new Date(ms).toISOString();
  }
  const m = LOCAL.exec(value);
  if (!m) return null;
  const p: Parts = { y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: +m[4]!, mi: +m[5]!, s: m[6] ? +m[6] : 0 };
  if (!validParts(p)) return null;
  return new Date(zonedWallTimeToUtc(p, tz)).toISOString();
}

/** Start of a calendar day ("YYYY-MM-DD") in `tz`, as UTC ISO; also accepts full date-times. */
export function parseDayStart(input: string, tz: string, addDays = 0): string | null {
  const m = DATE_ONLY.exec(input.trim());
  if (!m) return parseEventDateTime(input, tz);
  const base = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]! + addDays));
  const p: Parts = { y: base.getUTCFullYear(), mo: base.getUTCMonth() + 1, d: base.getUTCDate(), h: 0, mi: 0, s: 0 };
  if (!validParts(p) || !validParts({ y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: 0, mi: 0, s: 0 })) return null;
  return new Date(zonedWallTimeToUtc(p, tz)).toISOString();
}

/** "YYYY-MM-DDTHH:mm" wall time in `tz`. */
export function toLocalWallTime(iso: string, tz: string): string {
  const p = partsIn(Date.parse(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Human label in `tz`, e.g. "Thu, Oct 23, 2026, 4:30 PM". */
export function toLocalLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Today's date ("YYYY-MM-DD") in `tz`. */
export function todayIn(tz: string, now = Date.now()): string {
  return toLocalWallTime(new Date(now).toISOString(), tz).slice(0, 10);
}

/** Current basketball season label, e.g. "2026-27" from August on. */
export function currentSeasonLabel(now = new Date()): string {
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
