/**
 * CoachSide AI Assistant access rule. Pure and dependency-free so the AI
 * endpoint, the availability check and the UI all decide the same way.
 *
 * The assistant is a CoachSide Complete benefit only: it is never attached to
 * a single module. A team qualifies when its live modules (paid, complimentary
 * or an active full-Complete trial, as computed by the database) cover all
 * three modules. While billing enforcement is off nothing is locked.
 */
export const COMPLETE_MODULE_KEYS = ["playbook_plus", "gameday_plus", "team_hub_plus"] as const;

export function hasAiAssistant(modules: readonly string[] | null | undefined, enforced: boolean): boolean {
  if (!enforced) return true;
  const owned = new Set(modules ?? []);
  return COMPLETE_MODULE_KEYS.every((m) => owned.has(m));
}

export const AI_UPGRADE_TITLE = "CoachSide AI Assistant";
export const AI_UPGRADE_BODY =
  "Use the AI coaching assistant to help manage your team, roster, schedule, and games — plus get basketball coaching help — as part of CoachSide Complete.";
export const AI_UPGRADE_PRICE = "Included with CoachSide Complete · $15/month per team";
export const AI_COMPLETE_REQUIRED_MESSAGE =
  "The CoachSide AI Assistant is included with CoachSide Complete. Upgrade this team to use it.";
export const AI_SETUP_MESSAGE = "CoachSide AI is temporarily unavailable while setup is completed.";
