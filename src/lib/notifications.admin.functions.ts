/**
 * Owner-only notification sending.
 *
 * Mirrors the My KPI pattern: every function re-checks the CoachSide owner list
 * with the caller's own identity before the privileged client is even loaded,
 * so a coach or player calling these endpoints directly is refused.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Audience, Channel } from "./notify.server";

type Rpc = { rpc: (fn: "is_app_admin") => PromiseLike<{ data: unknown; error: unknown }> };

async function assertOwner(supabase: unknown) {
  const { data, error } = await (supabase as Rpc).rpc("is_app_admin");
  if (error || data !== true) throw new Error("CoachSide owners only.");
}

export type BroadcastLogRow = {
  id: string;
  created_at: string;
  audience_kind: string;
  audience_ref: string | null;
  title: string;
  body: string;
  channels: string[];
  recipient_count: number;
  push_sent: number;
  push_failed: number;
  email_queued: number;
};

export type BroadcastContext = {
  emailConfigured: boolean;
  pushConfigured: boolean;
  teams: { id: string; name: string; season: string }[];
  recent: BroadcastLogRow[];
  pushEnabledUsers: number;
};

export const getBroadcastContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BroadcastContext> => {
    await assertOwner(context.supabase);
    const { adminDb, emailConfigured } = await import("./notify.server");
    const { pushConfigured } = await import("./webpush.server");
    const db = await adminDb();

    const [teamsR, logR, subsR] = await Promise.all([
      db.from("teams").select("id, name, season").order("name"),
      db.from("notification_broadcasts").select("*").order("created_at", { ascending: false }).limit(15),
      db.from("push_subscriptions").select("user_id").eq("active", true),
    ]);

    const users = new Set(((subsR.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    return {
      emailConfigured: emailConfigured(),
      pushConfigured: pushConfigured(),
      teams: (teamsR.data ?? []) as BroadcastContext["teams"],
      recent: (logR.data ?? []) as BroadcastLogRow[],
      pushEnabledUsers: users.size,
    };
  });

const broadcastSchema = z.object({
  audienceKind: z.enum(["all_users", "all_coaches", "team", "user"]),
  teamId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  link: z.string().max(300).optional(),
  channels: z.array(z.enum(["inapp", "push", "email"])).min(1),
});

export type BroadcastResult = {
  recipients: number;
  inapp: number;
  pushSent: number;
  pushFailed: number;
  emailQueued: number;
  emailConfigured: boolean;
};

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => broadcastSchema.parse(d))
  .handler(async ({ data, context }): Promise<BroadcastResult> => {
    await assertOwner(context.supabase);
    const { adminDb, dispatchNotification } = await import("./notify.server");
    const db = await adminDb();

    let audience: Audience;
    let audienceRef: string | null = null;
    if (data.audienceKind === "team") {
      if (!data.teamId) throw new Error("Pick a team first.");
      audience = { kind: "team", teamId: data.teamId };
      audienceRef = data.teamId;
    } else if (data.audienceKind === "user") {
      if (!data.email) throw new Error("Enter the person's email address.");
      const { data: person } = await db
        .from("profiles")
        .select("id")
        .ilike("email", data.email)
        .maybeSingle();
      const id = (person as { id?: string } | null)?.id;
      if (!id) throw new Error("No CoachSide account uses that email address.");
      audience = { kind: "users", userIds: [id] };
      audienceRef = data.email;
    } else {
      audience = { kind: data.audienceKind };
    }

    const res = await dispatchNotification({
      audience,
      type: "coachside_message",
      title: data.title,
      body: data.body,
      link: data.link ?? "/dashboard",
      teamId: data.audienceKind === "team" ? (data.teamId ?? null) : null,
      channels: data.channels as Channel[],
    });

    await db.from("notification_broadcasts").insert({
      sent_by: context.userId,
      audience_kind: data.audienceKind,
      audience_ref: audienceRef,
      title: data.title,
      body: data.body,
      link: data.link ?? null,
      channels: data.channels,
      recipient_count: res.recipients,
      push_sent: res.pushSent,
      push_failed: res.pushFailed,
      email_queued: res.emailQueued,
    });

    return {
      recipients: res.recipients,
      inapp: res.inapp,
      pushSent: res.pushSent,
      pushFailed: res.pushFailed,
      emailQueued: res.emailQueued,
      emailConfigured: res.emailConfigured,
    };
  });

export type NotificationKpis = {
  pushEnabledUsers: number;
  activeDevices: number;
  inactiveDevices: number;
  pushSent: number;
  pushFailed: number;
  notificationsCreated: number;
  notificationsOpened: number;
  emailQueued: number;
  emailSent: number;
  emailConfigured: boolean;
};

export const getNotificationKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationKpis> => {
    await assertOwner(context.supabase);
    const { adminDb, emailConfigured } = await import("./notify.server");
    const db = await adminDb();

    const [subsR, delR, notifR, mailR] = await Promise.all([
      db.from("push_subscriptions").select("user_id, active"),
      db.from("notification_deliveries").select("channel, status"),
      db.from("notifications").select("read_at"),
      db.from("notification_email_queue").select("status"),
    ]);

    const subs = (subsR.data ?? []) as { user_id: string; active: boolean }[];
    const del = (delR.data ?? []) as { channel: string; status: string }[];
    const notifs = (notifR.data ?? []) as { read_at: string | null }[];
    const mail = (mailR.data ?? []) as { status: string }[];

    return {
      pushEnabledUsers: new Set(subs.filter((s) => s.active).map((s) => s.user_id)).size,
      activeDevices: subs.filter((s) => s.active).length,
      inactiveDevices: subs.filter((s) => !s.active).length,
      pushSent: del.filter((d) => d.channel === "push" && d.status === "sent").length,
      pushFailed: del.filter((d) => d.channel === "push" && d.status === "failed").length,
      notificationsCreated: notifs.length,
      notificationsOpened: notifs.filter((n) => !!n.read_at).length,
      emailQueued: mail.filter((m) => m.status === "queued").length,
      emailSent: mail.filter((m) => m.status === "sent").length,
      emailConfigured: emailConfigured(),
    };
  });
