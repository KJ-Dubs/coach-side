import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import type { TeamRole } from "./locker";

/**
 * Who the signed-in person is, straight from the database.
 * Nothing here ever comes from browser storage or a previous session:
 * the server decides which teams someone coaches and which they play for.
 */
export type TeamMembershipRow = { team_id: string; role: TeamRole; player_id: string | null };
export type OrgMembershipRow = { org_id: string; role: "head_coach" | "assistant_coach" };

export type Access = {
  userId: string | null;
  orgMemberships: OrgMembershipRow[];
  teamMemberships: TeamMembershipRow[];
  coachTeamIds: string[];
  playerTeamIds: string[];
  /** Coach anywhere (team staff role or a program membership). */
  isCoach: boolean;
  /** Player somewhere and coach nowhere — Locker Room only. */
  isPlayerOnly: boolean;
  playerId: string | null;
};

export const EMPTY_ACCESS: Access = {
  userId: null,
  orgMemberships: [],
  teamMemberships: [],
  coachTeamIds: [],
  playerTeamIds: [],
  isCoach: false,
  isPlayerOnly: false,
  playerId: null,
};

function shape(raw: unknown): Access {
  const r = (raw ?? {}) as Record<string, unknown>;
  const orgMemberships = (r["org_memberships"] ?? []) as OrgMembershipRow[];
  const teamMemberships = (r["team_memberships"] ?? []) as TeamMembershipRow[];
  const coachTeamIds = ((r["coach_team_ids"] ?? []) as string[]).filter(Boolean);
  const playerTeamIds = ((r["player_team_ids"] ?? []) as string[]).filter(Boolean);
  const isCoach = coachTeamIds.length > 0 || orgMemberships.length > 0;
  const playerRow = teamMemberships.find((m) => m.role === "player" && m.player_id);
  return {
    userId: (r["user_id"] as string) ?? null,
    orgMemberships,
    teamMemberships,
    coachTeamIds,
    playerTeamIds,
    isCoach,
    isPlayerOnly: !isCoach && playerTeamIds.length > 0,
    playerId: playerRow?.player_id ?? null,
  };
}

export async function getCurrentUserAccess(): Promise<Access> {
  const { data, error } = await supabase.rpc("my_access");
  if (error) throw error;
  return shape(data);
}

export function useAccess() {
  const { user, ready } = useAuth();
  const q = useQuery({
    queryKey: ["my-access", user?.id],
    queryFn: getCurrentUserAccess,
    enabled: !!user,
    staleTime: 60_000,
  });
  return {
    access: q.data ?? EMPTY_ACCESS,
    ready: ready && (!user || !q.isLoading),
    loading: q.isLoading,
  };
}

/** Permissions are per team, so a coach is never demoted globally. */
export function roleForTeam(access: Access, teamId: string | null): TeamRole | null {
  if (!teamId) return null;
  if (access.coachTeamIds.includes(teamId)) {
    const m = access.teamMemberships.find((x) => x.team_id === teamId);
    return m && m.role === "assistant_coach" ? "assistant_coach" : "head_coach";
  }
  return access.teamMemberships.find((x) => x.team_id === teamId)?.role ?? null;
}

export function playerIdForTeam(access: Access, teamId: string | null) {
  if (!teamId) return null;
  return access.teamMemberships.find((x) => x.team_id === teamId)?.player_id ?? null;
}

/** The only pages a player-only account may open. */
export const PLAYER_ROUTES = ["/lockerroom", "/profile"];

export function isPlayerAllowedPath(pathname: string) {
  return PLAYER_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
