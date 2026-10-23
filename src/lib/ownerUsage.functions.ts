/**
 * Owner-only, read-only product-usage drilldowns for My KPI.
 *
 * Every function requires a signed-in caller AND passes the existing owner
 * check (public.is_app_admin) with the caller's own identity before the
 * privileged client is loaded. Nothing here writes, and nothing returns
 * passwords, tokens, message bodies, contact details or other personal data
 * beyond the coach name/email already shown on My KPI and roster
 * name/jersey needed to read stats.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_MODULES, planTier, type ModuleKey } from "./entitlements";
import { admin, assertOwner, type ActivityRow } from "./kpi.functions";
import { trackingMode, type PostGameLog, type TrackingMode } from "./gameUsage";
import type { Game, GameEvent, Player, Substitution } from "./types";

const idSchema = (key: string) => z.object({ [key]: z.string().uuid() });

export type OwnerGamePayload = {
  game: Game;
  teamName: string;
  season: string | null;
  coach: { userId: string; name: string } | null;
  events: GameEvent[];
  subs: Substitution[];
  players: Pick<Player, "id" | "team_id" | "jersey" | "name" | "position" | "active">[];
  postGameLog: PostGameLog;
  fetchedAt: string;
};

const GAME_COLS =
  "id, team_id, opponent, game_date, periods, period_minutes, overtime_minutes, status, team_score, opp_score, quarter, clock_seconds, starting_five, home_away, created_at, ended_at, stat_tracking_config, rules_config, tracking_history, tracking_coverage_override";
const EVENT_COLS =
  "id, game_id, quarter, clock_seconds, player_id, x, y, event_type, result, points, zone, current_lineup, related_event_id, context, created_at";

async function coachForTeam(db: Awaited<ReturnType<typeof admin>>, teamId: string, orgId: string | null) {
  const { data: staff } = await db
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", teamId)
    .in("role", ["head_coach", "assistant_coach"]);
  const rows = (staff ?? []) as { user_id: string; role: string }[];
  let userId = rows.find((r) => r.role === "head_coach")?.user_id ?? rows[0]?.user_id ?? null;
  if (!userId && orgId) {
    const { data: om } = await db.from("org_members").select("user_id, role").eq("org_id", orgId);
    const list = (om ?? []) as { user_id: string; role: string }[];
    userId = list.find((r) => r.role === "head_coach")?.user_id ?? list[0]?.user_id ?? null;
  }
  if (!userId) return null;
  const { data: p } = await db
    .from("profiles")
    .select("full_name, public_display_name, username")
    .eq("id", userId)
    .maybeSingle();
  const name = p?.full_name || p?.public_display_name || p?.username || "Unnamed coach";
  return { userId, name };
}

/** One game exactly as stored, for read-only owner inspection. Returned as JSON text. */
export const getOwnerGameUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gameId: string }) => idSchema("gameId").parse(d) as { gameId: string })
  .handler(async ({ data, context }): Promise<string> => {
    await assertOwner(context.supabase);
    const db = await admin();
    const { data: game, error } = await db.from("games").select(GAME_COLS).eq("id", data.gameId).maybeSingle();
    if (error || !game) throw new Error("Game not found.");
    const [teamR, eventsR, subsR, playersR, logR] = await Promise.all([
      db.from("teams").select("id, name, season, org_id").eq("id", game.team_id).maybeSingle(),
      db.from("game_events").select(EVENT_COLS).eq("game_id", data.gameId).order("created_at").limit(5000),
      db.from("substitutions").select("id, game_id, quarter, clock_seconds, player_out, player_in, lineup_after, created_at").eq("game_id", data.gameId).order("created_at").limit(2000),
      db.from("players").select("id, team_id, jersey, name, position, active").eq("team_id", game.team_id),
      db
        .from("product_activity_events")
        .select("event_type")
        .eq("entity_id", data.gameId)
        .in("event_type", ["game_stat_edited", "game_stat_added_postgame", "game_stat_deleted_postgame"])
        .limit(5000),
    ]);
    const team = teamR.data as { name: string; season: string | null; org_id: string | null } | null;
    const log = ((logR.data ?? []) as { event_type: string }[]).reduce<PostGameLog>(
      (m, r) => {
        if (r.event_type === "game_stat_edited") m.edited++;
        else if (r.event_type === "game_stat_added_postgame") m.added++;
        else m.deleted++;
        return m;
      },
      { edited: 0, added: 0, deleted: 0 },
    );
    const payload: OwnerGamePayload = {
      game: game as Game,
      teamName: team?.name ?? "Unknown team",
      season: team?.season ?? null,
      coach: await coachForTeam(db, game.team_id, team?.org_id ?? null),
      events: (eventsR.data ?? []) as GameEvent[],
      subs: (subsR.data ?? []) as Substitution[],
      players: (playersR.data ?? []) as OwnerGamePayload["players"],
      postGameLog: log,
      fetchedAt: new Date().toISOString(),
    };
    return JSON.stringify(payload);
  });

