import type { Assignment, AssignmentTarget } from "./locker";

export function personalPlans(plans: Assignment[], targets: AssignmentTarget[], userId: string | null, playerId: string | null) {
  return plans.flatMap((plan) => {
    const list = targets.filter((t) => t.assignment_id === plan.id);
    const mine = list.find((t) => Boolean(userId) && t.user_id === userId || Boolean(playerId) && t.player_id === playerId);
    // Preserve the existing selected-player/whole-team visibility rule.
    return !list.length || mine ? [{ plan, mine }] : [];
  });
}

export function pendingPlans(plans: Assignment[], targets: AssignmentTarget[], userId: string | null, playerId: string | null) {
  // Never include another player's selected-player request.
  return personalPlans(plans, targets, userId, playerId)
    .filter(({ mine }) => mine?.status !== "completed")
    .sort((a, b) => (a.plan.due_at ?? "9999").localeCompare(b.plan.due_at ?? "9999") || b.plan.created_at.localeCompare(a.plan.created_at));
}