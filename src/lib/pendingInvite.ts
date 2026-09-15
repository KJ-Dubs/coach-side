/**
 * Keeps the team invite a player arrived with, so email confirmation,
 * Google sign-in, a refresh or a plain sign-in all return them to the
 * same /join/:token page instead of the coach dashboard.
 *
 * Scope rules (deliberate):
 * - It only survives for a short window (long enough to finish signing in).
 * - It is consumed once: reading it for a redirect also removes it, so a
 *   later visit to "/" can never be hijacked into a team join screen.
 */
const KEY = "coachside.pending-invite";
const TTL_MS = 30 * 60 * 1000;

type Stored = { token: string; at: number };

export function setPendingInvite(token: string) {
  try {
    const payload: Stored = { token, at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

/** Read the invite without clearing it. Returns null once it has expired. */
export function peekPendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw || !raw.trim()) return null;
    let parsed: Stored | null = null;
    try {
      parsed = JSON.parse(raw) as Stored;
    } catch {
      // Legacy plain-token value from an older build: treat as stale.
      window.localStorage.removeItem(KEY);
      return null;
    }
    if (!parsed?.token || typeof parsed.at !== "number" || Date.now() - parsed.at > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

/** Read and immediately clear: use this before redirecting into the join flow. */
export function consumePendingInvite(): string | null {
  const token = peekPendingInvite();
  if (token) clearPendingInvite();
  return token;
}

export function clearPendingInvite() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function joinUrl(token: string) {
  if (typeof window === "undefined") return `/join/${token}`;
  return `${window.location.origin}/join/${token}`;
}
