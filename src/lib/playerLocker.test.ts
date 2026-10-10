import { describe, expect, it } from "vitest";
import { pendingPlans, personalPlans } from "./playerLocker";
import { isPlayerAllowedPath } from "./access";
import type { Assignment, AssignmentTarget } from "./locker";

const plan = (id: string, due_at: string | null = null): Assignment => ({ id, due_at, team_id: "team", created_by: "coach", assignment_type: "task", title: id, instructions: null, linked_type: null, linked_id: null, created_at: "2026-10-10", attachments: [] });
const target = (assignment_id: string, player_id: string, status: AssignmentTarget["status"] = "not_viewed"): AssignmentTarget => ({ id: `${assignment_id}-${player_id}`, assignment_id, player_id, user_id: null, status, viewed_at: null, completed_at: status === "completed" ? "2026-10-10" : null });
describe("player Locker Room", () => {
  it("keeps whole-team requests and hides another player's selected request", () => {
    expect(personalPlans([plan("whole"), plan("mine"), plan("other")], [target("mine", "p1"), target("other", "p2")], "u1", "p1").map((x) => x.plan.id)).toEqual(["whole", "mine"]);
  });
  it("sorts due work first and excludes personal completions", () => {
    expect(pendingPlans([plan("later"), plan("due", "2026-10-11"), plan("done")], [target("done", "p1", "completed")], "u1", "p1").map((x) => x.plan.id)).toEqual(["due", "later"]);
  });
  it("does not match null identities to another player's status", () => {
    expect(personalPlans([plan("other")], [target("other", "p2")], null, null)).toEqual([]);
  });
  it("allows read-only play presentation but not coach editors or indexes", () => {
    expect(isPlayerAllowedPath("/plays/id/view")).toBe(true);
    for (const path of ["/plays/id", "/plays/new", "/plays", "/games/new", "/settings", "/kpi", "/tools"]) expect(isPlayerAllowedPath(path)).toBe(false);
  });
});