export type CoachUsageGame = {
  id: string;
  opponent: string;
  teamName: string;
  gameDate: string;
  status: string;
  createdAt: string;
  endedAt: string | null;
  events: number;
  mode: TrackingMode;
};

export type CoachUsage = {
  userId: string;
  name: string;
  email: string;
  signedUp: string | null;
  lastActivity: string | null;
  teams: { id: string; name: string; season: string; role: string; tier: string; status: string; players: number }[];
  counts: {
    playsCreated: number;
    playsPublished: number;
    libraryAdds: number;
    playExports: number;
    drillsCreated: number;
    gamesStarted: number;
    gamesCompleted: number;
    statEvents: number;
    postGameEdits: number;
    signIns: number;
    announcements: number;
    assignments: number;
    practicePlans: number;
    teamEvents: number;
    messagesSent: number;
  };
  calendar: { connected: boolean; syncing: boolean };
  games: CoachUsageGame[];
  recent: ActivityRow[];
  fetchedAt: string;
};

const EVENT_LABELS: Record<string, string> = {
  signed_in: "Signed in",
  team_created: "Team created",
  trial_started: "Complete trial started",
  trial_expired: "Complete trial ended",
  library_play_added_to_playbook: "Library play added to Playbook",
  play_exported_video: "Play exported as video",
  play_shared: "Play shared",
  parent_link_shared: "Parent link shared",
  stats_exported: "Stats exported",
  board_used_in_game: "Board used in game",
  pwa_installed: "App installed",
  potd_viewed: "Play of the Day viewed",
  membership_changed: "Membership changed",
  game_stat_edited: "Post-game stat edited",
  game_stat_added_postgame: "Post-game stat added",
  game_stat_deleted_postgame: "Post-game stat deleted",
};

function tierLabel(modules: ModuleKey[]) {
  const tier = planTier(modules);
  if (tier === "free") return "Free Core";
  if (tier === "complete") return "CoachSide Complete";
  if (tier === "duo") return "Any two modules";
  const key = modules[0]!;
  return key === "playbook_plus" ? "Playbook+" : key === "gameday_plus" ? "GameDay+" : "Team Hub+";
}

