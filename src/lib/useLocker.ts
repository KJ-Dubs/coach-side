import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { fetchMyMemberships, isCoachRole, TEAM_ROLE_LABEL, type TeamRole } from "./locker";
import { useMe } from "./useMe";

/** Role + team list for everything in the Locker Room. */
export function useLocker(teamId: string | null) {
  const { user, ready } = useAuth();
  const me = useMe();
  const memberships = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: fetchMyMemberships,
    enabled: !!user,
  });

  const membership = (memberships.data ?? []).find((m) => m.team_id === teamId) ?? null;
  // A coach reaches teams through their organisation and may have no
  // membership row yet; treat that as head coach of their own teams.
  const orgTeam = me.teams.some((t) => t.id === teamId);
  const role: TeamRole | null = membership
    ? membership.role
    : orgTeam && teamId
      ? me.isHeadCoach || me.role === null
        ? "head_coach"
        : "assistant_coach"
      : null;

  return {
    ready: ready && !memberships.isLoading && !me.loading,
    user,
    teams: me.teams,
    memberships: memberships.data ?? [],
    membership,
    role,
    isCoach: isCoachRole(role),
    isHeadCoach: role === "head_coach",
    isPlayer: role === "player",
    isParent: role === "parent",
    playerId: membership?.player_id ?? null,
    displayName: me.profile?.full_name ?? user?.email ?? "You",
    roleLabel: role ? TEAM_ROLE_LABEL[role] : "Member",
    loading: me.loading || memberships.isLoading,
  };
}
