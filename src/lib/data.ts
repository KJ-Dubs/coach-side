import { supabase } from "@/integrations/supabase/client";
import { alertTeam } from "./teamAlerts";
import type {
  CalendarConnection,
  CalendarMapping,
  CoachInvite,
  CoachRole,
  EventReminder,
  Game,
  GameEvent,
  OrgMember,
  Play,
  PlayFrame,
  Player,
  Substitution,
  Team,
  TeamEvent,
} from "./types";

export const DEMO_TEAM_ID = "11111111-1111-1111-1111-111111111111";

const PAGE = 1000;

/** Pull every row for a query that may exceed the 1000-row API page size. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ---------------- teams & players ---------------- */

export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as Team[];
}

export function sortPlayers(list: Player[]) {
  return [...list].sort(
    (a, b) => Number(a.jersey) - Number(b.jersey) || a.jersey.localeCompare(b.jersey),
  );
}

export async function fetchPlayers(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId)
    .order("jersey");
  if (error) throw error;
  return sortPlayers((data ?? []) as Player[]);
}

export async function fetchAllPlayers(): Promise<Player[]> {
  const rows = await fetchAll<Player>((from, to) =>
    supabase.from("players").select("*").order("created_at").range(from, to),
  );
  return sortPlayers(rows);
}

/* ---------------- games ---------------- */

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("game_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Game[];
}

export async function fetchGame(id: string): Promise<Game> {
  const { data, error } = await supabase.from("games").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Game;
}

export async function fetchEvents(gameId: string): Promise<GameEvent[]> {
  return fetchAll<GameEvent>((from, to) =>
    supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at")
      .range(from, to),
  );
}

export async function fetchSubs(gameId: string): Promise<Substitution[]> {
  return fetchAll<Substitution>((from, to) =>
    supabase
      .from("substitutions")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at")
      .range(from, to),
  );
}

/** Events for many games at once (season stats). */
export async function fetchEventsForGames(gameIds: string[]): Promise<GameEvent[]> {
  if (!gameIds.length) return [];
  const out: GameEvent[] = [];
  for (const ids of chunk(gameIds, 60)) {
    const rows = await fetchAll<GameEvent>((from, to) =>
      supabase
        .from("game_events")
        .select("*")
        .in("game_id", ids)
        .order("created_at")
        .range(from, to),
    );
    out.push(...rows);
  }
  return out;
}

export async function fetchSubsForGames(gameIds: string[]): Promise<Substitution[]> {
  if (!gameIds.length) return [];
  const out: Substitution[] = [];
  for (const ids of chunk(gameIds, 60)) {
    const rows = await fetchAll<Substitution>((from, to) =>
      supabase
        .from("substitutions")
        .select("*")
        .in("game_id", ids)
        .order("created_at")
        .range(from, to),
    );
    out.push(...rows);
  }
  return out;
}

/** Everything the stats pages need: games + their events + subs. */
export type SeasonBundle = {
  games: Game[];
  events: GameEvent[];
  subs: Substitution[];
};

export async function fetchSeasonBundle(opts?: { finalOnly?: boolean }): Promise<SeasonBundle> {
  const all = await fetchGames();
  const games = opts?.finalOnly === false ? all : all.filter((g) => g.status === "final");
  const ids = games.map((g) => g.id);
  const [events, subs] = await Promise.all([fetchEventsForGames(ids), fetchSubsForGames(ids)]);
  return { games, events, subs };
}

export async function createGame(input: {
  team_id: string;
  opponent: string;
  game_date: string;
  periods: number;
  period_minutes: number;
  starting_five: string[];
  home_away: "home" | "away";
  overtime_minutes: number;
}): Promise<Game> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      ...input,
      status: "live",
      quarter: 1,
      clock_seconds: input.period_minutes * 60,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Game;
}

export async function endGame(
  gameId: string,
  patch: { team_score: number; opp_score: number; quarter: number; clock_seconds: number },
) {
  const { error } = await supabase
    .from("games")
    .update({ ...patch, status: "final", ended_at: new Date().toISOString() })
    .eq("id", gameId);
  if (error) throw error;
}

