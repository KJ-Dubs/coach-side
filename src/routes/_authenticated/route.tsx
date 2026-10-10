import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserAccess, resolveRole } from "@/lib/access";
import { purgeDeviceRoleCache } from "@/lib/roleCache";
import { flushQueue } from "@/lib/offline";

/**
 * Sign-in gate for every coach-only page. Client-only because the session
 * lives in browser storage. Works offline: a locally stored session is
 * accepted when the auth server cannot be reached (gym wifi), and the
 * database still enforces access on every request.
 *
 * What someone is allowed to open comes from database membership only —
 * never from anything remembered on this device.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const next = location.href.startsWith("/") ? location.href : location.pathname;
    const toAuth = () => redirect({ to: "/auth", search: { next } });
    const { data: local } = await supabase.auth.getSession();
    if (!local.session) throw toAuth();
    let user = local.session.user;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (data.user) user = data.user;
      else {
        // Only a definitive rejection of the session (expired/revoked) sends
        // the coach to sign in. Network, timeout and server hiccups keep the
        // stored session so a live game is never interrupted.
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403) throw toAuth();
      }
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      // Offline: trust the stored session; the database still guards the data.
    }

    // Players may only reach the Locker Room and their own profile.
    try {
      purgeDeviceRoleCache();
      const role = resolveRole(await getCurrentUserAccess());
      if (!role.allowedPath(location.pathname)) {
        throw redirect({ to: "/lockerroom" });
      }
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      // Access lookup unavailable (offline) — page-level queries stay guarded.
    }

    return { user };
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
    // Never sign out on pagehide/visibility/backgrounding: mobile and PWA
    // fire these during normal app switching and it would end a live game.
    return () => {
      clearInterval(t);
      window.removeEventListener("online", sync);
    };
  }, []);
  return <Outlet />;
}
