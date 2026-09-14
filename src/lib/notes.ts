import { supabase } from "@/integrations/supabase/client";

export type CoachNote = {
  id: string;
  body: string;
  completed: boolean;
  created_at: string;
};

/** Private coaching checklist. Rows are scoped to the signed-in coach by RLS. */
export async function fetchCoachNotes(): Promise<CoachNote[]> {
  const { data, error } = await supabase
    .from("coach_notes")
    .select("id,body,completed,created_at")
    .order("completed")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as CoachNote[];
}

export async function addCoachNote(body: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("coach_notes")
    .insert({ body: body.trim(), user_id: auth.user.id } as never);
  if (error) throw error;
}

export async function setCoachNoteDone(id: string, completed: boolean) {
  const { error } = await supabase
    .from("coach_notes")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCoachNote(id: string) {
  const { error } = await supabase.from("coach_notes").delete().eq("id", id);
  if (error) throw error;
}
