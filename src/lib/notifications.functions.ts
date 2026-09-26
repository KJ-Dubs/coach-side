/**
 * Notification server functions used by signed-in coaches and players.
 *
 * Every function is authenticated. Device records are always written for the
 * caller's own account, and team alerts are only accepted from a coach of that
 * team, so nobody can push messages into a team they do not belong to.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PrefColumn } from "./notify.server";

export type PushDevice = {
  id: string;
  device_label: string | null;
  created_at: string;
  last_success_at: string | null;
  active: boolean;
};

export type PushConfig = {
  publicKey: string | null;
  emailConfigured: boolean;
};

export const getPushConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PushConfig> => {
    const { emailConfigured } = await import("./notify.server");
    return {
      publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null,
      emailConfigured: emailConfigured(),
    };
  });

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  deviceLabel: z.string().max(80).optional(),
  userAgent: z.string().max(400).optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subscriptionSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { adminDb } = await import("./notify.server");
    const db = await adminDb();
    // Endpoint is unique: re-subscribing on the same device re-binds it to the
    // account that is signed in right now instead of leaving a stale owner.
    await db.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        device_label: data.deviceLabel ?? null,
        user_agent: data.userAgent ?? null,
        active: true,
        failure_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => z.object({ endpoint: z.string().max(1000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("push_subscriptions" as never)
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PushDevice[]> => {
    const { data } = await context.supabase
      .from("push_subscriptions" as never)
      .select("id, device_label, created_at, last_success_at, active")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as PushDevice[];
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sent: number; failed: number }> => {
    const { dispatchNotification } = await import("./notify.server");
    const res = await dispatchNotification({
      audience: { kind: "users", userIds: [context.userId] },
      type: "test",
      title: "CoachSide notifications are on",
      body: "This is a test alert. You're all set for team and Library updates.",
      link: "/dashboard",
      channels: ["push"],
    });
    return { sent: res.pushSent, failed: res.pushFailed };
  });

/* ---------------- team alerts ---------------- */

const teamAlertSchema = z.object({
  teamId: z.string().uuid(),
  kind: z.enum(["announcement", "assignment", "play", "schedule", "game"]),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
  link: z.string().max(300).optional(),
  relatedId: z.string().uuid().optional(),
});

const PREF_FOR: Record<string, PrefColumn> = {
  announcement: "announcement_notifications",
  assignment: "assignment_notifications",
  play: "new_play_notifications",
  schedule: "schedule_change_notifications",
  game: "game_reminders",
};

const messageAlertSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const notifyConversationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => messageAlertSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: message } = await context.supabase
      .from("messages" as never)
      .select("id, sender_id, body, conversation_id")
      .eq("id", data.messageId)
      .eq("conversation_id", data.conversationId)
      .eq("sender_id", context.userId)
      .maybeSingle();
    if (!message) throw new Error("Message not found.");

    const { data: conversation } = await context.supabase
      .from("conversations" as never)
      .select("id, team_id, type")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conversation) throw new Error("Conversation not found.");

    const row = conversation as unknown as { team_id: string; type: string };
    const { adminDb, dispatchNotification } = await import("./notify.server");
    const db = await adminDb();
    let recipientIds: string[] = [];
    if (row.type === "team" || row.type === "staff") {
      const { data: members } = await db.from("team_members").select("user_id, role").eq("team_id", row.team_id).eq("active", true);
      recipientIds = ((members ?? []) as { user_id: string; role: string }[])
        .filter((m) => row.type === "team" ? m.role !== "parent" : ["head_coach", "assistant_coach"].includes(m.role))
        .map((m) => m.user_id);
    } else {
      const { data: members } = await db.from("conversation_members").select("user_id").eq("conversation_id", data.conversationId);
      recipientIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
    }
    recipientIds = [...new Set(recipientIds)].filter((id) => id !== context.userId);
    if (recipientIds.length) {
      const body = String((message as unknown as { body: string }).body).slice(0, 200) || "A teammate sent an attachment.";
      await dispatchNotification({
        audience: { kind: "users", userIds: recipientIds },
        teamId: row.team_id,
        type: "team_message",
        title: row.type === "team" ? "New Team Chat message" : "New private message",
        body,
        link: `/lockerroom?area=chat`,
        relatedType: "message",
        relatedId: data.messageId,
        dedupeKey: `message:${data.messageId}`,
      });
    }
    return { ok: true };
  });

