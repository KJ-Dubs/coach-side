import { supabase } from "@/integrations/supabase/client";
import type {
  CoachInvite,
  CoachRole,
  Game,
  GameEvent,
  OrgMember,
  Play,
  PlayFrame,
  Player,
  Substitution,
  Team,
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

export async function createPlay(input: {
  team_id: string | null;
  name: string;
  category: string;
  attack_basket?: "left" | "right";
}): Promise<Play> {
  const { data, error } = await supabase
    .from("plays")
    .insert(input as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Play;
}

export async function duplicatePlay(play: Play): Promise<Play> {
  const copy = await createPlay({
    team_id: play.team_id,
    name: `${play.name} (copy)`,
    category: play.category,
    attack_basket: play.attack_basket === "left" ? "left" : "right",
  });
  const frames = await fetchFrames(play.id);
  if (frames.length) {
    const rows = frames.map((f, i) => ({
      play_id: copy.id,
      idx: i,
      tokens: f.tokens as never,
      actions: f.actions as never,
      note: f.note,
    }));
    const { error } = await supabase.from("play_frames").insert(rows as never);
    if (error) throw error;
  }
  return copy;
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
