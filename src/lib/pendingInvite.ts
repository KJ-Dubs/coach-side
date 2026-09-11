/**
 * Keeps the team invite a player arrived with, so email confirmation,
 * Google sign-in, a refresh or a plain sign-in all return them to the
 * same /join/:token page instead of the coach dashboard.
 */
const KEY = "coachside.pending-invite";

export function setPendingInvite(token: string) {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* private mode */
  }
}

export function getPendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
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
