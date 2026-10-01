/**
 * Lightweight, privacy-conscious product activity log.
 *
 * Records only: who, what kind of action, which team/item it relates to and
 * when. Never message bodies, never player personal details, never anything
 * resembling session replay or keystroke capture. Rows are readable only by
 * CoachSide owners on the My KPI page. Several event types also feed
 * achievements (see METRIC_SOURCES in achievements.ts).
 */
import { supabase } from "@/integrations/supabase/client";

export type ActivityEventType =
  | "signed_in"
  | "library_play_added_to_playbook"
  | "play_exported_video"
  | "play_shared"
  | "parent_link_shared"
  | "stats_exported"
  | "board_used_in_game"
  | "pwa_installed"
  | "potd_viewed"
  | "membership_changed";

/** Fired after an achievement-relevant action so Progress refreshes promptly. */
export const PROGRESS_EVENT = "coachside:progress-changed";
export function notifyProgressChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROGRESS_EVENT));
}

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
    notifyProgressChanged();
  } catch {
    // Analytics must never interrupt a coach mid-task.
  }
}

/**
 * Records an event at most once per device for a given dedupe key
 * (e.g. once per play per day), to avoid noisy duplicates.
 */
export function trackActivityOnce(
  eventType: ActivityEventType,
  dedupeKey: string,
  opts?: Parameters<typeof trackActivity>[1],
): void {
  const k = `coachside.act.${eventType}.${dedupeKey}`;
  try {
    if (localStorage.getItem(k)) return;
  } catch {
    // fall through and record
  }
  // Mark as done only after a row was actually recorded — a signed-out
  // visitor must not permanently consume the dedupe key.
  void (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      await trackActivity(eventType, opts);
      try {
        localStorage.setItem(k, "1");
      } catch {
        /* private mode */
      }
    } catch {
      /* never block */
    }
  })();
}
