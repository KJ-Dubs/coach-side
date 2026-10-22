/**
 * Pure rules for player join status, shared by the invite page and the
 * coach access panel so both always agree. Database functions enforce the
 * same rules server-side (accept_team_invite); these only decide what to show.
 */

export type MembershipLite = {
  user_id: string;
  role: string;
  player_id: string | null;
  active: boolean;
};

export type JoinState =
  | { kind: "new" }
  | { kind: "joined"; playerId: string }
  | { kind: "needs_roster_name" }
  | { kind: "coach" }
  | { kind: "parent" }
  | { kind: "removed" };

/** What the invite page should do for the signed-in account's membership on this team. */
export function joinStateFor(membership: MembershipLite | null): JoinState {
  if (!membership) return { kind: "new" };
  if (!membership.active) return { kind: "removed" };
  if (membership.role === "head_coach" || membership.role === "assistant_coach") return { kind: "coach" };
  if (membership.role === "parent") return { kind: "parent" };
  if (membership.player_id) return { kind: "joined", playerId: membership.player_id };
  return { kind: "needs_roster_name" };
}

export type RosterAccessStatus = "joined" | "not_joined" | "removed";

/**
 * Per roster player: joined (an active account is linked), removed (only a
 * coach-removed link exists) or not joined yet. Never inferred from sign-ins.
 */
export function rosterAccessStatus(playerId: string, memberships: MembershipLite[]): RosterAccessStatus {
  const linked = memberships.filter((m) => m.player_id === playerId && m.role === "player");
  if (linked.some((m) => m.active)) return "joined";
  if (linked.length) return "removed";
  return "not_joined";
}

/** Active player accounts on the team that never picked a roster name. */
export function unlinkedPlayerAccounts(memberships: MembershipLite[]): MembershipLite[] {
  return memberships.filter((m) => m.role === "player" && m.active && !m.player_id);
}

/**
 * Sign-in failures fall into two groups. Only a definitive rejection
 * (revoked/invalid refresh token) should send someone to the sign-in page;
 * network or server trouble keeps the stored session.
 */
export function isDefinitiveAuthFailure(error: { status?: number | undefined; name?: string | undefined; message?: string | undefined } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return false;
  const status = error.status ?? 0;
  if (status === 0 || status >= 500) return false;
  return status === 400 || status === 401 || status === 403;
}
