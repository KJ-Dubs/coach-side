import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  Game,
  GameEvent,
  Play,
  PlayFrame,
  Player,
  Substitution,
  Team,
  TeamEvent,
} from "./types";

const tokenSchema = z.object({ token: z.string().min(6).max(64) });

export type LockerBundle = {
  team: Pick<Team, "id" | "name" | "season" | "head_coach_name" | "assistant_coaches">;
  logoUrl: string | null;
  players: Player[];
  games: Game[];
  events: GameEvent[];
  subs: Substitution[];
  plays: Play[];
  frames: PlayFrame[];
  schedule: TeamEvent[];
  /**
   * The current non-final game for this team, with only the records the coach
   * has actually synced to the server. Never includes unsynced device data.
   */
  live: {
    game: Game;
    events: GameEvent[];
    subs: Substitution[];
    /** Newest synced record timestamp, or the game's own creation time. */
    lastSyncedAt: string;
  } | null;
};

/** Public, token-gated read of everything the Locker Room page shows. */
export const getLockerBundle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<string | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id,name,season,head_coach_name,assistant_coaches,logo_url,locker_enabled")
      .eq("locker_token", data.token)
      .maybeSingle();

    if (!team || !team.locker_enabled) return null;

    const { data: assigned } = await supabaseAdmin
      .from("play_team_assignments")
      .select("play_id")
      .eq("team_id", team.id)
      .eq("is_visible", true);

    const assignedIds = (assigned ?? []).map((a) => (a as { play_id: string }).play_id);

    const [players, games, plays, schedule] = await Promise.all([
      supabaseAdmin.from("players").select("*").eq("team_id", team.id).order("jersey"),
      supabaseAdmin
        .from("games")
        .select("*")
        .eq("team_id", team.id)
        .eq("status", "final")
        .order("game_date", { ascending: false }),
      assignedIds.length
        ? supabaseAdmin
            .from("plays")
            .select("*")
            .in("id", assignedIds)
            .order("created_at", { ascending: false })
        : supabaseAdmin
            .from("plays")
            .select("*")
            .eq("team_id", team.id)
            .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("team_events")
        .select("*")
        .eq("team_id", team.id)
        .order("starts_at", { ascending: true }),
    ]);

    const gameIds = (games.data ?? []).map((g) => g.id);
    const playIds = (plays.data ?? []).map((p) => p.id);


    const [events, subs, frames] = await Promise.all([
      gameIds.length
        ? supabaseAdmin.from("game_events").select("*").in("game_id", gameIds).order("created_at")
        : Promise.resolve({ data: [] }),
      gameIds.length
        ? supabaseAdmin.from("substitutions").select("*").in("game_id", gameIds).order("created_at")
        : Promise.resolve({ data: [] }),
      playIds.length
        ? supabaseAdmin.from("play_frames").select("*").in("play_id", playIds).order("idx")
        : Promise.resolve({ data: [] }),
    ]);

    let logoUrl: string | null = null;
    if (team.logo_url) {
      if (/^https?:\/\//.test(team.logo_url)) {
        logoUrl = team.logo_url;
      } else {
        const signed = await supabaseAdmin.storage
          .from("team-logos")
          .createSignedUrl(team.logo_url, 3600);
        logoUrl = signed.data?.signedUrl ?? null;
      }
    }

    const bundle: LockerBundle = {
      team: {
        id: team.id,
        name: team.name,
        season: team.season,
        head_coach_name: team.head_coach_name,
        assistant_coaches: team.assistant_coaches,
      },
      logoUrl,
      players: (players.data ?? []) as unknown as Player[],
      games: (games.data ?? []) as unknown as Game[],
      events: (events.data ?? []) as unknown as GameEvent[],
      subs: (subs.data ?? []) as unknown as Substitution[],
      plays: (plays.data ?? []) as unknown as Play[],
      frames: (frames.data ?? []) as unknown as PlayFrame[],
      schedule: (schedule.data ?? []) as unknown as TeamEvent[],
    };
    // Serialized as JSON so the transport does not need per-field serializers.
    return JSON.stringify(bundle);
  });