export async function deleteGame(gameId: string) {
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) throw error;
}

/* ---------------- plays ---------------- */

export async function fetchPlays(): Promise<Play[]> {
  const { data, error } = await supabase
    .from("plays")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Play[];
}

export async function fetchPlay(id: string): Promise<Play> {
  const { data, error } = await supabase.from("plays").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Play;
}

export async function fetchPlayByToken(token: string): Promise<Play | null> {
  const { data, error } = await supabase
    .from("plays")
    .select("*")
    .eq("share_token", token)
    .eq("is_shared", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Play) ?? null;
}

export async function fetchFrames(playId: string): Promise<PlayFrame[]> {
  const { data, error } = await supabase
    .from("play_frames")
    .select("*")
    .eq("play_id", playId)
    .order("idx");
  if (error) throw error;
  return (data ?? []) as unknown as PlayFrame[];
}

export async function saveFrames(playId: string, frames: PlayFrame[]) {
  const { error: delError } = await supabase.from("play_frames").delete().eq("play_id", playId);
  if (delError) throw delError;
  if (!frames.length) return;
  const rows = frames.map((f, i) => ({
    play_id: playId,
    idx: i,
    tokens: f.tokens as never,
    actions: f.actions as never,
    note: f.note,
  }));
  const { error } = await supabase.from("play_frames").insert(rows as never);
  if (error) throw error;
}

export async function updatePlay(id: string, patch: Partial<Play>) {
  const { error } = await supabase.from("plays").update(patch as never).eq("id", id);
  if (error) throw error;
}

export type PlayTeamAssignment = {
  id: string;
  play_id: string;
  team_id: string;
  is_visible: boolean;
  library_version: number | null;
};

/** Every play↔team link the signed-in coach can see. Source of truth for team playbooks. */
export async function fetchPlayAssignments(): Promise<PlayTeamAssignment[]> {
  const { data, error } = await supabase
    .from("play_team_assignments")
    .select("id,play_id,team_id,is_visible,library_version");
  if (error) throw error;
  return (data ?? []) as unknown as PlayTeamAssignment[];
}

export async function fetchTeamsForPlay(playId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("play_team_assignments")
    .select("team_id")
    .eq("play_id", playId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { team_id: string }).team_id);
}

/** Replace the set of teams a play is shared with. */
export async function setPlayTeams(playId: string, teamIds: string[]) {
  const current = await fetchTeamsForPlay(playId);
  const add = teamIds.filter((t) => !current.includes(t));
  const remove = current.filter((t) => !teamIds.includes(t));
  const { data: auth } = await supabase.auth.getUser();

  if (add.length) {
    const { error } = await supabase.from("play_team_assignments").insert(
      add.map((team_id) => ({
        play_id: playId,
        team_id,
        assigned_by: auth.user?.id ?? null,
      })) as never,
    );
    if (error) throw error;
  }
  if (remove.length) {
    const { error } = await supabase
      .from("play_team_assignments")
      .delete()
      .eq("play_id", playId)
      .in("team_id", remove);
    if (error) throw error;
  }
  // Keep the legacy single column pointing at one of the assigned teams.
  await updatePlay(playId, { team_id: teamIds[0] ?? null } as Partial<Play>);
}

export async function createPlay(input: {
  team_id: string | null;
  name: string;
  category: string;
  attack_basket?: "left" | "right";
  team_ids?: string[];
}): Promise<Play> {
  const { team_ids, ...row } = input;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first");
  const { data, error } = await supabase
    .from("plays")
    // The creator owns the play for good: only they can edit this record.
    .insert({ ...row, created_by: auth.user.id } as never)
    .select("*")
    .single();
  if (error) throw error;
  const play = data as unknown as Play;
  const teams = team_ids?.length ? team_ids : row.team_id ? [row.team_id] : [];
  if (teams.length) await setPlayTeams(play.id, teams);
  return play;
}

