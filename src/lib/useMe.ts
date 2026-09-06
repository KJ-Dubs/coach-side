import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { fetchMyRole, fetchOrg, fetchProfile, fetchTeams } from "./data";
import type { CoachRole } from "./types";

/** Everything the shell and account pages need about the signed-in coach. */
export function useMe() {
  const { user, ready } = useAuth();
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: fetchProfile,
    enabled: !!user,
  });
  const org = useQuery({
    queryKey: ["org", profile.data?.org_id],
    queryFn: () => fetchOrg(profile.data!.org_id as string),
    enabled: !!profile.data?.org_id,
  });
  const role = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: fetchMyRole,
    enabled: !!user,
  });
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams, enabled: !!user });

  return {
    user,
    ready,
    profile: profile.data ?? null,
    org: org.data ?? null,
    role: (role.data ?? null) as CoachRole | null,
    isHeadCoach: role.data === "head_coach",
    teams: teams.data ?? [],
    loading: !ready || profile.isLoading || teams.isLoading,
  };
}
