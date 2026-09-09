import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { purgeDeviceRoleCache } from "./roleCache";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: (session?.user ?? null) as User | null, ready };
}

/** Ordered sign-out: stop queries, drop cache, clear session, then leave. */
export async function signOut(queryClient?: QueryClient) {
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
