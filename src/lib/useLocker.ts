import { useAuth } from "./auth";
import { playerIdForTeam, roleForTeam, useAccess } from "./access";
import { isCoachRole, TEAM_ROLE_LABEL, type TeamRole } from "./locker";
import { useMe } from "./useMe";

/**
 * Role + team list for everything in the Locker Room.
 * The role always comes from database membership for that exact team.
 */
export function useLocker(teamId: string | null) {
  const { user, ready } = useAuth();
  const me = useMe();
  const { access, loading } = useAccess();

  const role: TeamRole | null = roleForTeam(access, teamId);

  return {
    ready: ready && !loading && !me.loading,
    user,
    teams: me.teams,
    memberships: access.teamMemberships,
    membership: access.teamMemberships.find((m) => m.team_id === teamId) ?? null,
    role,
    isCoach: isCoachRole(role),
    isHeadCoach: role === "head_coach",
    isPlayer: role === "player",
    isParent: role === "parent",
    playerId: playerIdForTeam(access, teamId),
    displayName: me.profile?.full_name ?? user?.email ?? "You",
    roleLabel: role ? TEAM_ROLE_LABEL[role] : "Member",
    loading: me.loading || loading,
  };
}
