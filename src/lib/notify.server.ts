/**
 * The single CoachSide notification dispatcher.
 *
 * Every feature that needs to tell someone something calls dispatchNotification
 * instead of writing its own delivery code. The dispatcher decides who is
 * eligible (team membership + that person's own preferences), writes the in-app
 * row, sends Web Push to that person's enabled devices, queues email when a
 * provider exists, and records every attempt.
 *
 * Server-only: this file is never imported at the top level of a *.functions.ts
 * module, only inside handlers.
 */
import { sendWebPush, pushConfigured, type PushKeys } from "./webpush.server";

export type PrefColumn =
  | "announcement_notifications"
  | "assignment_notifications"
  | "new_play_notifications"
  | "challenge_notifications"
  | "practice_reminders"
  | "game_reminders"
  | "schedule_change_notifications"
  | "play_of_the_day_notifications";

export type Audience =
  | { kind: "all_users" }
  | { kind: "all_coaches" }
  | { kind: "team"; teamId: string }
  | { kind: "users"; userIds: string[] };

export type Channel = "inapp" | "push" | "email";

export type DispatchInput = {
  audience: Audience;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  teamId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  /** Preference column that gates this category. Omitted = always eligible. */
  prefColumn?: PrefColumn | null;
  /** Stable key so the same event can never notify the same person twice. */
  dedupeKey?: string | null;
  channels?: Channel[];
};

export type DispatchResult = {
  recipients: number;
  inapp: number;
  pushSent: number;
  pushFailed: number;
  emailQueued: number;
  emailConfigured: boolean;
};

type Db = {
  from: (t: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc?: (fn: string, args?: Record<string, unknown>) => any;
};

export async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/** True only when a real transactional email provider is configured. */
export function emailConfigured(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]);
}

const COACH_ROLES = ["head_coach", "assistant_coach"];