/** Counts and recent usage for one account. Never message contents. */
export const getOwnerCoachUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => idSchema("userId").parse(d) as { userId: string })
  .handler(async ({ data, context }): Promise<CoachUsage> => {
    await assertOwner(context.supabase);
    const db = await admin();
    const uid = data.userId;

    const [profileR, staffR, orgR] = await Promise.all([
      db.from("profiles").select("id, email, full_name, public_display_name, username, created_at").eq("id", uid).maybeSingle(),
      db.from("team_members").select("team_id, role, active").eq("user_id", uid),
      db.from("org_members").select("org_id, role").eq("user_id", uid),
    ]);
    const profile = profileR.data as any;
    if (!profile) throw new Error("Account not found.");

    const roleByTeam = new Map<string, string>();
    for (const m of (staffR.data ?? []) as any[]) {
      if (m.active === false) continue;
      roleByTeam.set(m.team_id, String(m.role).replace(/_/g, " "));
    }
    const orgIds = ((orgR.data ?? []) as any[]).map((o) => o.org_id).filter(Boolean);
    if (orgIds.length) {
      const { data: orgTeams } = await db.from("teams").select("id").in("org_id", orgIds);
      for (const t of (orgTeams ?? []) as any[]) if (!roleByTeam.has(t.id)) roleByTeam.set(t.id, "program");
    }
    const teamIds = [...roleByTeam.keys()];
    const staffTeamIds = teamIds.filter((id) => roleByTeam.get(id) !== "player" && roleByTeam.get(id) !== "parent");
    const none = ["00000000-0000-0000-0000-000000000000"];
    const tIds = staffTeamIds.length ? staffTeamIds : none;

    const headCount = async (q: any): Promise<number> => {
      const { count } = await q;
      return count ?? 0;
    };
    const countBy = (table: string, col: string) =>
      headCount(db.from(table).select("id", { count: "exact", head: true }).eq(col, uid));
    const activityCount = (type: string) =>
      headCount(db.from("product_activity_events").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("event_type", type));

    const [teamsR, billingR, compR, playersR, playsR, legacyPlaysR, gamesR, calR, activityR, counts] = await Promise.all([
      db.from("teams").select("id, name, season").in("id", teamIds.length ? teamIds : none),
      db.from("team_billing").select("team_id, status, modules").in("team_id", tIds),
      db.from("complimentary_grants").select("team_id, active").in("team_id", tIds).eq("active", true),
      db.from("players").select("team_id").in("team_id", tIds),
      db.from("plays").select("id, name, team_id, created_at, published_at, published_to_library").or(`created_by.eq.${uid},published_by.eq.${uid}`),
      db.from("plays").select("id, name, team_id, created_at, published_at, published_to_library").is("created_by", null).in("team_id", tIds),
      db.from("games").select(GAME_COLS).in("team_id", tIds).order("created_at", { ascending: false }).limit(200),
      db.from("google_calendar_connections").select("team_id, sync_enabled, created_at").eq("user_id", uid),
      db.from("product_activity_events").select("event_type, team_id, entity_id, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(60),
      Promise.all([
        activityCount("library_play_added_to_playbook"),
        activityCount("play_exported_video"),
        activityCount("signed_in"),
        countBy("drills", "created_by"),
        countBy("announcements", "created_by"),
        countBy("assignments", "created_by"),
        countBy("practice_plans", "created_by"),
        countBy("team_events", "created_by"),
        countBy("messages", "sender_id"),
        headCount(
          db
            .from("product_activity_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid)
            .in("event_type", ["game_stat_edited", "game_stat_added_postgame", "game_stat_deleted_postgame"]),
        ),
      ]),
    ]);
    const [libraryAdds, playExports, signIns, drillsCreated, announcements, assignments, practicePlans, teamEvents, messagesSent, postGameEdits] = counts;

    const teams = (teamsR.data ?? []) as any[];
    const teamName = new Map(teams.map((t) => [t.id, t.name as string]));
    const billingByTeam = new Map(((billingR.data ?? []) as any[]).map((b) => [b.team_id, b]));
    const compTeams = new Set(((compR.data ?? []) as any[]).map((c) => c.team_id));
    const playersByTeam = new Map<string, number>();
    for (const p of (playersR.data ?? []) as any[]) playersByTeam.set(p.team_id, (playersByTeam.get(p.team_id) ?? 0) + 1);

    const playMap = new Map<string, any>();
    for (const p of [...((playsR.data ?? []) as any[]), ...((legacyPlaysR.data ?? []) as any[])]) playMap.set(p.id, p);
    const plays = [...playMap.values()];

    const games = (gamesR.data ?? []) as any[];
    const gameIds = games.map((g) => g.id as string);
    const recentGames = games.slice(0, 40);
    const [eventCounts, statEvents] = await Promise.all([
      Promise.all(
        recentGames.map((g) => headCount(db.from("game_events").select("id", { count: "exact", head: true }).eq("game_id", g.id))),
      ),
      gameIds.length
        ? headCount(db.from("game_events").select("id", { count: "exact", head: true }).in("game_id", gameIds))
        : Promise.resolve(0),
    ]);

    const calendars = (calR.data ?? []) as any[];

    // ---- recent inspectable activity --------------------------------
    const recent: ActivityRow[] = [];
    for (const g of games) {
      recent.push({ at: g.created_at, type: "Game started", who: "", detail: `vs ${g.opponent} · ${teamName.get(g.team_id) ?? "a team"}`, gameId: g.id, teamId: g.team_id, userId: uid });
      if (g.ended_at) recent.push({ at: g.ended_at, type: "Game completed", who: "", detail: `vs ${g.opponent} · ${teamName.get(g.team_id) ?? "a team"}`, gameId: g.id, teamId: g.team_id, userId: uid });
    }
    for (const p of plays) {
      recent.push({ at: p.created_at, type: "Play created", who: "", detail: p.name, playId: p.id, teamId: p.team_id, userId: uid });
      if (p.published_at) recent.push({ at: p.published_at, type: "Play published", who: "", detail: p.name, playId: p.id, teamId: p.team_id, userId: uid });
    }
    for (const c of calendars) recent.push({ at: c.created_at, type: "Google Calendar connected", who: "", detail: teamName.get(c.team_id) ?? "a team", teamId: c.team_id, userId: uid });
    for (const e of (activityR.data ?? []) as any[]) {
      recent.push({
        at: e.created_at,
        type: EVENT_LABELS[e.event_type] ?? String(e.event_type).replace(/_/g, " "),
        who: "",
        detail: e.team_id ? (teamName.get(e.team_id) ?? "a team") : "",
        teamId: e.team_id,
        userId: uid,
        gameId: String(e.event_type).startsWith("game_stat_") ? e.entity_id : null,
      });
    }
    recent.sort((a, b) => (a.at < b.at ? 1 : -1));

    return {
      userId: uid,
      name: profile.full_name || profile.public_display_name || profile.username || "Unnamed coach",
      email: profile.email ?? "—",
      signedUp: profile.created_at ?? null,
      lastActivity: recent[0]?.at ?? null,
      teams: teams.map((t) => {
        const b = billingByTeam.get(t.id);
        const mods = ((b?.modules ?? []) as string[]).filter((m): m is ModuleKey => ALL_MODULES.includes(m as ModuleKey));
        return {
          id: t.id,
          name: t.name,
          season: t.season ?? "",
          role: roleByTeam.get(t.id) ?? "—",
          tier: compTeams.has(t.id) ? "Complimentary" : mods.length ? tierLabel(mods) : "Free Core",
          status: String(b?.status ?? "free"),
          players: playersByTeam.get(t.id) ?? 0,
        };
      }),
      counts: {
        playsCreated: plays.length,
        playsPublished: plays.filter((p) => p.published_to_library).length,
        libraryAdds,
        playExports,
        drillsCreated,
        gamesStarted: games.length,
        gamesCompleted: games.filter((g) => g.status === "final" || g.ended_at).length,
        statEvents,
        postGameEdits,
        signIns,
        announcements,
        assignments,
        practicePlans,
        teamEvents,
        messagesSent,
      },
      calendar: { connected: calendars.length > 0, syncing: calendars.some((c) => c.sync_enabled) },
      games: recentGames.map((g, i) => ({
        id: g.id,
        opponent: g.opponent,
        teamName: teamName.get(g.team_id) ?? "Unknown team",
        gameDate: g.game_date,
        status: g.status,
        createdAt: g.created_at,
        endedAt: g.ended_at ?? null,
        events: eventCounts[i] ?? 0,
        mode: trackingMode(g.stat_tracking_config),
      })),
      recent: recent.slice(0, 40),
      fetchedAt: new Date().toISOString(),
    };
  });
