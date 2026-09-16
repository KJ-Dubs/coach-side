import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { fetchIsAppAdmin } from "./community";

/**
 * The single owner check for the interface.
 *
 * The answer always comes from the database for the person who is signed in
 * right now, and the cache key carries that person's id, so switching
 * accounts on the same device can never reuse someone else's answer.
 * Every owner-only action is also checked again on the server.
 */
export function useIsAppAdmin() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["is-app-admin", user?.id ?? "signed-out"],
    queryFn: fetchIsAppAdmin,
    enabled: !!user,
    staleTime: 300_000,
  });
  return { isAdmin: !!user && q.data === true, checking: !!user && q.isLoading };
}