async function resolveAudience(db: Db, audience: Audience): Promise<string[]> {
  if (audience.kind === "users") return [...new Set(audience.userIds.filter(Boolean))];

  if (audience.kind === "team") {
    const { data } = await db
      .from("team_members")
      .select("user_id")
      .eq("team_id", audience.teamId)
      .eq("active", true);
    return [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  }

  if (audience.kind === "all_coaches") {
    const { data } = await db.from("team_members").select("user_id, role, active");
    const ids = ((data ?? []) as { user_id: string; role: string; active: boolean }[])
      .filter((r) => r.active && COACH_ROLES.includes(r.role))
      .map((r) => r.user_id);
    const { data: orgs } = await db.from("org_members").select("user_id");
    for (const r of (orgs ?? []) as { user_id: string }[]) ids.push(r.user_id);
    return [...new Set(ids)];
  }

  const { data } = await db.from("profiles").select("id");
  return [...new Set(((data ?? []) as { id: string }[]).map((r) => r.id))];
}

type Prefs = Record<string, boolean> & { user_id: string };

async function loadPrefs(db: Db, userIds: string[]): Promise<Map<string, Prefs>> {
  const map = new Map<string, Prefs>();
  if (!userIds.length) return map;
  const { data } = await db.from("notification_preferences").select("*").in("user_id", userIds);
  for (const row of (data ?? []) as Prefs[]) map.set(row.user_id, row);
  return map;
}

/** Missing preference rows mean "not customised yet" → engagement defaults on. */
function wants(prefs: Prefs | undefined, column: string | null | undefined): boolean {
  if (!column) return true;
  if (!prefs) return true;
  const v = prefs[column];
  return v === undefined || v === null ? true : Boolean(v);
}

export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const db = await adminDb();
  const channels = input.channels ?? ["inapp", "push", "email"];
  const result: DispatchResult = {
    recipients: 0,
    inapp: 0,
    pushSent: 0,
    pushFailed: 0,
    emailQueued: 0,
    emailConfigured: emailConfigured(),
  };

  const allIds = await resolveAudience(db, input.audience);
  const prefs = await loadPrefs(db, allIds);
  const eligible = allIds.filter((id) => wants(prefs.get(id), input.prefColumn));
  result.recipients = eligible.length;
  if (!eligible.length) return result;

  // ---------- duplicate guard ----------
  // Anyone already told about this exact event drops out before anything sends.
  if (input.dedupeKey) {
    const { data: already } = await db
      .from("notifications")
      .select("user_id")
      .eq("dedupe_key", input.dedupeKey)
      .in("user_id", eligible);
    const told = new Set(((already ?? []) as { user_id: string }[]).map((r) => r.user_id));
    for (let i = eligible.length - 1; i >= 0; i--) {
      if (told.has(eligible[i]!)) eligible.splice(i, 1);
    }
    result.recipients = eligible.length;
    if (!eligible.length) return result;
  }

  // ---------- in-app ----------
  const notificationIdByUser = new Map<string, string>();
  if (channels.includes("inapp")) {
    const rows = eligible.map((user_id) => ({
      user_id,
      team_id: input.teamId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      related_type: input.relatedType ?? null,
      related_id: input.relatedId ?? null,
      channel: "in_app",
      status: "sent",
      dedupe_key: input.dedupeKey ?? null,
      sent_at: new Date().toISOString(),
    }));
    const { data } = await db.from("notifications").insert(rows).select("id, user_id");
    for (const r of (data ?? []) as { id: string; user_id: string }[]) {
      notificationIdByUser.set(r.user_id, r.id);
    }
    result.inapp = notificationIdByUser.size;
  }


  const deliveries: Record<string, unknown>[] = [];

  // ---------- push ----------
  if (channels.includes("push") && pushConfigured()) {
    const pushIds = eligible.filter((id) => wants(prefs.get(id), "push_enabled"));
    if (pushIds.length) {
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth, failure_count")
        .in("user_id", pushIds)
        .eq("active", true);

      const payload = {
        title: input.title,
        body: input.body,
        url: input.link ?? "/dashboard",
        type: input.type,
      };

      for (const sub of (subs ?? []) as ({ id: string; user_id: string; failure_count: number } & PushKeys)[]) {
        const res = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
        );
        if (res.ok) {
          result.pushSent++;
          await db
            .from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
            .eq("id", sub.id);
        } else {
          result.pushFailed++;
          const failures = (sub.failure_count ?? 0) + 1;
          await db
            .from("push_subscriptions")
            .update({ failure_count: failures, active: !res.gone && failures < 5 })
            .eq("id", sub.id);
        }
        deliveries.push({
          notification_id: notificationIdByUser.get(sub.user_id) ?? null,
          user_id: sub.user_id,
          channel: "push",
          status: res.ok ? "sent" : "failed",
          error: res.error ?? null,
          sent_at: res.ok ? new Date().toISOString() : null,
        });
      }
    }
  }

  // ---------- email ----------
  if (channels.includes("email")) {
    const emailIds = eligible.filter((id) => wants(prefs.get(id), "email_enabled"));
    if (emailIds.length) {
      const { data: people } = await db.from("profiles").select("id, email").in("id", emailIds);
      const rows = ((people ?? []) as { id: string; email: string | null }[])
        .filter((p) => !!p.email)
        .map((p) => ({
          user_id: p.id,
          to_email: p.email as string,
          subject: input.title,
          body: input.body,
          link: input.link ?? null,
          status: "queued",
        }));
      if (rows.length) {
        await db.from("notification_email_queue").insert(rows);
        result.emailQueued = rows.length;
        for (const r of rows) {
          deliveries.push({
            notification_id: notificationIdByUser.get(r.user_id) ?? null,
            user_id: r.user_id,
            channel: "email",
            status: "queued",
          });
        }
      }
    }
  }

  if (channels.includes("inapp")) {
    for (const [user_id, notification_id] of notificationIdByUser) {
      deliveries.push({
        notification_id,
        user_id,
        channel: "inapp",
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }
  }

  if (deliveries.length) await db.from("notification_deliveries").insert(deliveries);
  return result;
}
