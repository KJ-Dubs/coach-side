import { supabase } from "@/integrations/supabase/client";
import type { Play, PlayFrame } from "./types";

/**
 * The public side of CoachSide: the published play Library, hearts, coach
 * handles and follows.
 *
 * Everything public goes through database functions that only ever return
 * published plays and public creator fields, so a signed-out visitor can
 * browse without any table being exposed to them.
 */

export type LibraryPlay = {
  id: string;
  name: string;
  category: string;
  attack_basket: string;
  share_token: string | null;
  published_at: string | null;
  library_version: number;
  author_label: string;
  creator_username: string | null;
  hearts: number;
  hearts_recent: number;
  featured: boolean;
  situation: string | null;
  defense_faced: string | null;
  outcome: string | null;
  primary_actions: string[];
  time_pressure: string | null;
  tags: string[];
};

export type LibrarySort = "featured" | "trending" | "top" | "new";

export const LIBRARY_SORTS: { key: LibrarySort; label: string; hint: string }[] = [
  { key: "featured", label: "Featured", hint: "Play of the Day first, then the newest plays" },
  { key: "trending", label: "Trending", hint: "Most hearts in the last 14 days" },
  { key: "top", label: "Top", hint: "Most hearts of all time" },
  { key: "new", label: "New", hint: "Most recently published" },
];

function row(r: Record<string, unknown>): LibraryPlay {
  return {
    id: String(r["id"]),
    name: String(r["name"] ?? "Play"),
    category: String(r["category"] ?? "Offense"),
    attack_basket: String(r["attack_basket"] ?? "right"),
    share_token: (r["share_token"] as string | null) ?? null,
    published_at: (r["published_at"] as string | null) ?? null,
    library_version: Number(r["library_version"] ?? 1),
    author_label: String(r["author_label"] ?? "CoachSide Coach"),
    creator_username: (r["creator_username"] as string | null) ?? null,
    hearts: Number(r["hearts"] ?? 0),
    hearts_recent: Number(r["hearts_recent"] ?? 0),
    featured: !!r["featured"],
    situation: (r["situation"] as string | null) ?? null,
    defense_faced: (r["defense_faced"] as string | null) ?? null,
    outcome: (r["outcome"] as string | null) ?? null,
    primary_actions: (r["primary_actions"] as string[] | null) ?? [],
    time_pressure: (r["time_pressure"] as string | null) ?? null,
    tags: (r["tags"] as string[] | null) ?? [],
  };
}

export async function fetchLibraryFeed(creator?: string | null): Promise<LibraryPlay[]> {
  const { data, error } = await supabase.rpc("library_feed" as never, {
    _creator: creator ?? null,
  } as never);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(row);
}

/**
 * Trending deliberately uses a plain, explainable rule: hearts collected in
 * the last two weeks, with lifetime hearts only breaking ties.
 */
export function sortLibrary(list: LibraryPlay[], sort: LibrarySort): LibraryPlay[] {
  const copy = [...list];
  const newest = (p: LibraryPlay) => (p.published_at ? Date.parse(p.published_at) : 0);
  switch (sort) {
    case "trending":
      return copy.sort(
        (a, b) => b.hearts_recent - a.hearts_recent || b.hearts - a.hearts || newest(b) - newest(a),
      );
    case "top":
      return copy.sort((a, b) => b.hearts - a.hearts || newest(b) - newest(a));
    case "new":
      return copy.sort((a, b) => newest(b) - newest(a));
    default:
      return copy.sort(
        (a, b) => Number(b.featured) - Number(a.featured) || newest(b) - newest(a),
      );
  }
}

export async function fetchPlayOfTheDay(): Promise<LibraryPlay | null> {
  const list = await fetchLibraryFeed();
  return list.find((p) => p.featured) ?? null;
}

export async function fetchPublicFrames(playId: string): Promise<PlayFrame[]> {
  const { data, error } = await supabase.rpc("public_play_frames" as never, {
    _play: playId,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as PlayFrame[];
}

export async function fetchMyHearts(): Promise<string[]> {
  const { data, error } = await supabase.rpc("my_hearted_plays" as never);
  if (error) throw error;
  const rows = (data ?? []) as unknown[];
  return rows.map((r) => (typeof r === "string" ? r : String((r as { play_id?: string }).play_id)));
}

export async function togglePlayHeart(playId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("toggle_play_heart" as never, {
    _play: playId,
  } as never);
  if (error) throw error;
  return !!data;
}

export type CreatorProfile = {
  username: string;
  display_name: string;
  bio: string | null;
  published_plays: number;
  total_hearts: number;
  followers: number;
};

export async function fetchCreatorProfile(username: string): Promise<CreatorProfile | null> {
  const { data, error } = await supabase.rpc("creator_profile" as never, {
    _username: username,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as CreatorProfile[];
  return rows[0] ?? null;
}

export type FollowedCreator = {
  username: string;
  display_name: string;
  published_plays: number;
};

export async function fetchMyFollowedCreators(): Promise<FollowedCreator[]> {
  const { data, error } = await supabase.rpc("my_followed_creators" as never);
  if (error) throw error;
  return (data ?? []) as FollowedCreator[];
}

export async function setFollowCreator(username: string, follow: boolean) {
  const { error } = await supabase.rpc("set_follow_creator" as never, {
    _username: username,
    _follow: follow,
  } as never);
  if (error) throw error;
}

export type MyPublicProfile = {
  username: string | null;
  public_display_name: string | null;
  bio: string | null;
};

/** The coach's own public fields. Private email and teams are never public. */
export async function fetchMyPublicProfile(): Promise<MyPublicProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("username, public_display_name, bio")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as MyPublicProfile | null;
}

export async function setMyPublicProfile(input: {
  username: string;
  displayName: string;
  bio: string;
}) {
  const { error } = await supabase.rpc("set_my_username" as never, {
    _username: input.username,
    _display_name: input.displayName,
    _bio: input.bio,
  } as never);
  if (error) throw error;
}

export async function setPlayOfTheDay(playId: string | null) {
  const { error } = await supabase.rpc("set_play_of_the_day" as never, {
    _play: playId,
  } as never);
  if (error) throw error;
}

export async function fetchIsAppAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_app_admin" as never);
  // A transient failure is not a definitive "no" — let callers retry.
  if (error) throw error;
  return data === true;
}

/** A Library row rendered through components that expect a saved play. */
export function libraryPlayAsPlay(p: LibraryPlay): Play {
  return {
    id: p.id,
    team_id: null,
    name: p.name,
    category: p.category,
    attack_basket: p.attack_basket,
    is_shared: !!p.share_token,
    share_token: p.share_token,
    published_to_library: true,
    library_version: p.library_version,
    library_author_name: p.author_label,
  };
}
