import type { Assignment, AssignmentTarget } from "./locker";

export function personalPlans(plans: Assignment[], targets: AssignmentTarget[], userId: string | null, playerId: string | null) {
  return plans.map((plan) => ({
    plan,
    mine: targets.find((t) => t.assignment_id === plan.id && (Boolean(userId) && t.user_id === userId || Boolean(playerId) && t.player_id === playerId)),
  }));
}

export function pendingPlans(plans: Assignment[], targets: AssignmentTarget[], userId: string | null, playerId: string | null) {
  // Assignment visibility is authorized by the existing database policies;
  // status rows are progress, not an audience list for whole-team Plans.
  return personalPlans(plans, targets, userId, playerId)
    .filter(({ mine }) => mine?.status !== "completed")
    .sort((a, b) => (a.plan.due_at ?? "9999").localeCompare(b.plan.due_at ?? "9999") || b.plan.created_at.localeCompare(a.plan.created_at));
}