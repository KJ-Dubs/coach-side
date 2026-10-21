/**
 * CoachSide connector permissions. Browser-safe: shared by the consent
 * screen, Settings, Launch QA and the MCP server.
 *
 * The managed sign-in server only issues identity scopes (openid, email,
 * profile, offline_access), so the coach picks these CoachSide permissions on
 * the consent screen and every tool call re-checks them server-side.
 */
export const COACHSIDE_PERMISSIONS = [
  "coachside:teams:read",
  "coachside:teams:write",
  "coachside:roster:read",
  "coachside:roster:write",
  "coachside:schedule:read",
  "coachside:schedule:write",
] as const;

export type CoachSidePermission = (typeof COACHSIDE_PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<CoachSidePermission, string> = {
  "coachside:teams:read": "View your teams",
  "coachside:teams:write": "Add/edit teams",
  "coachside:roster:read": "View your roster",
  "coachside:roster:write": "Add/edit players",
  "coachside:schedule:read": "View your schedule",
  "coachside:schedule:write": "Add/edit calendar events",
};

/** Consent screen rows: one area per row, view + edit toggles. */
export const PERMISSION_GROUPS: { area: string; read: CoachSidePermission; write: CoachSidePermission }[] = [
  { area: "Teams", read: "coachside:teams:read", write: "coachside:teams:write" },
  { area: "Roster", read: "coachside:roster:read", write: "coachside:roster:write" },
  { area: "Schedule", read: "coachside:schedule:read", write: "coachside:schedule:write" },
];

/** Which permission each MCP tool requires. The single source of truth. */
export const TOOL_PERMISSION = {
  list_teams: "coachside:teams:read",
  create_team: "coachside:teams:write",
  get_roster: "coachside:roster:read",
  add_player: "coachside:roster:write",
  add_players_bulk: "coachside:roster:write",
  update_player: "coachside:roster:write",
  list_schedule: "coachside:schedule:read",
  create_schedule_event: "coachside:schedule:write",
  update_schedule_event: "coachside:schedule:write",
} as const satisfies Record<string, CoachSidePermission>;

export type McpToolName = keyof typeof TOOL_PERMISSION;
export const MCP_TOOL_NAMES = Object.keys(TOOL_PERMISSION) as McpToolName[];

/** Public connector address shown to coaches. */
export const CANONICAL_MCP_URL = "https://coachside.live/mcp";

export function isCoachSidePermission(value: string): value is CoachSidePermission {
  return (COACHSIDE_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Decide which permissions the consent screen starts with.
 * If the client explicitly asked for CoachSide permissions, only those may be
 * granted (`locked`). Otherwise the client asked only for identity scopes and
 * the coach chooses, starting from everything checked.
 */
export function initialPermissions(scope: string | null | undefined): {
  locked: boolean;
  allowed: CoachSidePermission[];
  selected: CoachSidePermission[];
} {
  const requested = (scope ?? "").split(/\s+/).filter(isCoachSidePermission);
  if (requested.length > 0) {
    const unique = COACHSIDE_PERMISSIONS.filter((p) => requested.includes(p));
    return { locked: true, allowed: unique, selected: unique };
  }
  const all = [...COACHSIDE_PERMISSIONS];
  return { locked: false, allowed: all, selected: all };
}

/** Only permissions that were allowed for this request can be granted. */
export function sanitizeGrant(
  selected: readonly string[],
  allowed: readonly CoachSidePermission[],
): CoachSidePermission[] {
  return COACHSIDE_PERMISSIONS.filter((p) => selected.includes(p) && allowed.includes(p));
}

/** Identity scopes shown in plain language on the consent screen. */
export function identityScopeLabels(scope: string | null | undefined): string[] {
  const labels: string[] = [];
  for (const s of (scope ?? "").split(/\s+/).filter(Boolean)) {
    if (s === "openid") continue;
    if (s === "email") labels.push("Share your email address");
    else if (s === "profile") labels.push("Share your basic profile");
    else if (s === "offline_access") labels.push("Stay connected without signing in again");
    else if (s === "phone") labels.push("Share your phone number");
    else if (!isCoachSidePermission(s)) labels.push(`Additional permission requested: ${s}`);
  }
  return labels;
}