export const notifyPlanRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: assignment } = await context.supabase
      .from("assignments" as never)
      .select("id, team_id, title, instructions")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (!assignment) throw new Error("Plan not found.");
    const row = assignment as unknown as { team_id: string; title: string; instructions: string | null };
    const { data: isCoach } = await (context.supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> }).rpc("is_team_coach", { _team: row.team_id });
    if (isCoach !== true) throw new Error("Only a team coach can notify players.");

    const { adminDb, dispatchNotification } = await import("./notify.server");
    const db = await adminDb();
    const { data: targets } = await db.from("assignment_targets").select("user_id, player_id").eq("assignment_id", data.assignmentId);
    const targetRows = (targets ?? []) as { user_id: string | null; player_id: string | null }[];
    let recipients: string[];
    if (targetRows.length) {
      const direct = targetRows.map((t) => t.user_id).filter((id): id is string => Boolean(id));
      const playerIds = targetRows.map((t) => t.player_id).filter((id): id is string => Boolean(id));
      const { data: members } = playerIds.length
        ? await db.from("team_members").select("user_id").eq("team_id", row.team_id).eq("active", true).in("player_id", playerIds)
        : { data: [] };
      recipients = [...direct, ...((members ?? []) as { user_id: string }[]).map((m) => m.user_id)];
    } else {
      const { data: members } = await db.from("team_members").select("user_id").eq("team_id", row.team_id).eq("active", true).eq("role", "player");
      recipients = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
    }
    recipients = [...new Set(recipients)].filter((id) => id !== context.userId);
    if (recipients.length) {
      await dispatchNotification({
        audience: { kind: "users", userIds: recipients },
        teamId: row.team_id,
        type: "team_assignment",
        title: `New plan: ${row.title}`,
        body: row.instructions?.slice(0, 200) || "Open CoachSide to see what your coach assigned.",
        link: `/lockerroom?area=plans&item=${data.assignmentId}`,
        relatedType: "assignment",
        relatedId: data.assignmentId,
        prefColumn: "assignment_notifications",
        dedupeKey: `assignment:${data.assignmentId}`,
      });
    }
    return { ok: true };
  });

/**
 * Pushes/emails a team alert. The in-app row is created by the existing
 * database triggers, so this only adds the device and email channels and never
 * produces a second copy in the notification list.
 */
export const notifyTeamEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => teamAlertSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { data: isCoach } = await (
      context.supabase as unknown as {
        rpc: (f: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown }>;
      }
    ).rpc("is_team_coach", { _team: data.teamId });
    if (isCoach !== true) throw new Error("Only a coach of this team can send team alerts.");

    const { dispatchNotification } = await import("./notify.server");
    await dispatchNotification({
      audience: { kind: "team", teamId: data.teamId },
      teamId: data.teamId,
      type: `team_${data.kind}`,
      title: data.title,
      body: data.body,
      link: data.link ?? "/lockerroom",
      relatedId: data.relatedId ?? null,
      relatedType: data.kind,
      prefColumn: PREF_FOR[data.kind] ?? null,
      dedupeKey: data.relatedId ? `${data.kind}:${data.relatedId}` : null,
      channels: ["push", "email"],
    });
    return { ok: true };
  });

/* ---------------- Play of the Day ---------------- */

export const setPlayOfTheDayAndNotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { playId: string }) => z.object({ playId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ notified: number; pushSent: number }> => {
    const rpc = context.supabase as unknown as {
      rpc: (f: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    };
    const { data: isAdmin } = await rpc.rpc("is_app_admin");
    if (isAdmin !== true) throw new Error("CoachSide owners only.");

    const { error } = await rpc.rpc("set_play_of_the_day", { _play: data.playId });
    if (error) throw new Error((error as { message?: string }).message ?? "Could not set the featured play");

    const { adminDb, dispatchNotification } = await import("./notify.server");
    const db = await adminDb();
    const { data: play } = await db.from("plays").select("name").eq("id", data.playId).maybeSingle();
    const name = (play as { name?: string } | null)?.name ?? "Today's play";

    const res = await dispatchNotification({
      audience: { kind: "all_coaches" },
      type: "play_of_the_day",
      title: "CoachSide Play of the Day",
      body: `${name} is today's featured play. Open CoachSide to run it or add it to your Playbook.`,
      link: `/library/${data.playId}`,
      relatedType: "play",
      relatedId: data.playId,
      prefColumn: "play_of_the_day_notifications",
      dedupeKey: `potd:${(await import("./retention.server")).todayKey()}:${data.playId}`,
    });
    const { todayKey } = await import("./retention.server");
    await db.from("play_of_the_day").update({ notified_at: new Date().toISOString() }).eq("day", todayKey());
    return { notified: res.inapp, pushSent: res.pushSent };
  });
