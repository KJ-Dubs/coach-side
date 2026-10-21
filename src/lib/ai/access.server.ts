/**
 * Server-side CoachSide Complete check for the AI Assistant. Reads the team's
 * live modules through the caller's own session (row security applies), so a
 * coach can never borrow another team's membership.
 */
import type { Db } from "@/lib/coachside/service";
import { hasAiAssistant } from "@/lib/aiAccess";

export async function billingEnforced(): Promise<boolean> {
  const { enforcementEnabled } = await import("@/lib/billing.server");
  return enforcementEnabled();
}

async function teamModules(db: Db, teamId: string): Promise<string[] | null> {
  const { data, error } = await db.rpc("my_team_entitlement", { _team: teamId });
  if (error || !data) return null;
  const modules = (data as { modules?: unknown }).modules;
  return Array.isArray(modules) ? modules.filter((m): m is string => typeof m === "string") : [];
}

/** True when this team may use the assistant right now. Fails closed. */
export async function teamHasAiAccess(db: Db, teamId: string | null, enforced: boolean): Promise<boolean> {
  if (!enforced) return true;
  if (!teamId) return false;
  const modules = await teamModules(db, teamId).catch(() => null);
  return modules ? hasAiAssistant(modules, true) : false;
}

/** Which of these coach teams may use the assistant. */
export async function aiEntitledTeamIds(db: Db, teamIds: string[], enforced: boolean): Promise<string[]> {
  if (!enforced) return [...teamIds];
  const checks = await Promise.all(
    teamIds.map(async (id) => ((await teamHasAiAccess(db, id, true)) ? id : null)),
  );
  return checks.filter((id): id is string => !!id);
}
