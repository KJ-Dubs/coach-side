import { describe, expect, it } from "vitest";
import { isDefinitiveAuthFailure, joinStateFor, rosterAccessStatus, unlinkedPlayerAccounts, type MembershipLite } from "./playerAccess";

const m = (p: Partial<MembershipLite>): MembershipLite => ({ user_id: "u1", role: "player", player_id: null, active: true, ...p });

describe("joinStateFor", () => {
  it("returning linked player continues without reclaiming", () => {
    expect(joinStateFor(m({ player_id: "p1" }))).toEqual({ kind: "joined", playerId: "p1" });
  });
  it("active player with no roster name must repair the link", () => {
    expect(joinStateFor(m({ player_id: null }))).toEqual({ kind: "needs_roster_name" });
  });
  it("removed player is not resurrected", () => {
    expect(joinStateFor(m({ player_id: "p1", active: false }))).toEqual({ kind: "removed" });
  });
  it("coach opening a player link stays a coach", () => {
    expect(joinStateFor(m({ role: "assistant_coach" }))).toEqual({ kind: "coach" });
  });
  it("no membership is a new join", () => {
    expect(joinStateFor(null)).toEqual({ kind: "new" });
  });
});

describe("rosterAccessStatus", () => {
  it("joined only with an active linked account", () => {
    expect(rosterAccessStatus("p1", [m({ player_id: "p1" })])).toBe("joined");
  });
  it("removed when the only link is inactive", () => {
    expect(rosterAccessStatus("p1", [m({ player_id: "p1", active: false })])).toBe("removed");
  });
  it("not joined when nobody is linked", () => {
    expect(rosterAccessStatus("p1", [m({ player_id: "p2" })])).toBe("not_joined");
  });
  it("lists active player accounts without a roster name", () => {
    expect(unlinkedPlayerAccounts([m({}), m({ user_id: "u2", player_id: "p1" }), m({ user_id: "u3", active: false })]).map((x) => x.user_id)).toEqual(["u1"]);
  });
});

describe("isDefinitiveAuthFailure", () => {
  it("network failures keep the session", () => {
    expect(isDefinitiveAuthFailure({ name: "AuthRetryableFetchError", status: 0 })).toBe(false);
    expect(isDefinitiveAuthFailure({ status: 503 })).toBe(false);
  });
  it("revoked or invalid tokens are definitive", () => {
    expect(isDefinitiveAuthFailure({ status: 400, message: "Invalid Refresh Token" })).toBe(true);
    expect(isDefinitiveAuthFailure({ status: 401 })).toBe(true);
  });
});
