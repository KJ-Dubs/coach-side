/**
 * Owner-only KPI data.
 *
 * Every function here is signed-in only AND checks the existing CoachSide
 * owner list (public.is_app_admin, backed by public.app_admins) with the
 * caller's own identity before any query runs. Only after that check passes
 * do we load the privileged client, so a normal coach calling these endpoints
 * directly gets a refusal and no data at all.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_MODULES, planTier, priceFor, type ModuleKey } from "./entitlements";

export const RANGES = ["today", "7d", "30d", "all"] as const;
export type RangeKey = (typeof RANGES)[number];

const rangeSchema = z.object({ range: z.enum(RANGES) });

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};

function sinceFor(range: RangeKey): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

type Rpc = { rpc: (fn: "is_app_admin") => PromiseLike<{ data: unknown; error: unknown }> };

async function assertOwner(supabase: unknown) {
  const { data, error } = await (supabase as Rpc).rpc("is_app_admin");
  if (error || data !== true) throw new Error("CoachSide owners only.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (t: string) => any;
  };
}

function inRange(iso: string | null | undefined, since: string | null): boolean {
  if (!iso) return false;
  if (!since) return true;
  return iso >= since;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Buckets a list of ISO timestamps into the last N days, oldest first. */
function series(times: string[], days: number): { day: string; value: number }[] {
  const out: { day: string; value: number }[] = [];
  const counts = new Map<string, number>();
  for (const t of times) counts.set(dayKey(t), (counts.get(dayKey(t)) ?? 0) + 1);
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, value: counts.get(day) ?? 0 });
  }
  return out;
}

export type KpiTotals = {
  coachAccounts: number;
  newCoaches: number;
  activeCoaches: number;
  teams: number;
  teamsInPeriod: number;
  plays: number;
  playsInPeriod: number;
  publishedPlays: number;
  gamesStarted: number;
  gamesCompleted: number;
  paidTeams: number;
  complimentaryTeams: number;
  mrr: number;
  billingLive: boolean;
};

export type MembershipSnapshot = {
  tiers: { label: string; teams: number; monthly: number }[];
  statuses: { label: string; teams: number }[];
  complimentary: number;
  activePaidTeams: number;
  mrr: number;
  billingLive: boolean;
};

export type ActivityRow = {
  at: string;
  type: string;
  who: string;
  detail: string;
};

export type CoachRow = {
  userId: string;
  name: string;
  email: string;
  signedUp: string;
  lastActivity: string | null;
  teams: number;
  plays: number;
  gamesStarted: number;
  gamesCompleted: number;
  tier: string;
  status: "New" | "Active recently" | "Inactive";
};

export type ContentKpis = {
  publishedTotal: number;
  createdInPeriod: number;
  heartsInPeriod: number;
  follows: number;
  playOfTheDay: string | null;
  topPlays: { name: string; hearts: number; author: string }[];
  topCreators: { name: string; hearts: number; followers: number }[];
};

export type GameKpis = {
  started: number;
  completed: number;
  uniqueTeams: number;
  avgPerActiveTeam: number;
  statEvents: number;
};

export type Trends = {
  signups: { day: string; value: number }[];
  plays: { day: string; value: number }[];
  games: { day: string; value: number }[];
  activeCoaches: { day: string; value: number }[];
};

export type KpiReport = {
  range: RangeKey;
  generatedAt: string;
  totals: KpiTotals;
  membership: MembershipSnapshot;
  activity: ActivityRow[];
  coaches: CoachRow[];
  content: ContentKpis;
  games: GameKpis;
  trends: Trends;
};

/** True only for the owner account(s). Used to show the owner-only nav link. */
export const amIAppAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await (context.supabase as unknown as Rpc).rpc("is_app_admin");
    return data === true;
  });

