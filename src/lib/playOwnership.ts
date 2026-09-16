import { supabase } from "@/integrations/supabase/client";
import type { Play } from "./types";

/**
 * Plays are owned by the coach who created them. Nobody else — team mate,
 * program head coach or app admin — may edit that exact record. Other coaches
 * make their own version instead, which is a fresh play they own outright.
 */

export function isPlayOwner(play: Pick<Play, "created_by">, userId: string | null | undefined) {
  return !!userId && !!play.created_by && play.created_by === userId;
}

/** Legacy rows we could not safely attribute stay read-only for everyone. */
export function isUnclaimedPlay(play: Pick<Play, "created_by">) {
  return !play.created_by;
}

function prettyUsername(username: string) {
  return username
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatCoachLabel(
  p: { public_display_name?: string | null; full_name?: string | null; username?: string | null } | null,
): string | null {
  if (!p) return null;
  const raw =
    p.public_display_name?.trim() ||
    p.full_name?.trim() ||
    (p.username ? prettyUsername(p.username) : "");
  if (!raw) return null;
  return /^coach\b/i.test(raw) ? raw : `Coach ${raw}`;
}

/** Display name for the signed-in coach, used when naming their version. */
export async function fetchMyCoachLabel(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("public_display_name,full_name,username")
    .eq("id", auth.user.id)
    .maybeSingle();
  return formatCoachLabel(data as never);
}

/** Public-safe label for another coach (never exposes email). */
export async function fetchCoachLabel(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase.rpc("play_author_label", { _user: userId });
  if (error) return null;
  const raw = (data as string | null)?.trim();
  if (!raw) return null;
  return /^coach\b/i.test(raw) ? raw : `Coach ${raw}`;
}

/** "Wheel — Coach A Version" edited by Coach B becomes "Wheel — Coach Bob Version". */
export function versionTitle(sourceName: string, coachLabel: string | null) {
  const root = sourceName.replace(/\s*[—–-]\s*.+?\s+Version\s*$/i, "").trim() || sourceName.trim();
  return coachLabel ? `${root} — ${coachLabel} Version` : `${root} — My Version`;
}

/** Atomic server-side copy: metadata + every frame, owned by the caller. */
export async function copyPlayForMe(input: {
  playId: string;
  name: string;
  teamIds?: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("copy_play_for_me", {
    _play: input.playId,
    _name: input.name,
    ...(input.teamIds?.length ? { _team_ids: input.teamIds } : {}),
  });
  if (error) throw error;
  if (!data) throw new Error("Could not create your version");
  return data as string;
}
