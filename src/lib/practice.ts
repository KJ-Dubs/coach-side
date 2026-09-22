import { supabase } from "@/integrations/supabase/client";

/** Practice plans: a team, a date, and an ordered list of timed blocks. */

export type PracticePlan = {
  id: string;
  team_id: string;
  created_by: string | null;
  title: string;
  plan_date: string;
  start_time: string | null;
  total_minutes: number;
  shared_to_locker: boolean;
  notes: string | null;
  created_at?: string;
};

export type BlockType = "drill" | "play" | "custom" | "break" | "film" | "conditioning" | "scrimmage" | "free_throws";

export type PracticeBlock = {
  id: string;
  plan_id: string;
  idx: number;
  block_type: BlockType | string;
  ref_id: string | null;
  title: string;
  minutes: number;
  notes: string | null;
  completed: boolean;
};

export const CUSTOM_BLOCKS: { type: BlockType; title: string; minutes: number }[] = [
  { type: "break", title: "Water break", minutes: 3 },
  { type: "film", title: "Film session", minutes: 10 },
  { type: "conditioning", title: "Conditioning", minutes: 8 },
  { type: "scrimmage", title: "Scrimmage", minutes: 15 },
  { type: "free_throws", title: "Free throws", minutes: 5 },
  { type: "custom", title: "Custom block", minutes: 10 },
];

export const BLOCK_LABEL: Record<string, string> = {
  drill: "Drill",
  play: "Play",
  custom: "Custom",
  break: "Break",
  film: "Film",
  conditioning: "Conditioning",
  scrimmage: "Scrimmage",
  free_throws: "Free throws",
};

export async function fetchPracticePlans(teamId?: string | null): Promise<PracticePlan[]> {
  let q = supabase.from("practice_plans").select("*").order("plan_date", { ascending: false });
  if (teamId) q = q.eq("team_id", teamId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PracticePlan[];
}

export async function fetchPracticePlan(id: string): Promise<PracticePlan | null> {
  const { data, error } = await supabase.from("practice_plans").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as PracticePlan) ?? null;
}

export async function createPracticePlan(input: {
  team_id: string;
  title: string;
  plan_date: string;
  start_time?: string | null;
  total_minutes: number;
}): Promise<PracticePlan> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first");
  const { data, error } = await supabase
    .from("practice_plans")
    .insert({ ...input, created_by: auth.user.id } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PracticePlan;
}

export async function updatePracticePlan(id: string, patch: Partial<PracticePlan>) {
  const { error } = await supabase.from("practice_plans").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deletePracticePlan(id: string) {
  const { error } = await supabase.from("practice_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPracticeBlocks(planId: string): Promise<PracticeBlock[]> {
  const { data, error } = await supabase
    .from("practice_plan_blocks")
    .select("*")
    .eq("plan_id", planId)
    .order("idx");
  if (error) throw error;
  return (data ?? []) as unknown as PracticeBlock[];
}

export async function savePracticeBlocks(
  planId: string,
  blocks: Pick<PracticeBlock, "block_type" | "ref_id" | "title" | "minutes" | "notes" | "completed">[],
) {
  const { error: delError } = await supabase.from("practice_plan_blocks").delete().eq("plan_id", planId);
  if (delError) throw delError;
  if (!blocks.length) return;
  const rows = blocks.map((b, i) => ({ ...b, plan_id: planId, idx: i }));
  const { error } = await supabase.from("practice_plan_blocks").insert(rows as never);
  if (error) throw error;
}