export const getKpiReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { range: RangeKey }) => rangeSchema.parse(d))
  .handler(async ({ data, context }): Promise<KpiReport> => {
    await assertOwner(context.supabase);
    const db = await admin();
    const since = sinceFor(data.range);

    const [
      profilesR,
      teamMembersR,
      orgMembersR,
      teamsR,
      playsR,
      gamesR,
      heartsR,
      followsR,
      billingR,
      compR,
      playersR,
      calendarR,
      redemptionsR,
      featuredR,
      activityR,
    ] = await Promise.all([
      db.from("profiles").select("id, email, full_name, public_display_name, username, created_at"),
      db.from("team_members").select("user_id, team_id, role, created_at"),
      db.from("org_members").select("user_id, org_id, created_at"),
      db.from("teams").select("id, name, created_at, org_id"),
      db
        .from("plays")
        .select(
          "id, name, team_id, created_at, published_to_library, published_at, published_by, publish_anonymous, library_author_name",
        ),
      db.from("games").select("id, team_id, status, created_at, ended_at, opponent"),
      db.from("play_hearts").select("play_id, user_id, created_at"),
      db.from("coach_follows").select("follower_id, creator_id, created_at"),
      db.from("team_billing").select("team_id, status, modules, current_period_end, updated_at"),
      db.from("complimentary_grants").select("team_id, active, modules, created_at"),
      db.from("players").select("id, team_id, name, created_at"),
      db.from("google_calendar_connections").select("user_id, team_id, created_at, sync_enabled"),
      db.from("access_code_redemptions").select("user_id, team_id, modules, created_at"),
      db.from("featured_play").select("play_id, updated_at").maybeSingle(),
      db
        .from("product_activity_events")
        .select("user_id, event_type, team_id, entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const profiles = (profilesR.data ?? []) as any[];
    const teamMembers = (teamMembersR.data ?? []) as any[];
    const orgMembers = (orgMembersR.data ?? []) as any[];
    const teams = (teamsR.data ?? []) as any[];
    const plays = (playsR.data ?? []) as any[];
    const games = (gamesR.data ?? []) as any[];
    const hearts = (heartsR.data ?? []) as any[];
    const follows = (followsR.data ?? []) as any[];
    const billing = (billingR.data ?? []) as any[];
    const comps = (compR.data ?? []) as any[];
    const players = (playersR.data ?? []) as any[];
    const calendars = (calendarR.data ?? []) as any[];
    const redemptions = (redemptionsR.data ?? []) as any[];
    const tracked = (activityR.data ?? []) as any[];

    // ---- who counts as a "coach account" -------------------------------
    // Someone holding a staff role on a team, or a membership in a program.
    // Player-only and parent accounts are excluded on purpose.
    const coachIds = new Set<string>();
    for (const m of teamMembers) {
      if (m.role === "head_coach" || m.role === "assistant_coach") coachIds.add(m.user_id);
    }
    for (const m of orgMembers) coachIds.add(m.user_id);

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const nameOf = (userId: string | null | undefined) => {
      if (!userId) return "Unknown";
      const p = profileById.get(userId);
      return p?.full_name || p?.public_display_name || p?.email || "Unknown coach";
    };

    // Teams each coach is staff on.
    const teamsOfCoach = new Map<string, Set<string>>();
    for (const m of teamMembers) {
      if (m.role !== "head_coach" && m.role !== "assistant_coach") continue;
      const set = teamsOfCoach.get(m.user_id) ?? new Set<string>();
      set.add(m.team_id);
      teamsOfCoach.set(m.user_id, set);
    }
    const coachOfTeam = new Map<string, string>();
    for (const m of teamMembers) {
      if (m.role === "head_coach") coachOfTeam.set(m.team_id, m.user_id);
    }
    for (const m of teamMembers) {
      if (m.role === "assistant_coach" && !coachOfTeam.has(m.team_id)) {
        coachOfTeam.set(m.team_id, m.user_id);
      }
    }
    // Older teams predate staff rows, so fall back to the program owner and
    // count them as that coach's team for activity purposes.
    const headOfOrg = new Map<string, string>();
    for (const m of orgMembers) {
      if (m.role === "head_coach" || !headOfOrg.has(m.org_id)) headOfOrg.set(m.org_id, m.user_id);
    }
    for (const t of teams) {
      if (coachOfTeam.has(t.id)) continue;
      const owner = t.org_id ? headOfOrg.get(t.org_id) : undefined;
      if (!owner) continue;
      coachOfTeam.set(t.id, owner);
      const set = teamsOfCoach.get(owner) ?? new Set<string>();
      set.add(t.id);
      teamsOfCoach.set(owner, set);
    }


    // ---- activity timestamps per coach ---------------------------------
    // "Active" = a real product action in the period: play, game, team,
    // roster, heart, calendar, membership change or a tracked event.
    const activityTimes = new Map<string, string[]>();
    const push = (userId: string | null | undefined, at: string | null | undefined) => {
      if (!userId || !at) return;
      const list = activityTimes.get(userId) ?? [];
      list.push(at);
      activityTimes.set(userId, list);
    };
    for (const p of plays) {
      const owner = p.published_by ?? (p.team_id ? coachOfTeam.get(p.team_id) : null);
      push(owner, p.created_at);
      if (p.published_at) push(p.published_by ?? owner, p.published_at);
    }
    for (const g of games) {
      const owner = coachOfTeam.get(g.team_id);
      push(owner, g.created_at);
      if (g.ended_at) push(owner, g.ended_at);
    }
    for (const t of teams) {
      const staff = teamMembers.find(
        (m) => m.team_id === t.id && (m.role === "head_coach" || m.role === "assistant_coach"),
      );
      push(staff?.user_id, t.created_at);
    }
    for (const pl of players) push(coachOfTeam.get(pl.team_id), pl.created_at);
    for (const h of hearts) push(h.user_id, h.created_at);
    for (const f of follows) push(f.follower_id, f.created_at);
    for (const c of calendars) push(c.user_id, c.created_at);
    for (const r of redemptions) push(r.user_id, r.created_at);
    for (const e of tracked) push(e.user_id, e.created_at);

    const lastActivity = new Map<string, string>();
    for (const [userId, list] of activityTimes) {
      lastActivity.set(userId, list.sort().at(-1)!);
    }

    const activeCoaches = [...coachIds].filter((id) =>
      (activityTimes.get(id) ?? []).some((t) => inRange(t, since)),
    );

    // ---- membership / money --------------------------------------------
    const compTeams = new Set(comps.filter((c) => c.active).map((c) => c.team_id));
    const paidStatuses = new Set(["active", "grace", "past_due"]);
    const tierCounts = new Map<string, { teams: number; monthly: number }>();
    const statusCounts = new Map<string, number>();
    let mrr = 0;
    let activePaidTeams = 0;

    const tierLabel = (modules: ModuleKey[]) => {
      const tier = planTier(modules);
      if (tier === "free") return "Free Core";
      if (tier === "complete") return "CoachSide Complete";
      if (tier === "duo") return "Any two modules";
      const key = modules[0]!;
      return key === "playbook_plus" ? "Playbook+" : key === "gameday_plus" ? "GameDay+" : "Team Hub+";
    };

    const bump = (label: string, monthly: number) => {
      const cur = tierCounts.get(label) ?? { teams: 0, monthly: 0 };
      tierCounts.set(label, { teams: cur.teams + 1, monthly: cur.monthly + monthly });
    };

    const billingByTeam = new Map(billing.map((b) => [b.team_id, b]));
    for (const t of teams) {
      const row = billingByTeam.get(t.id);
      const modules = ((row?.modules ?? []) as string[]).filter((m): m is ModuleKey =>
        ALL_MODULES.includes(m as ModuleKey),
      );
      const status = (row?.status ?? "free") as string;
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
      if (compTeams.has(t.id) || status === "complimentary") {
        bump("Complimentary access", 0);
        continue;
      }
      // Only genuinely active paid subscriptions produce revenue.
      const money = paidStatuses.has(status) && modules.length > 0 ? priceFor(modules) : 0;
      if (money > 0) {
        activePaidTeams += 1;
        mrr += money;
      }
      bump(modules.length ? tierLabel(modules) : "Free Core", money);
    }

    const billingLive = billing.some(
      (b) => b.status === "active" || b.status === "grace" || b.status === "past_due",
    );

    // ---- activity feed ---------------------------------------------------
    const feed: ActivityRow[] = [];
    const teamName = (id: string | null | undefined) =>
      (id && teamById.get(id)?.name) || "a team";
    for (const p of plays) {
      const owner = p.published_by ?? (p.team_id ? coachOfTeam.get(p.team_id) : null);
      feed.push({
        at: p.created_at,
        type: "Play created",
        who: nameOf(owner),
        detail: `${p.name} · ${teamName(p.team_id)}`,
      });
      if (p.published_at) {
        feed.push({
          at: p.published_at,
          type: "Play published",
          who: nameOf(p.published_by ?? owner),
          detail: p.name,
        });
      }
    }
    for (const g of games) {
      feed.push({
        at: g.created_at,
        type: "Game started",
        who: nameOf(coachOfTeam.get(g.team_id)),
        detail: `vs ${g.opponent} · ${teamName(g.team_id)}`,
      });
      if (g.ended_at) {
        feed.push({
          at: g.ended_at,
          type: "Game completed",
          who: nameOf(coachOfTeam.get(g.team_id)),
          detail: `vs ${g.opponent}`,
        });
      }
    }
    const trackedTeamCreated = new Set(
      tracked.filter((e) => e.event_type === "team_created" && e.team_id).map((e) => e.team_id),
    );
    for (const t of teams) {
      if (trackedTeamCreated.has(t.id)) continue; // logged event already covers it
      const staff = teamMembers.find(
        (m) => m.team_id === t.id && (m.role === "head_coach" || m.role === "assistant_coach"),
      );
      feed.push({
        at: t.created_at,
        type: "Team created",
        who: staff ? nameOf(staff.user_id) : "No coach on team",
        detail: t.name,
      });
    }
    for (const pl of players) {
      feed.push({
        at: pl.created_at,
        type: "Roster player added",
        who: nameOf(coachOfTeam.get(pl.team_id)),
        detail: `${pl.name} · ${teamName(pl.team_id)}`,
      });
    }
    for (const h of hearts) {
      feed.push({
        at: h.created_at,
        type: "Library play hearted",
        who: nameOf(h.user_id),
        detail: plays.find((p) => p.id === h.play_id)?.name ?? "a Library play",
      });
    }
    for (const f of follows) {
      feed.push({
        at: f.created_at,
        type: "Followed a coach",
        who: nameOf(f.follower_id),
        detail: nameOf(f.creator_id),
      });
    }
    for (const c of calendars) {
      feed.push({
        at: c.created_at,
        type: "Google Calendar connected",
        who: nameOf(c.user_id),
        detail: teamName(c.team_id),
      });
    }
    for (const r of redemptions) {
      feed.push({
        at: r.created_at,
        type: "Access code redeemed",
        who: nameOf(r.user_id),
        detail: teamName(r.team_id),
      });
    }
    const EVENT_LABELS: Record<string, string> = {
      signed_in: "Signed in",
      team_created: "Team created",
      trial_started: "Complete trial started (14 days, no charge)",
      trial_expired: "Complete trial ended",
      library_play_added_to_playbook: "Library play added to Playbook",
      play_exported_video: "Play exported as video",
      membership_changed: "Membership changed",
    };
    const seenSignIn = new Set<string>();
    for (const e of tracked) {
      if (e.event_type === "signed_in") {
        // Collapse legacy duplicates logged within the same minute.
        const k = `${e.user_id}|${String(e.created_at).slice(0, 16)}`;
        if (seenSignIn.has(k)) continue;
        seenSignIn.add(k);
      }
      const label = EVENT_LABELS[e.event_type] ?? String(e.event_type).replace(/_/g, " ");
      feed.push({
        at: e.created_at,
        type: label.charAt(0).toUpperCase() + label.slice(1),
        who: nameOf(e.user_id),
        detail: teamName(e.team_id),
      });
    }
    feed.sort((a, b) => (a.at < b.at ? 1 : -1));
    const activity = feed.filter((r) => inRange(r.at, since)).slice(0, 60);

    // ---- recent coaches table -------------------------------------------
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const coaches: CoachRow[] = [...coachIds].map((userId) => {
      const p = profileById.get(userId);
      const myTeams = [...(teamsOfCoach.get(userId) ?? [])];
      const myPlays = plays.filter(
        (x) => x.published_by === userId || (x.team_id && myTeams.includes(x.team_id)),
      ).length;
      const myGames = games.filter((g) => myTeams.includes(g.team_id));
      const last = lastActivity.get(userId) ?? null;
      const signedUp = p?.created_at ?? "";
      const modules = myTeams
        .map((t) => billingByTeam.get(t))
        .flatMap((b) => ((b?.modules ?? []) as string[]));
      const validModules = modules.filter((m): m is ModuleKey =>
        ALL_MODULES.includes(m as ModuleKey),
      );
      const status: CoachRow["status"] =
        signedUp >= sevenDaysAgo
          ? "New"
          : last && last >= thirtyDaysAgo
            ? "Active recently"
            : "Inactive";
      return {
        userId,
        name: p?.full_name || p?.public_display_name || p?.username || "Unnamed coach",
        email: p?.email ?? "—",
        signedUp,
        lastActivity: last,
        teams: myTeams.length,
        plays: myPlays,
        gamesStarted: myGames.length,
        gamesCompleted: myGames.filter((g) => g.ended_at || g.status === "final").length,
        tier: validModules.length ? tierLabel([...new Set(validModules)]) : "Free Core",
        status,
      };
    });
    coaches.sort((a, b) => (a.signedUp < b.signedUp ? 1 : -1));

    // ---- content ---------------------------------------------------------
    const heartsByPlay = new Map<string, number>();
    for (const h of hearts) heartsByPlay.set(h.play_id, (heartsByPlay.get(h.play_id) ?? 0) + 1);
    const publishedPlays = plays.filter((p) => p.published_to_library);
    const authorLabel = (p: any) =>
      p.publish_anonymous
        ? "Anonymous coach"
        : p.library_author_name || nameOf(p.published_by);
    const topPlays = publishedPlays
      .map((p) => ({ name: p.name, hearts: heartsByPlay.get(p.id) ?? 0, author: authorLabel(p) }))
      .sort((a, b) => b.hearts - a.hearts)
      .slice(0, 5);

    const creatorStats = new Map<string, { hearts: number; followers: number }>();
    for (const p of publishedPlays) {
      if (p.publish_anonymous || !p.published_by) continue;
      const cur = creatorStats.get(p.published_by) ?? { hearts: 0, followers: 0 };
      cur.hearts += heartsByPlay.get(p.id) ?? 0;
      creatorStats.set(p.published_by, cur);
    }
    for (const f of follows) {
      const cur = creatorStats.get(f.creator_id);
      if (cur) cur.followers += 1;
    }
    const topCreators = [...creatorStats.entries()]
      .map(([id, s]) => ({ name: nameOf(id), hearts: s.hearts, followers: s.followers }))
      .sort((a, b) => b.hearts - a.hearts || b.followers - a.followers)
      .slice(0, 5);

    const featuredId = (featuredR.data as any)?.play_id ?? null;
    const playOfTheDay = featuredId
      ? (plays.find((p) => p.id === featuredId)?.name ?? "Selected play")
      : null;

    // ---- games -----------------------------------------------------------
    const gamesStarted = games.filter((g) => inRange(g.created_at, since));
    const gamesCompleted = games.filter((g) => inRange(g.ended_at, since));
    const uniqueGameTeams = new Set(gamesStarted.map((g) => g.team_id));
    let statEvents = 0;
    {
      const q = db.from("game_events").select("id", { count: "exact", head: true });
      const { count } = await (since ? q.gte("created_at", since) : q);
      statEvents = count ?? 0;
    }

    const coachSignupTimes = [...coachIds]
      .map((id) => profileById.get(id)?.created_at as string | undefined)
      .filter((t): t is string => !!t);

    const activeCoachDays = new Map<string, Set<string>>();
    for (const [userId, times] of activityTimes) {
      if (!coachIds.has(userId)) continue;
      for (const t of times) {
        const set = activeCoachDays.get(dayKey(t)) ?? new Set<string>();
        set.add(userId);
        activeCoachDays.set(dayKey(t), set);
      }
    }
    const activeSeries = series([], 30).map((d) => ({
      day: d.day,
      value: activeCoachDays.get(d.day)?.size ?? 0,
    }));

    return {
      range: data.range,
      generatedAt: new Date().toISOString(),
      totals: {
        coachAccounts: coachIds.size,
        newCoaches: coachSignupTimes.filter((t) => inRange(t, since)).length,
        activeCoaches: activeCoaches.length,
        teams: teams.length,
        teamsInPeriod: teams.filter((t) => inRange(t.created_at, since)).length,
        plays: plays.length,
        playsInPeriod: plays.filter((p) => inRange(p.created_at, since)).length,
        publishedPlays: publishedPlays.length,
        gamesStarted: gamesStarted.length,
        gamesCompleted: gamesCompleted.length,
        paidTeams: activePaidTeams,
        complimentaryTeams: compTeams.size,
        mrr,
        billingLive,
      },
      membership: {
        tiers: [...tierCounts.entries()].map(([label, v]) => ({
          label,
          teams: v.teams,
          monthly: v.monthly,
        })),
        statuses: [...statusCounts.entries()].map(([label, teams]) => ({ label, teams })),
        complimentary: compTeams.size,
        activePaidTeams,
        mrr,
        billingLive,
      },
      activity,
      coaches,
      content: {
        publishedTotal: publishedPlays.length,
        createdInPeriod: plays.filter((p) => inRange(p.created_at, since)).length,
        heartsInPeriod: hearts.filter((h) => inRange(h.created_at, since)).length,
        follows: follows.length,
        playOfTheDay,
        topPlays,
        topCreators,
      },
      games: {
        started: gamesStarted.length,
        completed: gamesCompleted.length,
        uniqueTeams: uniqueGameTeams.size,
        avgPerActiveTeam: uniqueGameTeams.size
          ? Math.round((gamesStarted.length / uniqueGameTeams.size) * 10) / 10
          : 0,
        statEvents,
      },
      trends: {
        signups: series(coachSignupTimes, 30),
        plays: series(
          plays.map((p) => p.created_at as string),
          30,
        ),
        games: series(
          games.map((g) => g.created_at as string),
          30,
        ),
        activeCoaches: activeSeries,
      },
    };
  });
