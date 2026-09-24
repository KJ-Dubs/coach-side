/** Funnel event helpers. Signed-in events go to the activity log; signed-out views are anonymous counts. */
import { supabase } from "@/integrations/supabase/client";

export const FUNNEL_EVENTS = [
  "landing_view",
  "signup_started",
  "signup_completed",
  "team_created",
  "activation_completed",
  "trial_started",
  "pricing_viewed",
  "checkout_started",
  "checkout_completed",
  "paid_active",
  "upgrade",
  "cancel",
  "trial_expired",
  "feature_paywall_viewed",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export async function trackAnon(event: "landing_view" | "signup_started") {
  try {
    const key = `coachside.funnel.${event}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    await supabase.from("anon_funnel_events" as never).insert({ event_type: event } as never);
  } catch {
    /* never block */
  }
}

/** Generic signed-in product event (achievements + funnel). */
export async function trackEvent(
  eventType: string,
  opts?: { teamId?: string | null; entityId?: string | null; once?: boolean },
) {
  try {
    if (opts?.once) {
      const k = `coachside.evt.${eventType}.${opts.teamId ?? ""}.${opts.entityId ?? ""}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("product_activity_events" as never).insert({
      user_id: data.user.id,
      event_type: eventType,
      team_id: opts?.teamId ?? null,
      entity_id: opts?.entityId ?? null,
      metadata: {},
    } as never);
  } catch {
    /* analytics never interrupts */
  }
}
