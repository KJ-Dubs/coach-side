/**
 * Resumes a stored sign-in without ever discarding it on a bad connection.
 *
 * When the app reopens after the short-lived access token expired, the auth
 * client must refresh it. If that refresh hits a network/server error the
 * client keeps the stored session but reports "no session" — which used to
 * bounce players to the sign-in page after reopening the app on bad gym or
 * school wifi. Here we retry with the stored refresh token and, if the auth
 * server is still unreachable, keep the stored session (the database still
 * checks every request). Only a definitive rejection returns no session.
 */
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isDefinitiveAuthFailure } from "./playerAccess";

type AuthInternals = {
  storageKey?: string;
  storage?: unknown;
  persistSession?: boolean;
  autoRefreshToken?: boolean;
};

const internals = () => supabase.auth as unknown as AuthInternals;

export function authStorageKey(): string {
  return internals().storageKey ?? `sb-${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}-auth-token`;
}

/** The session saved on this device (first-party localStorage), if any. */
export function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(authStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (parsed?.refresh_token && parsed.user) return parsed as Session;
  } catch {
    /* storage unavailable */
  }
  return null;
}

export type ResumedSession = { session: Session | null; offline: boolean };

export async function resumeSession(): Promise<ResumedSession> {
  const { data, error } = await supabase.auth.getSession();
  if (data.session) return { session: data.session, offline: false };
  const stored = readStoredSession();
  if (!stored) return { session: null, offline: false };
  if (isDefinitiveAuthFailure(error)) return { session: null, offline: false };

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await supabase.auth.refreshSession({ refresh_token: stored.refresh_token });
    if (r.data.session) return { session: r.data.session, offline: false };
    if (isDefinitiveAuthFailure(r.error)) return { session: null, offline: false };
    await new Promise((res) => setTimeout(res, 600));
  }
  // Auth server unreachable: keep the person signed in on this device.
  const still = readStoredSession();
  return { session: still, offline: Boolean(still) };
}

/** Non-secret facts about how sign-in is stored, for Launch QA. */
export async function authPersistenceDiagnostics() {
  const i = internals();
  const usesLocal = typeof window !== "undefined" && i.storage === window.localStorage;
  const { data } = await supabase.auth.getSession();
  const s = data.session ?? readStoredSession();
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return {
    storage: usesLocal ? "Device storage (localStorage)" : "Editor preview broker",
    persistSession: i.persistSession !== false,
    autoRefreshToken: i.autoRefreshToken !== false,
    signedIn: Boolean(s),
    expiresAt: s?.expires_at ? new Date(s.expires_at * 1000) : null,
    refreshTokenPresent: Boolean(s?.refresh_token),
    installedApp: standalone,
    host: typeof window !== "undefined" ? window.location.host : "",
  };
}
