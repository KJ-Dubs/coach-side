import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { flushQueue } from "@/lib/offline";
import { rememberDevice } from "@/lib/remember";

/**
 * Sign-in gate for every coach-only page. Client-only because the session
 * lives in browser storage. Works offline: a locally stored session is
 * accepted when the auth server cannot be reached (gym wifi), and the
 * database still enforces access on every request.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: local } = await supabase.auth.getSession();
    if (!local.session) throw redirect({ to: "/auth" });
    try {
      const { data, error } = await supabase.auth.getUser();
      if (data.user) return { user: data.user };
      if (error && /network|fetch|Failed/i.test(error.message)) {
        return { user: local.session.user };
      }
      throw redirect({ to: "/auth" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      // Offline: trust the stored session; RLS still guards the data.
      return { user: local.session.user };
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // App-wide offline queue flusher so events recorded in a gym without
  // signal still reach the backend even after leaving the live-game screen.
  useEffect(() => {
    const sync = () => void flushQueue().catch(() => undefined);
    sync();
    const t = setInterval(sync, 10000);
    window.addEventListener("online", sync);
    // "Remember this device" off → drop the local session when the tab closes.
    const onHide = () => {
      if (!rememberDevice()) void supabase.auth.signOut({ scope: "local" });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", sync);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);
  return <Outlet />;
}
