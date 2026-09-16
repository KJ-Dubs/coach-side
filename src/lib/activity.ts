/**
 * Lightweight, privacy-conscious product activity log.
 *
 * Records only: who, what kind of action, which team/item it relates to and
 * when. Never message bodies, never player personal details, never anything
 * resembling session replay or keystroke capture. Rows are readable only by
 * CoachSide owners on the My KPI page.
 */
import { supabase } from "@/integrations/supabase/client";

export type ActivityEventType =
  | "signed_in"
  | "library_play_added_to_playbook"
  | "play_exported_video"
  | "membership_changed";

export async function trackActivity(
  eventType: ActivityEventType,
  opts?: { teamId?: string | null; entityId?: string | null; metadata?: Record<string, string | number | boolean> },
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("product_activity_events" as never).insert({
      user_id: userId,
      event_type: eventType,
      team_id: opts?.teamId ?? null,
      entity_id: opts?.entityId ?? null,
      metadata: opts?.metadata ?? {},
    } as never);
  } catch {
    // Analytics must never interrupt a coach mid-task.
  }
}