/**
 * Server-side atomic copy (metadata + every frame) into a play owned by the
 * signed-in coach. Hearts, share token and Library publication are not copied.
 */
export async function duplicatePlay(play: Play, name?: string): Promise<Play> {
  const teams = await fetchTeamsForPlay(play.id);
  const { data, error } = await supabase.rpc("copy_play_for_me", {
    _play: play.id,
    _name: name ?? `${play.name} (copy)`,
    ...(teams.length ? { _team_ids: teams } : {}),
  });
  if (error) throw error;
  return await fetchPlay(data as string);
}



export async function deletePlay(id: string) {
  const { error } = await supabase.from("plays").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- accounts & organizations ---------------- */

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  org_id: string | null;
};

export async function fetchProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,org_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as unknown as Profile;
  // Older accounts may predate the profile trigger — create the row on demand.
  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({ id: auth.user.id, email: auth.user.email ?? null })
    .select("id,email,full_name,org_id")
    .single();
  if (insErr) throw insErr;
  return created as unknown as Profile;
}

export async function updateProfile(patch: { full_name?: string | null }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await supabase.from("profiles").update(patch).eq("id", auth.user.id);
  if (error) throw error;
}

export async function fetchOrg(orgId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as { id: string; name: string }) ?? null;
}

export async function updateOrg(orgId: string, patch: { name: string }) {
  const { error } = await supabase.from("organizations").update(patch).eq("id", orgId);
  if (error) throw error;
}

export async function fetchMyRole(): Promise<CoachRole | null> {
  const { data, error } = await supabase.rpc("my_role");
  if (error) throw error;
  return (data as CoachRole | null) ?? null;
}

export type OrgMemberWithProfile = OrgMember & {
  email: string | null;
  full_name: string | null;
};

export async function fetchOrgMembers(orgId: string): Promise<OrgMemberWithProfile[]> {
  const [{ data: members, error }, { data: profiles, error: pErr }] = await Promise.all([
    supabase.from("org_members").select("*").eq("org_id", orgId).order("created_at"),
    supabase.from("profiles").select("id,email,full_name").eq("org_id", orgId),
  ]);
  if (error) throw error;
  if (pErr) throw pErr;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return ((members ?? []) as unknown as OrgMember[]).map((m) => ({
    ...m,
    email: byId.get(m.user_id)?.email ?? null,
    full_name: byId.get(m.user_id)?.full_name ?? null,
  }));
}

export async function fetchInvites(orgId: string): Promise<CoachInvite[]> {
  const { data, error } = await supabase
    .from("coach_invites")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CoachInvite[];
}

