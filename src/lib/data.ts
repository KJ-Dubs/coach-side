import { supabase } from "@/integrations/supabase/client";
import type {
  Game,
  GameEvent,
  Play,
  PlayFrame,
  Player,
  Substitution,
  Team,
} from "./types";

export const DEMO_TEAM_ID = "11111111-1111-1111-1111-111111111111";

export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as Team[];
}

export async function fetchPlayers(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId)
    .order("jersey");
  if (error) throw error;
  return ((data ?? []) as Player[]).sort(
    (a, b) => Number(a.jersey) - Number(b.jersey) || a.jersey.localeCompare(b.jersey),
  );
}

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("game_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Game[];
}

export async function fetchGame(id: string): Promise<Game> {
  const { data, error } = await supabase.from("games").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Game;
}

export async function fetchEvents(gameId: string): Promise<GameEvent[]> {
  const { data, error } = await supabase
    .from("game_events")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as GameEvent[];
}

export async function fetchSubs(gameId: string): Promise<Substitution[]> {
  const { data, error } = await supabase
    .from("substitutions")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as Substitution[];
}

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
  team_id: string;
  name: string;
  category: string;
}): Promise<Play> {
  const { data, error } = await supabase
    .from("plays")
    .insert(input as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Play;
}

export async function createGame(input: {
  team_id: string;
  opponent: string;
  game_date: string;
  periods: number;
  period_minutes: number;
  starting_five: string[];
}): Promise<Game> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      ...input,
      status: "live",
      quarter: 1,
      clock_seconds: input.period_minutes * 60,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Game;
}
