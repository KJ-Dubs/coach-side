/**
 * First-sign-in coach onboarding state. Server-backed (coach_onboarding row,
 * own-row RLS) so it resumes across devices and never re-shows once done.
 * No row = brand-new account (existing active accounts were backfilled as completed).
 */
import { supabase } from "@/integrations/supabase/client";

export type Interest = "plays" | "coordinate" | "stats" | "practice";
export const INTERESTS: { key: Interest; title: string; body: string }[] = [
  { key: "plays", title: "Build & find plays", body: "Create plays and save plays from the CoachSide Library." },
  { key: "coordinate", title: "Coordinate my team", body: "Schedule, communicate, assign Plans, and share the Playbook." },
  { key: "stats", title: "Track games & stats", body: "Live scoring, player stats, shot charts, and game reports." },
  { key: "practice", title: "Plan practices", body: "Build drills and organize practice plans." },
];

export type OnboardingRow = {
  user_id: string;
  status: "in_progress" | "completed" | "skipped";
  step: number;
  interests: Interest[];
  team_id: string | null;
  players_added: number;
  colors_set: boolean;
  events_sent: string[];
};

export type OnboardingEvent =
  | "onboarding_started"
  | "onboarding_interests_saved"
  | "onboarding_team_created"
  | "onboarding_branding_completed"
  | "onboarding_roster_added"
  | "onboarding_first_action_selected"
  | "onboarding_push_prompted"
  | "onboarding_push_enabled"
  | "onboarding_social_opened"
  | "onboarding_completed"
  | "onboarding_skipped";

const table = () => supabase.from("coach_onboarding" as never);

export async function fetchOnboarding(): Promise<OnboardingRow | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await table().select("*").eq("user_id", u.user.id).maybeSingle();
  if (error) throw error;
  return (data as OnboardingRow | null) ?? null;
}

export async function saveOnboarding(patch: Partial<Omit<OnboardingRow, "user_id">>): Promise<OnboardingRow> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await table()
    .upsert({ user_id: u.user.id, ...patch } as never, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as OnboardingRow;
}

/** Records a funnel event once per account (dedupe kept on the onboarding row). */
export async function trackOnboardingOnce(
  row: OnboardingRow | null,
  event: OnboardingEvent,
  metadata: Record<string, string | number | boolean> = {},
): Promise<OnboardingRow | null> {
  if (row?.events_sent.includes(event)) return row;
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return row;
    await supabase.from("product_activity_events" as never).insert({
      user_id: u.user.id, event_type: event, team_id: row?.team_id ?? null, metadata,
    } as never);
    return await saveOnboarding({ events_sent: [...(row?.events_sent ?? []), event] });
  } catch {
    return row;
  }
}

/** Parses "4 John Smith", "#12 Mike Jones", "12, Mike Jones", "12\tMike\tJones". */
export function parseRoster(text: string): { jersey: string; first: string; last: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^#?\s*(\d{1,3})\s*[,.\-\t ]\s*(.+)$/);
      const jersey = m ? m[1] : "";
      const rest = (m ? m[2] : l).replace(/[,\t]+/g, " ").trim().split(/\s+/);
      return { jersey, first: rest[0] ?? "", last: rest.slice(1).join(" ") };
    })
    .filter((p) => p.first);
}

export const PRACTICE_TEAM = {
  name: "East High Varsity (Practice)",
  players: [
    ["1", "Sample Guard"], ["3", "Sample Wing"], ["5", "Sample Point"], ["11", "Sample Shooter"],
    ["20", "Sample Forward"], ["24", "Sample Slasher"], ["32", "Sample Center"], ["33", "Sample Post"],
  ] as [string, string][],
};

export type NextAction = { key: string; title: string; body: string; cta: string; link: string };

/** One recommended action from interests + real progress metrics. */
export function pickNextAction(m: Record<string, number>, interests: Interest[], opts: { pushOn?: boolean; installed?: boolean } = {}): NextAction | null {
  const v = (k: string) => m[k] ?? 0;
  const wants = (i: Interest) => interests.length === 0 || interests.includes(i);
  if (v("teams") < 1) return { key: "team", title: "Create your team", body: "Teams unlock rosters, Live Game stats and the Locker Room.", cta: "Create Team", link: "/roster" };
  if (v("max_roster") < 5) return { key: "roster", title: "Add your players", body: "A roster of five or more gets you ready for Live Game.", cta: "Add Players", link: "/roster" };
  if (wants("plays") && v("plays_created") + v("library_saved") < 1) return { key: "play", title: "Add your first play", body: "Save a proven set from the Library or draw your own.", cta: "Browse the Library", link: "/library" };
  if (wants("coordinate") && v("qr_joins") < 1) return { key: "qr", title: "Invite your players", body: "Players scan your team QR to join the Locker Room.", cta: "Generate Player QR", link: "/locker" };
  if (wants("stats") && v("games") < 1) return { key: "game", title: "Try Live Game", body: "Tap the court, pick a player, pick a stat.", cta: "Start Live Game", link: "/games/new" };
  if (wants("practice") && v("drills_created") + v("practice_plans") < 1) return { key: "practice", title: "Build your first practice", body: "Combine drills and plays into a timed plan.", cta: "Plan a practice", link: "/practice" };
  if (!opts.installed && v("pwa_installed") < 1) return { key: "install", title: "Install CoachSide", body: "Open CoachSide from your Home Screen for faster courtside access.", cta: "How to install", link: "/help" };
  if (!opts.pushOn && v("push_enabled") < 1) return { key: "push", title: "Enable notifications", body: "Get team messages, schedule changes and Play of the Day.", cta: "Enable notifications", link: "/profile" };
  return null;
}

/** First-win recommendation (primary + alternatives) for the wizard. */
export function firstWinOptions(interests: Interest[]): NextAction[] {
  const all: Record<Interest, NextAction> = {
    plays: { key: "plays", title: "Add your first play", body: "Save a proven set from the CoachSide Library.", cta: "Browse CoachSide Library", link: "/library" },
    stats: { key: "stats", title: "Try Live Game", body: "Run a quick game with your team to see stats and shot charts.", cta: "Try Live Game", link: "/games/new" },
    coordinate: { key: "coordinate", title: "Open the Locker Room", body: "Generate your Player QR so players can join.", cta: "Open Locker Room", link: "/locker" },
    practice: { key: "practice", title: "Create a drill", body: "Animate a drill, then drop it into a practice plan.", cta: "Browse Drills", link: "/drills" },
  };
  const order: Interest[] = ["plays", "stats", "coordinate", "practice"];
  const picked = order.filter((i) => interests.includes(i));
  return (picked.length ? picked : order).map((i) => all[i]);
}
