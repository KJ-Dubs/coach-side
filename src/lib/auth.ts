import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { purgeDeviceRoleCache } from "./roleCache";
import { resumeSession } from "./sessionResume";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // The initial state comes from resumeSession, which survives a failed
      // token refresh on a bad connection instead of reporting "signed out".
      if (event === "INITIAL_SESSION") return;
      setSession(s);
      setReady(true);
    });
    void resumeSession().then(({ session: s }) => {
      if (!alive) return;
      setSession(s);
      setReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: (session?.user ?? null) as User | null, ready };
}

/** Ordered sign-out: stop queries, drop cache, clear session, then leave. */
export async function signOut(queryClient?: QueryClient) {
  // Drop this device's notification subscription first, while the outgoing
  // account is still signed in, so the next account never inherits it.
  try {
    const [{ unsubscribeThisDevice }, { removePushSubscription }] = await Promise.all([
      import("./push"),
      import("./notifications.functions"),
    ]);
    const endpoint = await unsubscribeThisDevice();
    if (endpoint) await removePushSubscription({ data: { endpoint } });
  } catch {
    // Signing out must never be blocked by notification cleanup.
  }

  if (queryClient) {
    await queryClient.cancelQueries();
    queryClient.clear();
  }
  // Never let one account's role linger on this device for the next sign-in.
  purgeDeviceRoleCache();
  await supabase.auth.signOut();
}


export function initialsOf(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || "").trim() || (email || "").split("@")[0] || "C";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
