import { supabase } from "@/integrations/supabase/client";

/* =============== types =============== */

export type TeamRole = "head_coach" | "assistant_coach" | "player" | "parent";

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  head_coach: "Head Coach",
  assistant_coach: "Assistant Coach",
  player: "Player",
  parent: "Parent / Guardian",
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  player_id: string | null;
  active: boolean;
};

export type TeamInvite = {
  id: string;
  team_id: string;
  invite_type: "player" | "parent";
  token: string;
  active: boolean;
  created_at: string;
};

export type DirectoryEntry = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: TeamRole;
  player_id: string | null;
  jersey: string | null;
  player_name: string | null;
};

/** Every object a message / assignment can point at. Video types exist in the
 *  data model already so clips can be attached later with no schema change. */
export type AttachmentType =
  | "play"
  | "event"
  | "game"
  | "stat"
  | "resource"
  | "full_game_video"
  | "video_clip"
  | "drill_video"
  | "coach_video"
  | "game_timestamp_clip";

export type Attachment = {
  id: string;
  attachment_type: AttachmentType;
  related_id: string | null;
  metadata: Record<string, unknown>;
};

export type NewAttachment = {
  attachment_type: AttachmentType;
  related_id: string | null;
  metadata?: Record<string, unknown>;
};

export type Reaction = { id: string; user_id: string; reaction: string };

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  attachments: Attachment[];
  reactions: Reaction[];
};

export type ConversationType = "team" | "staff" | "direct";

export type Announcement = {
  id: string;
  team_id: string;
  created_by: string | null;
  audience: "players" | "parents" | "coaches" | "everyone";
  title: string;
  body: string;
  pinned: boolean;
  require_acknowledgment: boolean;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
};

export type AnnouncementReceipt = {
  id: string;
  announcement_id: string;
  user_id: string;
  viewed_at: string | null;
  acknowledged_at: string | null;
};

export type AssignmentType = "play" | "event" | "resource" | "task" | "video_review";

export type Assignment = {
  id: string;
  team_id: string;
  created_by: string | null;
  assignment_type: AssignmentType;
  title: string;
  instructions: string | null;
  due_at: string | null;
  linked_type: string | null;
  linked_id: string | null;
  created_at: string;
};

export type AssignmentStatus = "not_viewed" | "viewed" | "acknowledged" | "completed";

export type AssignmentTarget = {
  id: string;
  assignment_id: string;
  user_id: string | null;
  player_id: string | null;
  status: AssignmentStatus;
  viewed_at: string | null;
  completed_at: string | null;
};

export type TeamResource = {
  id: string;
  team_id: string;
  title: string;
  body: string | null;
  url: string | null;
  category: string;
  audience: "players" | "parents" | "coaches" | "everyone";
  created_at: string;
};

export const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "players", label: "Players" },
  { value: "parents", label: "Parents" },
  { value: "coaches", label: "Coaches" },
] as const;

export function isCoachRole(role: TeamRole | null | undefined) {
  return role === "head_coach" || role === "assistant_coach";
}

/* =============== membership & invites =============== */

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function fetchMyMemberships(): Promise<TeamMember[]> {
  const me = await uid();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("user_id", me)
    .eq("active", true);
  if (error) throw error;
  return (data ?? []) as unknown as TeamMember[];
}

export async function fetchTeamDirectory(teamId: string): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase.rpc("team_directory", { _team: teamId });
  if (error) throw error;
  return (data ?? []) as unknown as DirectoryEntry[];
}

export async function fetchTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from("team_invites")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TeamInvite[];
}

/** One live link per type; creates it the first time a coach asks for it. */
export async function ensureTeamInvite(
  teamId: string,
  type: "player" | "parent",
): Promise<TeamInvite> {
  const all = await fetchTeamInvites(teamId);
  const live = all.find((i) => i.invite_type === type && i.active);
  if (live) return live;
  const me = await uid();
  const { data, error } = await supabase
    .from("team_invites")
    .insert({ team_id: teamId, invite_type: type, created_by: me })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as TeamInvite;
}

export async function rotateTeamInvite(teamId: string, type: "player" | "parent") {
  await revokeTeamInvites(teamId, type);
  return ensureTeamInvite(teamId, type);
}

