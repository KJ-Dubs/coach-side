import { supabase } from "@/integrations/supabase/client";
import type { PlayAction, PlayToken } from "./types";

/**
 * Drills are their own thing, not plays: they carry teaching metadata
 * (skill, players, time, equipment) plus a court diagram drawn with the same
 * engine the Playmaker uses.
 */

export const DRILL_CATEGORIES = [
  "Shooting",
  "Finishing",
  "Ball Handling",
  "Passing",
  "Defense",
  "Rebounding",
  "Transition",
  "Free Throws",
  "Conditioning",
] as const;

export const SKILL_FOCUS = [
  "shooting",
  "finishing",
  "handling",
  "passing",
  "footwork",
  "closeout",
  "team defense",
  "off-ball defense",
  "rebounding",
  "transition",
  "post play",
  "decision making",
  "conditioning",
] as const;

export const GROUP_SIZES = ["Individual", "Pairs", "Small group", "Team"] as const;
export const DIFFICULTIES = ["Beginner", "All levels", "Intermediate", "Advanced"] as const;
export const DRILL_STYLES = ["individual", "team", "competitive"] as const;
export const EQUIPMENT_OPTIONS = [
  "1 ball",
  "2 balls",
  "1 ball per pair",
  "1 ball per group",
  "3 cones",
  "4 cones",
  "2 chairs",
  "1 pad",
  "1 passer",
] as const;

export type DrillObject = {
  id: string;
  type: "cone" | "chair" | "spot" | "ball" | "line" | "text";
  x: number;
  y: number;
  label?: string;
};

export type Drill = {
  id: string;
  created_by: string | null;
  team_id: string | null;
  name: string;
  category: string;
  skill_focus: string[];
  group_size: string;
  court_orientation: string;
  equipment: string[];
  duration_minutes: number;
  repetitions: string | null;
  instructions: string;
  coaching_points: string | null;
  scoring_rules: string | null;
  difficulty: string;
  style: string;
  tags: string[];
  published_to_library: boolean;
  published_at: string | null;
  library_author_name: string | null;
  creator_username: string | null;
  hearts: number;
  source_drill_id?: string | null;
  created_at?: string;
};

export type DrillFrame = {
  id: string;
  drill_id: string;
  idx: number;
  tokens: PlayToken[];
  actions: PlayAction[];
  objects: DrillObject[];
  note: string | null;
};

const SELECT = "*";

export async function fetchDrillLibrary(): Promise<Drill[]> {
  const { data, error } = await supabase
    .from("drills")
    .select(SELECT)
    .eq("published_to_library", true)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Drill[];
}

export async function fetchMyDrills(): Promise<Drill[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("drills")
    .select(SELECT)
    .eq("created_by", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Drill[];
}

export async function fetchDrill(id: string): Promise<Drill | null> {
  const { data, error } = await supabase.from("drills").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Drill) ?? null;
}

export async function fetchDrillFrames(drillId: string): Promise<DrillFrame[]> {
  const { data, error } = await supabase
    .from("drill_frames")
    .select("*")
    .eq("drill_id", drillId)
    .order("idx");
  if (error) throw error;
  return (data ?? []) as unknown as DrillFrame[];
}

export async function createDrill(input: Partial<Drill> & { name: string }): Promise<Drill> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first");
  const { data, error } = await supabase
    .from("drills")
    .insert({ ...input, created_by: auth.user.id } as never)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Drill;
}

export async function updateDrill(id: string, patch: Partial<Drill>) {
  const { error } = await supabase.from("drills").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteDrill(id: string) {
  const { error } = await supabase.from("drills").delete().eq("id", id);
  if (error) throw error;
}

export async function saveDrillFrames(drillId: string, frames: Omit<DrillFrame, "id" | "drill_id">[]) {
  const { error: delError } = await supabase.from("drill_frames").delete().eq("drill_id", drillId);
  if (delError) throw delError;
  if (!frames.length) return;
  const rows = frames.map((f, i) => ({
    drill_id: drillId,
    idx: i,
    tokens: f.tokens as never,
    actions: f.actions as never,
    objects: f.objects as never,
    note: f.note,
  }));
  const { error } = await supabase.from("drill_frames").insert(rows as never);
  if (error) throw error;
}

export async function toggleDrillHeart(drillId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("toggle_drill_heart" as never, {
    _drill: drillId,
  } as never);
  if (error) throw error;
  return !!data;
}

export async function fetchMyDrillHearts(): Promise<string[]> {
  const { data, error } = await supabase.rpc("my_hearted_drills" as never);
  if (error) return [];
  const rows = (data ?? []) as unknown[];
  return rows.map((r) => (typeof r === "string" ? r : String((r as { drill_id?: string }).drill_id)));
}

export async function copyDrillForMe(drillId: string, name?: string): Promise<string> {
  const { data, error } = await supabase.rpc("copy_drill_for_me" as never, {
    _drill: drillId,
    _name: name ?? null,
  } as never);
  if (error) throw error;
  return String(data);
}