export async function createInvite(input: {
  org_id: string;
  team_id: string | null;
  email: string;
  role: CoachRole;
}): Promise<CoachInvite> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("coach_invites")
    .insert({ ...input, invited_by: auth.user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as CoachInvite;
}

export async function revokeInvite(id: string) {
  const { error } = await supabase.from("coach_invites").delete().eq("id", id);
  if (error) throw error;
}

export type InviteLookup = {
  org_name: string;
  team_name: string | null;
  role: CoachRole;
  email: string;
  status: "pending" | "accepted" | "expired";
};

export async function lookupInvite(token: string): Promise<InviteLookup | null> {
  const { data, error } = await supabase.rpc("get_invite", { _token: token });
  if (error) throw error;
  const row = (data as unknown as InviteLookup[] | null)?.[0];
  return row ?? null;
}

export async function acceptInvite(token: string) {
  const { data, error } = await supabase.rpc("accept_invite", { _token: token });
  if (error) throw error;
  return data as { org_id: string; role: CoachRole; team_id: string | null };
}

export function inviteUrl(token: string) {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

/* ---------------- team management ---------------- */

export async function createTeam(input: { name: string; season: string; orgId: string | null }) {
  const { data, error } = await supabase
    .from("teams")
    .insert({ name: input.name, season: input.season, org_id: input.orgId })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Team;
}

export async function updateTeam(
  id: string,
  patch: Partial<
    Pick<
      Team,
      | "name"
      | "season"
      | "logo_url"
      | "head_coach_name"
      | "assistant_coaches"
      | "default_periods"
      | "default_period_minutes"
      | "default_overtime_minutes"
      | "home_gym"
      | "default_practice_location"
      | "default_arrival_offset_minutes"
      | "default_game_reminder_minutes"
      | "default_practice_reminder_minutes"
      | "timezone"
      | "allow_player_posting"
      | "require_ack_default"
      | "org_id"
    >
  >,
) {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) throw error;
}

export async function uploadTeamLogo(teamId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${teamId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("team-logos")
    .upload(path, file, {
      upsert: true,
      ...(file.type ? { contentType: file.type } : {}),
    });
  if (error) throw error;
  await updateTeam(teamId, { logo_url: path });
  return path;
}

/** Signed URL for a stored logo path (bucket is private). */
export async function logoSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage.from("team-logos").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function updatePlayer(
  id: string,
  patch: Partial<Pick<Player, "jersey" | "name" | "position" | "active" | "team_id">>,
) {
  const { error } = await supabase.from("players").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createPlayer(input: {
  team_id: string;
  jersey: string;
  name: string;
  position: string | null;
}): Promise<Player> {
  const { data, error } = await supabase.from("players").insert(input).select("*").single();
  if (error) throw error;
  return data as unknown as Player;
}

/* ---------------- locker room (team share link + calendar) ---------------- */

export async function setLockerSharing(teamId: string, enabled: boolean) {
  const { error } = await supabase
    .from("teams")
    .update({ locker_enabled: enabled })
    .eq("id", teamId);
  if (error) throw error;
}

/** New opaque token for the public parent page; the old link stops working. */
export async function resetLockerToken(teamId: string) {
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase
    .from("teams")
    .update({ locker_token: token, locker_enabled: true })
    .eq("id", teamId);
  if (error) throw error;
  return token;
}

export function lockerUrl(token: string | null | undefined) {
  const path = `/locker/${token ?? ""}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function lockerCalendarUrl(token: string | null | undefined) {
  const path = `/api/public/locker/${token ?? ""}/calendar`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export async function fetchTeamEvents(teamId: string): Promise<TeamEvent[]> {
  const { data, error } = await supabase
    .from("team_events")
    .select("*")
    .eq("team_id", teamId)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as unknown as TeamEvent[];
}

export async function fetchAllTeamEvents(): Promise<TeamEvent[]> {
  const { data, error } = await supabase.from("team_events").select("*").order("starts_at");
  if (error) throw error;
  return (data ?? []) as unknown as TeamEvent[];
}

export type NewTeamEvent = {
  team_id: string;
  event_type: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  opponent?: string | null;
  home_away?: string | null;
  arrival_at?: string | null;
  uniform?: string | null;
  visibility?: string;
  timezone?: string | null;
};

export async function createTeamEvent(input: NewTeamEvent): Promise<TeamEvent> {
  const { data: auth } = await supabase.auth.getUser();
  const row = {
    ...input,
    kind:
      input.event_type === "game" || input.event_type === "practice" ? input.event_type : "event",
    created_by: auth.user?.id ?? null,
    last_modified_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("team_events").insert(row).select("*").single();
  if (error) throw error;
  const created = data as unknown as TeamEvent;
  alertTeam({
    teamId: created.team_id,
    kind: created.event_type === "game" ? "game" : "schedule",
    title: `New on the schedule: ${created.title}`,
    body: `${new Date(created.starts_at).toLocaleString()}${created.location ? ` · ${created.location}` : ""}`,
    link: "/calendar",
    relatedId: created.id,
  });
  return created;
}

/** Only a real change to when/where/whether it happens is worth an alert. */
const SCHEDULE_FIELDS = ["starts_at", "ends_at", "location", "status", "arrival_at"] as const;

export async function updateTeamEvent(id: string, patch: Partial<TeamEvent>) {
  const next = { ...patch, last_modified_at: new Date().toISOString() };
  if (patch.event_type) {
    next.kind =
      patch.event_type === "game" || patch.event_type === "practice" ? patch.event_type : "event";
  }
  const { data: before } = await supabase
    .from("team_events")
    .select("team_id, title, starts_at, ends_at, location, status, arrival_at, event_type")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("team_events").update(next as never).eq("id", id);
  if (error) throw error;

  const prev = before as unknown as TeamEvent | null;
  if (!prev) return;
  const meaningful = SCHEDULE_FIELDS.some(
    (f) => patch[f] !== undefined && patch[f] !== prev[f],
  );
  if (!meaningful) return;
  const when = new Date((patch.starts_at ?? prev.starts_at) as string).toLocaleString();
  alertTeam({
    teamId: prev.team_id,
    kind: "schedule",
    title: `Schedule change: ${patch.title ?? prev.title}`,
    body:
      (patch.status ?? prev.status) === "cancelled"
        ? "This has been cancelled."
        : `Now ${when}${patch.location ?? prev.location ? ` · ${patch.location ?? prev.location}` : ""}`,
    link: "/calendar",
  });
}

export async function deleteTeamEvent(id: string) {
  const { data: before } = await supabase
    .from("team_events")
    .select("team_id, title")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("team_events").delete().eq("id", id);
  if (error) throw error;
  const prev = before as unknown as { team_id: string; title: string } | null;
  if (prev) {
    alertTeam({
      teamId: prev.team_id,
      kind: "schedule",
      title: `Removed from the schedule: ${prev.title}`,
      body: "Check the CoachSide calendar for the latest schedule.",
      link: "/calendar",
    });
  }
}


/* ---------------- reminders ---------------- */

export async function fetchReminders(eventIds: string[]): Promise<EventReminder[]> {
  if (!eventIds.length) return [];
  const { data, error } = await supabase
    .from("event_reminders")
    .select("*")
    .in("event_id", eventIds);
  if (error) throw error;
  return (data ?? []) as unknown as EventReminder[];
}

export async function createReminders(
  eventId: string,
  reminders: { reminder_type: string; minutes_before: number | null; fixed_time: string | null }[],
) {
  if (!reminders.length) return;
  const rows = reminders.map((r) => ({ ...r, event_id: eventId, delivery_method: "app" }));
  const { error } = await supabase.from("event_reminders").insert(rows);
  if (error) throw error;
}

export async function replaceReminders(
  eventId: string,
  reminders: { reminder_type: string; minutes_before: number | null; fixed_time: string | null }[],
) {
  const { error } = await supabase.from("event_reminders").delete().eq("event_id", eventId);
  if (error) throw error;
  await createReminders(eventId, reminders);
}

/* ---------------- calendar connection & mappings ---------------- */

export async function fetchCalendarConnection(): Promise<CalendarConnection | null> {
  const { data, error } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("provider", "google")
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CalendarConnection) ?? null;
}

export async function saveCalendarConnection(input: {
  provider_account_email: string | null;
  sync_direction: string;
  enabled: boolean;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in first");
  const { error } = await supabase
    .from("calendar_connections")
    .upsert({ ...input, user_id: uid, provider: "google" }, { onConflict: "user_id,provider" });
  if (error) throw error;
}

export async function deleteCalendarConnection() {
  const { error } = await supabase.from("calendar_connections").delete().eq("provider", "google");
  if (error) throw error;
}

export async function fetchCalendarMappings(): Promise<CalendarMapping[]> {
  const { data, error } = await supabase.from("calendar_mappings").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as CalendarMapping[];
}

export async function saveCalendarMapping(input: {
  team_id: string;
  provider_calendar_id: string;
  provider_calendar_name: string | null;
  sync_direction: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in first");
  const { error } = await supabase
    .from("calendar_mappings")
    .upsert(
      { ...input, user_id: uid, provider: "google" },
      { onConflict: "team_id,user_id,provider" },
    );
  if (error) throw error;
}

export async function deleteCalendarMapping(teamId: string) {
  const { error } = await supabase
    .from("calendar_mappings")
    .delete()
    .eq("team_id", teamId)
    .eq("provider", "google");
  if (error) throw error;
}
