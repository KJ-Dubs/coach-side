import { describe, expect, it } from "vitest";
import {
  COACHSIDE_PERMISSIONS,
  MCP_TOOL_NAMES,
  TOOL_PERMISSION,
  initialPermissions,
  sanitizeGrant,
} from "./permissions";
import { oauthReturnPath } from "../oauth-return-path";
import { currentSeasonLabel, parseEventDateTime } from "./time";

describe("connector permissions", () => {
  it("exposes exactly the nine phase-1 tools", () => {
    expect(MCP_TOOL_NAMES.sort()).toEqual(
      [
        "add_player",
        "add_players_bulk",
        "create_schedule_event",
        "create_team",
        "get_roster",
        "list_schedule",
        "list_teams",
        "update_player",
        "update_schedule_event",
      ].sort(),
    );
  });
  it("write tools require write permissions and reads require read", () => {
    expect(TOOL_PERMISSION.list_teams).toBe("coachside:teams:read");
    expect(TOOL_PERMISSION.create_team).toBe("coachside:teams:write");
    expect(TOOL_PERMISSION.add_players_bulk).toBe("coachside:roster:write");
    expect(TOOL_PERMISSION.update_schedule_event).toBe("coachside:schedule:write");
    expect(TOOL_PERMISSION.list_schedule).toBe("coachside:schedule:read");
  });
  it("identity-only requests let the coach choose from all permissions", () => {
    const r = initialPermissions("openid email profile offline_access");
    expect(r.locked).toBe(false);
    expect(r.selected).toEqual([...COACHSIDE_PERMISSIONS]);
  });
  it("explicit CoachSide scopes limit what can be granted", () => {
    const r = initialPermissions("openid coachside:roster:read coachside:schedule:read");
    expect(r.locked).toBe(true);
    expect(r.allowed).toEqual(["coachside:roster:read", "coachside:schedule:read"]);
    expect(sanitizeGrant(["coachside:roster:read", "coachside:roster:write", "junk"], r.allowed)).toEqual([
      "coachside:roster:read",
    ]);
  });
});

describe("sign-in return path", () => {
  it("keeps the consent URL with its authorization id", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc")).toBe(
      "/.lovable/oauth/consent?authorization_id=abc",
    );
  });
  it("rejects external and malformed targets", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example/x", "/x\u0000y", 42]) {
      expect(oauthReturnPath(bad)).toBe("/");
    }
  });
});

describe("schedule times", () => {
  it("reads local wall time in the team timezone across DST", () => {
    expect(parseEventDateTime("2026-10-22T16:30", "America/Los_Angeles")).toBe("2026-10-22T23:30:00.000Z");
    expect(parseEventDateTime("2026-12-04T17:00", "America/Los_Angeles")).toBe("2026-12-05T01:00:00.000Z");
    expect(parseEventDateTime("2026-10-22T16:30:00-04:00", "America/Los_Angeles")).toBe("2026-10-22T20:30:00.000Z");
    expect(parseEventDateTime("Thursday 4:30", "America/Los_Angeles")).toBeNull();
  });
  it("labels the season", () => {
    expect(currentSeasonLabel(new Date("2026-10-21T00:00:00Z"))).toBe("2026-27");
    expect(currentSeasonLabel(new Date("2027-03-01T00:00:00Z"))).toBe("2026-27");
  });
});
