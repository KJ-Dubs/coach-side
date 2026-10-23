/**
 * Owner KPI activation funnel. Pure so the rules are testable.
 *
 * Every step counts coaches in the signup group who reached it (independent
 * counts, so a coach who installed before install tracking existed still
 * counts as installed). Only privacy-safe event types are read — never content.
 */
export type FunnelEventRow = { user_id: string; event_type: string; created_at: string };

export const FUNNEL_STEPS = [
  { key: "signup", label: "Signups" },
  { key: "started", label: "Started onboarding" },
  { key: "saw_install", label: "Saw install" },
  { key: "installed", label: "Installed" },
  { key: "notifications", label: "Notifications enabled" },
  { key: "first_action", label: "First meaningful action" },
  { key: "returned", label: "Returned second session" },
] as const;
export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]["key"];

/** Event types the funnel reads (the server query uses this list). */
export const FUNNEL_EVENT_TYPES = [
  "signup_completed",
  "onboarding_started",
  "onboarding_interest_selected",
  "onboarding_interests_saved",
  "install_prompt_shown",
  "install_clicked",
  "install_dismissed",
  "pwa_installed",
  "notification_prompt_shown",
  "notifications_enabled",
  "onboarding_push_enabled",
  "first_play_viewed",
  "first_play_created",
  "first_team_created",
  "library_play_added_to_playbook",
  "onboarding_completed",
  "session_day",
  "signed_in",
] as const;

const STARTED = new Set(["onboarding_started", "onboarding_interest_selected", "onboarding_interests_saved"]);
const NOTIFY = new Set(["notifications_enabled", "onboarding_push_enabled"]);
const FIRST_ACTION = new Set([
  "first_play_viewed",
  "first_play_created",
  "first_team_created",
  "library_play_added_to_playbook",
]);

export type FunnelStep = { key: FunnelStepKey; label: string; count: number; pctOfSignups: number };

export function computeActivationFunnel(input: {
  cohort: string[];
  events: FunnelEventRow[];
  /** Coaches with a saved onboarding step past the welcome screen. */
  onboardingStarted?: Set<string>;
  /** Coaches with an active push subscription on any device. */
  pushOn?: Set<string>;
  /** Coaches who created at least one play (from the plays table). */
  playCreators?: Set<string>;
}): FunnelStep[] {
  const cohort = new Set(input.cohort);
  const reached: Record<FunnelStepKey, Set<string>> = {
    signup: new Set(cohort),
    started: new Set(),
    saw_install: new Set(),
    installed: new Set(),
    notifications: new Set(),
    first_action: new Set(),
    returned: new Set(),
  };
  const days = new Map<string, Set<string>>();

  for (const e of input.events) {
    if (!cohort.has(e.user_id)) continue;
    const t = e.event_type;
    if (STARTED.has(t)) reached.started.add(e.user_id);
    if (t === "install_prompt_shown") reached.saw_install.add(e.user_id);
    if (t === "pwa_installed") reached.installed.add(e.user_id);
    if (NOTIFY.has(t)) reached.notifications.add(e.user_id);
    if (FIRST_ACTION.has(t)) reached.first_action.add(e.user_id);
    const d = days.get(e.user_id) ?? new Set<string>();
    d.add(String(e.created_at).slice(0, 10));
    days.set(e.user_id, d);
  }
  for (const id of input.onboardingStarted ?? []) if (cohort.has(id)) reached.started.add(id);
  for (const id of input.pushOn ?? []) if (cohort.has(id)) reached.notifications.add(id);
  for (const id of input.playCreators ?? []) if (cohort.has(id)) reached.first_action.add(id);
  for (const [id, d] of days) if (d.size >= 2) reached.returned.add(id);

  const total = cohort.size;
  return FUNNEL_STEPS.map((s) => {
    const count = reached[s.key].size;
    return { key: s.key, label: s.label, count, pctOfSignups: total ? Math.round((count / total) * 100) : 0 };
  });
}