export async function revokeTeamInvites(teamId: string, type: "player" | "parent") {
  const { error } = await supabase
    .from("team_invites")
    .update({ active: false })
    .eq("team_id", teamId)
    .eq("invite_type", type)
    .eq("active", true);
  if (error) throw error;
}

export function joinUrl(token: string) {
  if (typeof window === "undefined") return `/join/${token}`;
  return `${window.location.origin}/join/${token}`;
}

export type TeamInviteLookup = {
  team_id: string;
  team_name: string;
  season: string;
  invite_type: "player" | "parent";
  status: "active" | "revoked" | "expired";
};

export async function lookupTeamInvite(token: string): Promise<TeamInviteLookup | null> {
  const { data, error } = await supabase.rpc("get_team_invite", { _token: token });
  if (error) throw error;
  return ((data as unknown as TeamInviteLookup[] | null) ?? [])[0] ?? null;
}

export type InviteRosterRow = { id: string; jersey: string; name: string; taken: boolean };

export async function fetchInviteRoster(token: string): Promise<InviteRosterRow[]> {
  const { data, error } = await supabase.rpc("invite_roster", { _token: token });
  if (error) throw error;
  return (data ?? []) as unknown as InviteRosterRow[];
}

export async function acceptTeamInvite(token: string, playerId: string | null) {
  const { data, error } = await supabase.rpc("accept_team_invite", {
    _token: token,
    _player_id: playerId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as { team_id: string; role: TeamRole };
}

export async function removeTeamMember(teamId: string, userId: string) {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) throw error;
}

/* =============== conversations & messages =============== */

export async function ensureConversation(teamId: string, type: "team" | "staff"): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_team_conversation", {
    _team: teamId,
    _type: type,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function ensureDirectConversation(teamId: string, otherUserId: string) {
  const { data, error } = await supabase.rpc("ensure_direct_conversation", {
    _team: teamId,
    _other: otherUserId,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function fetchDirectConversations(teamId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, conversation_members(user_id)")
    .eq("team_id", teamId)
    .eq("type", "direct");
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    title: string | null;
    created_at: string;
    conversation_members: { user_id: string }[];
  }[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*, message_attachments(*), message_reactions(*)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as Message),
    attachments: (row["message_attachments"] ?? []) as Attachment[],
    reactions: (row["message_reactions"] ?? []) as Reaction[],
  }));
}

export async function sendMessage(input: {
  conversationId: string;
  body: string;
  attachments?: NewAttachment[];
}) {
  const me = await uid();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: input.conversationId, sender_id: me, body: input.body })
    .select("id")
    .single();
  if (error) throw error;
  const messageId = (data as { id: string }).id;
  if (input.attachments?.length) {
    const { error: aErr } = await supabase.from("message_attachments").insert(
      input.attachments.map((a) => ({
        message_id: messageId,
        attachment_type: a.attachment_type,
        related_id: a.related_id,
        metadata: (a.metadata ?? {}) as never,
      })),
    );
    if (aErr) throw aErr;
  }
  return messageId;
}

export async function editMessage(id: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase
    .from("messages")
    .update({ body: "", deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, reaction: string, mine: boolean) {
  const me = await uid();
  if (mine) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", me)
      .eq("reaction", reaction);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: me, reaction });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string) {
  const me = await uid();
  const { error } = await supabase.from("conversation_members").upsert(
    { conversation_id: conversationId, user_id: me, last_read_at: new Date().toISOString() },
    { onConflict: "conversation_id,user_id" },
  );
  if (error) throw error;
}

export async function fetchMyConversationState(conversationId: string) {
  const me = await uid();
  const { data, error } = await supabase
    .from("conversation_members")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", me)
    .maybeSingle();
  if (error) throw error;
  return (data as { last_read_at: string | null } | null) ?? null;
}

/* =============== announcements =============== */

export async function fetchAnnouncements(teamId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*, announcement_attachments(*)")
    .eq("team_id", teamId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as Announcement),
    attachments: (row["announcement_attachments"] ?? []) as Attachment[],
  }));
}

