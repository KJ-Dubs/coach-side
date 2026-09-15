import { supabase } from "@/integrations/supabase/client";
import type { Play } from "./types";

/**
 * The CoachSide Library is a set of plays their owners explicitly published.
 * A published play stays one canonical row: other coaches link it to their own
 * teams instead of copying it, and the version they linked is recorded so a
 * later edit by the author never silently changes what a team was taught.
 */
export async function fetchLibraryPlays(): Promise<Play[]> {
  const { data, error } = await supabase
    .from("plays")
    .select("*")
    .eq("published_to_library", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Play[];
}

export async function publishPlay(play: Play, authorName: string | null, anonymous = false) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("plays")
    .update({
      published_to_library: true,
      published_at: new Date().toISOString(),
      published_by: auth.user?.id ?? null,
      library_author_name: authorName,
      publish_anonymous: anonymous,
      library_version: (play.library_version ?? 1) + (play.published_to_library ? 1 : 0),
    } as never)
    .eq("id", play.id);
  if (error) throw error;
}

/** Flip attribution between the coach's public handle and Anonymous Coach. */
export async function setPlayAnonymous(playId: string, anonymous: boolean) {
  const { error } = await supabase
    .from("plays")
    .update({ publish_anonymous: anonymous } as never)
    .eq("id", playId);
  if (error) throw error;
}

export async function unpublishPlay(playId: string) {
  const { error } = await supabase
    .from("plays")
    .update({ published_to_library: false } as never)
    .eq("id", playId);
  if (error) throw error;
}

/** Link a published library play to one or more teams the coach runs. */
export async function addLibraryPlayToTeams(play: Play, teamIds: string[]) {
  if (!teamIds.length) throw new Error("Pick at least one team");
  const { data: auth } = await supabase.auth.getUser();
  const { data: existing, error: exErr } = await supabase
    .from("play_team_assignments")
    .select("team_id")
    .eq("play_id", play.id)
    .in("team_id", teamIds);
  if (exErr) throw exErr;
  const have = new Set((existing ?? []).map((r) => (r as { team_id: string }).team_id));
  const rows = teamIds
    .filter((t) => !have.has(t))
    .map((team_id) => ({
      play_id: play.id,
      team_id,
      assigned_by: auth.user?.id ?? null,
      library_version: play.library_version ?? 1,
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("play_team_assignments").insert(rows as never);
  if (error) throw error;
}
