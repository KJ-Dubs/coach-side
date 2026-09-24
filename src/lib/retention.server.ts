/**
 * Server-only retention jobs: daily Play of the Day selection and the
 * behavior-aware onboarding nurture sequence. All writes use the admin client
 * and are idempotent (unique keys + dedupe keys), so running them repeatedly
 * from page loads or a scheduled call never double-sends.
 */
import { adminDb, dispatchNotification } from "./notify.server";
import { ACHIEVEMENTS } from "./achievements";

export function todayKey(d = new Date()): string {
  // CoachSide's day boundary is Pacific time.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

type PlayRow = { id: string; name: string; category: string; published_at: string | null };

export async function pickAutoPlay(day: string): Promise<string | null> {
  const db = await adminDb();
  const { data: plays } = await db
    .from("plays")
    .select("id, name, category, published_at")
    .eq("published_to_library", true);
  const list = (plays ?? []) as PlayRow[];
  if (!list.length) return null;

  const { data: frames } = await db.from("play_frames").select("play_id").in("play_id", list.map((p) => p.id));
  const withFrames = new Set(((frames ?? []) as { play_id: string }[]).map((f) => f.play_id));
  let pool = list.filter((p) => withFrames.has(p.id));
  if (!pool.length) pool = list;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: recent } = await db.from("play_of_the_day").select("day, play_id").gte("day", since).order("day", { ascending: false });
  const recentRows = (recent ?? []) as { day: string; play_id: string | null }[];
  const recentIds = new Set(recentRows.map((r) => r.play_id));
  const fresh = pool.filter((p) => !recentIds.has(p.id));
  if (fresh.length) pool = fresh;

  const lastCategory = list.find((p) => p.id === recentRows[0]?.play_id)?.category ?? null;
  const { data: hearts } = await db.from("play_hearts").select("play_id, created_at").in("play_id", pool.map((p) => p.id));
  const total = new Map<string, number>();
  const recentH = new Map<string, number>();
  const cut = Date.now() - 14 * 86_400_000;
  for (const h of (hearts ?? []) as { play_id: string; created_at: string }[]) {
    total.set(h.play_id, (total.get(h.play_id) ?? 0) + 1);
    if (new Date(h.created_at).getTime() > cut) recentH.set(h.play_id, (recentH.get(h.play_id) ?? 0) + 1);
  }
  const scored = pool.map((p) => {
    const ageDays = p.published_at ? (Date.now() - new Date(p.published_at).getTime()) / 86_400_000 : 365;
    const score =
      (recentH.get(p.id) ?? 0) * 3 +
      Math.log1p(total.get(p.id) ?? 0) * 2 +
      Math.max(0, 3 - ageDays / 10) +
      (p.category === lastCategory ? -2 : 0) +
      hash(day + p.id) * 4; // daily variety so the top play never sits forever
    return { id: p.id, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? null;
}

export type PotdResult = { day: string; playId: string | null; source: string; notified: boolean; recipients?: number };

/** Guarantees today's Play of the Day exists and notifies exactly once. */
export async function ensurePlayOfTheDay(): Promise<PotdResult> {
  const db = await adminDb();
  const day = todayKey();
  let { data: row } = await db.from("play_of_the_day").select("*").eq("day", day).maybeSingle();

  if (!row || !row.play_id) {
    const playId = await pickAutoPlay(day);
    if (!playId) return { day, playId: null, source: "none", notified: false };
    await db.from("play_of_the_day").upsert({ day, play_id: playId, source: "auto" }, { onConflict: "day", ignoreDuplicates: true });
    if (row && !row.play_id) await db.from("play_of_the_day").update({ play_id: playId }).eq("day", day).is("play_id", null);
    ({ data: row } = await db.from("play_of_the_day").select("*").eq("day", day).maybeSingle());
  }
  const playId = row?.play_id as string;

  const { data: feat } = await db.from("featured_play").select("play_id").eq("id", true).maybeSingle();
  if (feat?.play_id !== playId) {
    await db.from("featured_play").upsert({ id: true, play_id: playId, updated_at: new Date().toISOString() });
  }

  if (row?.notified_at) return { day, playId, source: row.source, notified: false };
  // Claim the send first so concurrent callers cannot both notify.
  const { data: claimed } = await db
    .from("play_of_the_day")
    .update({ notified_at: new Date().toISOString() })
    .eq("day", day)
    .is("notified_at", null)
    .select("day");
  if (!claimed?.length) return { day, playId, source: row.source, notified: false };

  const { data: play } = await db.from("plays").select("name").eq("id", playId).maybeSingle();
  const name = (play?.name as string) ?? "Today's play";
  const res = await dispatchNotification({
    audience: { kind: "all_coaches" },
    type: "play_of_the_day",
    title: "CoachSide Play of the Day",
    body: `${name} is today's featured play. Open it, run it, or add it to your Playbook.`,
    link: `/library/${playId}`,
    relatedType: "play",
    relatedId: playId,
    prefColumn: "play_of_the_day_notifications",
    dedupeKey: `potd:${day}:${playId}`,
  });
  return { day, playId, source: row.source, notified: true, recipients: res.recipients };
}

// ---------------- Onboarding nurture ----------------

type Nurture = { day: number; key: string; title: string; body: string; metric?: string; link: string };

export const NURTURE: Nurture[] = [
  { day: 0, key: "welcome", title: "Welcome to CoachSide", body: "Build your team and try your first play.", link: "/dashboard" },
  { day: 1, key: "first_play", title: "Create your first play", body: "Draw it once in Playmaker and animate it for your players.", metric: "plays_created", link: "/plays/new" },
  { day: 2, key: "roster", title: "Add your players", body: "Add players to your roster and invite them to the Locker Room.", metric: "max_roster", link: "/roster" },
  { day: 3, key: "library", title: "Save a Library play", body: "Save a CoachSide Library play to your Playbook.", metric: "library_saved", link: "/plays" },
  { day: 4, key: "calendar", title: "Connect your calendar", body: "So the team always knows what's next.", metric: "calendar_connected", link: "/settings" },
  { day: 5, key: "live_game", title: "Try Live Game", body: "Tap the court to track shots and build shot charts.", metric: "games", link: "/games/new" },
  { day: 7, key: "halfway", title: "Halfway through your Complete trial", body: "Here's something you haven't tried yet.", link: "/achievements" },
  { day: 9, key: "drill_practice", title: "Build a drill or a practice plan", body: "Plan a full practice in a couple of minutes.", metric: "practice_plans", link: "/practice" },
  { day: 11, key: "publish", title: "Publish or share a play", body: "Share one of your plays with your team or the Library.", metric: "plays_published", link: "/plays" },
  { day: 12, key: "two_days", title: "2 days left in your trial", body: "Keep the tools you use most.", link: "/membership" },
  { day: 13, key: "tomorrow", title: "Your Complete trial ends tomorrow", body: "Pick a membership to keep your favorite tools.", link: "/membership" },
  { day: 14, key: "ended", title: "Your trial ended", body: "Keep one module for $6 or everything for $15.", link: "/membership" },
];

function nextIncomplete(metrics: Record<string, number>) {
  return ACHIEVEMENTS.find((a) => (metrics[a.metric] ?? 0) < a.target);
}

export async function runNurtureForUser(userId: string, metrics: Record<string, number>) {
  const db = await adminDb();
  const { data: trials } = await db.from("team_trials").select("team_id, started_at").eq("created_by", userId).order("started_at").limit(1);
  const trial = (trials ?? [])[0] as { team_id: string; started_at: string } | undefined;
  if (!trial) return null;
  const elapsed = Math.floor((Date.now() - new Date(trial.started_at).getTime()) / 86_400_000);
  const due = [...NURTURE].reverse().find((m) => m.day <= elapsed);
  if (!due || elapsed - due.day > 1) return null; // don't dump stale messages
  const { data: already } = await db.from("nurture_deliveries").select("id").eq("user_id", userId).eq("day", due.day).maybeSingle();
  if (already) return null;
  const { error } = await db.from("nurture_deliveries").insert({ user_id: userId, team_id: trial.team_id, day: due.day, message_key: due.key });
  if (error) return null; // unique race: someone else sent it

  let { title, body, link } = due;
  const done = due.metric ? (metrics[due.metric] ?? 0) > 0 : due.key === "halfway";
  if (done) {
    const next = nextIncomplete(metrics);
    if (next) {
      if (due.key === "halfway") body = `Try this next: ${next.description}`;
      else { title = `Next up: ${next.name}`; body = next.description; }
      link = next.link;
    }
  }
  await dispatchNotification({
    audience: { kind: "users", userIds: [userId] },
    type: "onboarding",
    title, body, link,
    teamId: trial.team_id,
    prefColumn: "onboarding_tips",
    dedupeKey: `nurture:${userId}:${due.day}`,
  });
  return due.key;
}
