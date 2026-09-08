import { supabase } from "@/integrations/supabase/client";

export type NotificationPrefs = {
  id: string;
  user_id: string;
  email_enabled: boolean;
  practice_reminders: boolean;
  game_reminders: boolean;
  new_play_notifications: boolean;
  challenge_notifications: boolean;
  announcement_notifications: boolean;
  assignment_notifications: boolean;
};

export type AppNotification = {
  id: string;
  team_id: string | null;
  type: string;
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: string | null;
  channel: string;
  status: string;
  created_at: string;
  read_at: string | null;
};

export const PREF_LABELS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "email_enabled", label: "Email me" },
  { key: "practice_reminders", label: "Practices" },
  { key: "game_reminders", label: "Games" },
  { key: "new_play_notifications", label: "New plays" },
  { key: "challenge_notifications", label: "Challenges" },
  { key: "announcement_notifications", label: "Announcements" },
  { key: "assignment_notifications", label: "Assignments" },
];

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function fetchNotificationPrefs(): Promise<NotificationPrefs | null> {
  const me = await uid();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", me)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as unknown as NotificationPrefs;
  const { data: created, error: insErr } = await supabase
    .from("notification_preferences")
    .insert({ user_id: me })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created as unknown as NotificationPrefs;
}

export async function updateNotificationPrefs(patch: Partial<NotificationPrefs>) {
  const me = await uid();
  const { error } = await supabase
    .from("notification_preferences")
    .update(patch as never)
    .eq("user_id", me);
  if (error) throw error;
}

export async function fetchMyNotifications(limit = 25): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,team_id,type,title,body,related_type,related_id,channel,status,created_at,read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AppNotification[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