export async function createAnnouncement(input: {
  team_id: string;
  audience: Announcement["audience"];
  title: string;
  body: string;
  require_acknowledgment: boolean;
  pinned?: boolean;
  attachments?: NewAttachment[];
}) {
  const me = await uid();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      team_id: input.team_id,
      audience: input.audience,
      title: input.title,
      body: input.body,
      require_acknowledgment: input.require_acknowledgment,
      pinned: input.pinned ?? false,
      created_by: me,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  if (input.attachments?.length) {
    const { error: aErr } = await supabase.from("announcement_attachments").insert(
      input.attachments.map((a) => ({
        announcement_id: id,
        attachment_type: a.attachment_type,
        related_id: a.related_id,
        metadata: (a.metadata ?? {}) as never,
      })),
    );
    if (aErr) throw aErr;
  }
  return id;
}

export async function setAnnouncementPinned(id: string, pinned: boolean) {
  const { error } = await supabase.from("announcements").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchReceipts(announcementIds: string[]): Promise<AnnouncementReceipt[]> {
  if (!announcementIds.length) return [];
  const { data, error } = await supabase
    .from("announcement_receipts")
    .select("*")
    .in("announcement_id", announcementIds);
  if (error) throw error;
  return (data ?? []) as unknown as AnnouncementReceipt[];
}

export async function markAnnouncement(
  announcementId: string,
  patch: { viewed?: boolean; acknowledged?: boolean },
) {
  const me = await uid();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { announcement_id: announcementId, user_id: me };
  if (patch.viewed) row["viewed_at"] = now;
  if (patch.acknowledged) {
    row["acknowledged_at"] = now;
    row["viewed_at"] = now;
  }
  const { error } = await supabase
    .from("announcement_receipts")
    .upsert(row as never, { onConflict: "announcement_id,user_id" });
  if (error) throw error;
}

/* =============== assignments =============== */

export async function fetchAssignments(teamId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Assignment[];
}

export async function fetchAssignmentTargets(ids: string[]): Promise<AssignmentTarget[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("assignment_targets")
    .select("*")
    .in("assignment_id", ids);
  if (error) throw error;
  return (data ?? []) as unknown as AssignmentTarget[];
}

export async function createAssignment(input: {
  team_id: string;
  assignment_type: AssignmentType;
  title: string;
  instructions: string | null;
  due_at: string | null;
  linked_type: string | null;
  linked_id: string | null;
  /** roster players the task is for; empty = whole team */
  player_ids: string[];
}) {
  const me = await uid();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      team_id: input.team_id,
      assignment_type: input.assignment_type,
      title: input.title,
      instructions: input.instructions,
      due_at: input.due_at,
      linked_type: input.linked_type,
      linked_id: input.linked_id,
      created_by: me,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  if (input.player_ids.length) {
    const { error: tErr } = await supabase
      .from("assignment_targets")
      .insert(input.player_ids.map((p) => ({ assignment_id: id, player_id: p })));
    if (tErr) throw tErr;
  }
  return id;
}

export async function deleteAssignment(id: string) {
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) throw error;
}

export async function setAssignmentStatus(target: {
  assignmentId: string;
  playerId: string | null;
  status: AssignmentStatus;
}) {
  const me = await uid();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: target.status, viewed_at: now };
  if (target.status === "completed") patch["completed_at"] = now;

  const existing = await supabase
    .from("assignment_targets")
    .select("id")
    .eq("assignment_id", target.assignmentId)
    .or(
      target.playerId
        ? `player_id.eq.${target.playerId},user_id.eq.${me}`
        : `user_id.eq.${me}`,
    )
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from("assignment_targets")
      .update(patch as never)
      .eq("id", (existing.data as { id: string }).id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("assignment_targets").insert({
    assignment_id: target.assignmentId,
    user_id: me,
    player_id: target.playerId,
    ...patch,
  } as never);
  if (error) throw error;
}

/* =============== resources =============== */

export async function fetchResources(teamId: string): Promise<TeamResource[]> {
  const { data, error } = await supabase
    .from("team_resources")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TeamResource[];
}

export async function createResource(input: {
  team_id: string;
  title: string;
  body: string | null;
  url: string | null;
  category: string;
  audience: TeamResource["audience"];
}) {
  const me = await uid();
  const { error } = await supabase.from("team_resources").insert({ ...input, created_by: me });
  if (error) throw error;
}

export async function deleteResource(id: string) {
  const { error } = await supabase.from("team_resources").delete().eq("id", id);
  if (error) throw error;
}
