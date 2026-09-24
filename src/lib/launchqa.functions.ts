/**
 * Launch QA — owner-only server functions. Every handler re-checks
 * is_app_admin on the server before touching anything.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACHIEVEMENTS } from "./achievements";
import { FUNNEL_EVENTS } from "./funnel";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

async function assertAdmin(supabase: unknown) {
  const { data, error } = await (supabase as Rpc).rpc("is_app_admin");
  if (error || data !== true) throw new Error("CoachSide owners only.");
}

export const PLAN_KEYS = [
  "playbook_plus",
  "gameday_plus",
  "team_hub_plus",
  "playbook_plus+gameday_plus",
  "playbook_plus+team_hub_plus",
  "gameday_plus+team_hub_plus",
  "complete",
] as const;

export type CheckStatus = "pass" | "fail" | "waiting";

export type LaunchQa = {
  config: {
    enforcementEnabled: boolean;
    stripeMode: "not_configured" | "test" | "live";
    webhookConfigured: boolean;
    webhookUrl: string;
    emailConfigured: boolean;
    pushConfigured: boolean;
    supportEmail: string;
    fromEmail: string;
    priceMapComplete: boolean;
  };
  priceMap: { planKey: string; priceId: string | null }[];
  webhookEvents: { eventId: string; type: string; processed: boolean; error: string | null; receivedAt: string; livemode: boolean | null }[];
  checklist: { key: string; label: string; status: CheckStatus; detail: string }[];
  funnel: { event: string; count: number }[];
  achievementRates: { key: string; name: string; pct: number }[];
  coachCount: number;
  myAchievements: { key: string; unlockedAt: string }[];
  myEvents: { type: string; at: string }[];
  potd: { day: string; playId: string | null; playName: string | null; source: string; notifiedAt: string | null }[];
  libraryPlays: { id: string; name: string }[];
};

export const getLaunchQa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LaunchQa> => {
    await assertAdmin(context.supabase);
    const { adminDb, emailConfigured } = await import("./notify.server");
    const { pushConfigured } = await import("./webpush.server");
    const { enforcementEnabled } = await import("./billing.server");
    const db = await adminDb();

    const sk = process.env["STRIPE_SECRET_KEY"] ?? "";
    const stripeMode = sk.startsWith("sk_live_") || sk.startsWith("rk_live_") ? "live" : sk ? "test" : "not_configured";
    const webhookConfigured = Boolean(process.env["STRIPE_WEBHOOK_SECRET"]);

    const [pm, wh, tb, ua, ev, anon, potd, plays, members] = await Promise.all([
      db.from("billing_price_map").select("plan_key, stripe_price_id"),
      db.from("billing_webhook_events").select("*").eq("provider", "stripe").order("received_at", { ascending: false }).limit(50),
      db.from("team_billing").select("status, stripe_subscription_id, cancel_at_period_end, modules"),
      db.from("user_achievements").select("user_id, achievement_key, unlocked_at"),
      db.from("product_activity_events").select("user_id, event_type, created_at").in("event_type", [...FUNNEL_EVENTS]),
      db.from("anon_funnel_events").select("event_type"),
      db.from("play_of_the_day").select("*").order("day", { ascending: false }).limit(45),
      db.from("plays").select("id, name").eq("published_to_library", true).order("name"),
      db.from("team_members").select("user_id, role, active"),
    ]);

    const priceMap = PLAN_KEYS.map((k) => ({
      planKey: k,
      priceId: ((pm.data ?? []) as { plan_key: string; stripe_price_id: string | null }[]).find((r) => r.plan_key === k)?.stripe_price_id ?? null,
    }));
    const events = (wh.data ?? []) as { event_id: string; event_type: string; processed: boolean; error: string | null; received_at: string; livemode: boolean | null }[];
    const billing = (tb.data ?? []) as { status: string; stripe_subscription_id: string | null; cancel_at_period_end: boolean; modules: string[] }[];
    const stripeRows = billing.filter((b) => b.stripe_subscription_id);
    const seen = (t: string) => events.some((e) => e.event_type === t && e.processed);
    const ready = stripeMode !== "not_configured" && webhookConfigured && priceMap.every((p) => p.priceId);
    const chk = (key: string, label: string, ok: boolean, detail: string) => ({
      key, label, detail, status: (!ready ? "waiting" : ok ? "pass" : "fail") as CheckStatus,
    });
    const checklist = [
      chk("checkout", "Checkout started in Stripe TEST mode", seen("checkout.session.completed") || stripeRows.length > 0, "Start checkout from Membership with a test card"),
      chk("webhook_success", "Success webhook received", seen("checkout.session.completed"), "checkout.session.completed processed"),
      chk("sub_row", "Subscription row saved", stripeRows.length > 0, `${stripeRows.length} team(s) linked to a Stripe subscription`),
      chk("unlock", "Entitlement unlocked", stripeRows.some((r) => r.status === "active" && r.modules.length > 0), "Active status with modules"),
      chk("portal", "Customer portal opened", seen("billing_portal.session.created"), "Open the customer portal from Membership"),
      chk("upgrade_12", "Upgrade $6 → $12", stripeRows.some((r) => r.modules.length === 2) && seen("customer.subscription.updated"), "subscription.updated with 2 modules"),
      chk("upgrade_15", "Upgrade $12 → $15", stripeRows.some((r) => r.modules.length === 3) && seen("customer.subscription.updated"), "subscription.updated with 3 modules"),
      chk("downgrade", "Downgrade at renewal", seen("subscription_schedule.updated") || seen("customer.subscription.updated"), "Change scheduled for period end"),
      chk("cancel", "Cancellation", stripeRows.some((r) => r.cancel_at_period_end) || seen("customer.subscription.deleted"), "cancel_at_period_end or deleted"),
      chk("past_due", "Payment failure → past due", seen("invoice.payment_failed") || stripeRows.some((r) => r.status === "past_due"), "Use a declining test card"),
      chk("idempotent", "Webhook retry is idempotent", events.length > 0 && events.every((e) => !e.error), "Every event id stored once; no errors"),
    ];

    const activity = (ev.data ?? []) as { user_id: string; event_type: string; created_at: string }[];
    const anonRows = (anon.data ?? []) as { event_type: string }[];
    const funnel = FUNNEL_EVENTS.map((e) => ({
      event: e,
      count:
        anonRows.filter((r) => r.event_type === e).length +
        new Set(activity.filter((a) => a.event_type === e).map((a) => a.user_id + (e === "feature_paywall_viewed" ? a.created_at : ""))).size,
    }));

    const coaches = new Set(
      ((members.data ?? []) as { user_id: string; role: string; active: boolean }[])
        .filter((m) => m.active && (m.role === "head_coach" || m.role === "assistant_coach"))
        .map((m) => m.user_id),
    );
    const achRows = (ua.data ?? []) as { user_id: string; achievement_key: string; unlocked_at: string }[];
    const achievementRates = ACHIEVEMENTS.map((a) => ({
      key: a.key,
      name: a.name,
      pct: coaches.size ? Math.round((new Set(achRows.filter((r) => r.achievement_key === a.key && coaches.has(r.user_id)).map((r) => r.user_id)).size / coaches.size) * 100) : 0,
    }));

    const { data: mine } = await db.from("product_activity_events").select("event_type, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(50);
    const playList = (plays.data ?? []) as { id: string; name: string }[];

    return {
      config: {
        enforcementEnabled: enforcementEnabled(),
        stripeMode,
        webhookConfigured,
        webhookUrl: "/api/public/stripe/webhook",
        emailConfigured: emailConfigured(),
        pushConfigured: pushConfigured(),
        supportEmail: process.env["SUPPORT_EMAIL"] || "support@coachside.live",
        fromEmail: process.env["FROM_EMAIL"] || "donotreply@coachside.live",
        priceMapComplete: priceMap.every((p) => p.priceId),
      },
      priceMap,
      webhookEvents: events.slice(0, 20).map((e) => ({ eventId: e.event_id, type: e.event_type, processed: e.processed, error: e.error, receivedAt: e.received_at, livemode: e.livemode })),
      checklist,
      funnel,
      achievementRates,
      coachCount: coaches.size,
      myAchievements: achRows.filter((r) => r.user_id === context.userId).map((r) => ({ key: r.achievement_key, unlockedAt: r.unlocked_at })),
      myEvents: ((mine ?? []) as { event_type: string; created_at: string }[]).map((m) => ({ type: m.event_type, at: m.created_at })),
      potd: ((potd.data ?? []) as { day: string; play_id: string | null; source: string; notified_at: string | null }[]).map((r) => ({
        day: r.day, playId: r.play_id, playName: playList.find((p) => p.id === r.play_id)?.name ?? null, source: r.source, notifiedAt: r.notified_at,
      })),
      libraryPlays: playList,
    };
  });

export const savePriceMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planKey: string; priceId: string }) =>
    z.object({
      planKey: z.enum(PLAN_KEYS),
      priceId: z.string().trim().max(120).regex(/^(price_[A-Za-z0-9]+)?$/, "Stripe price IDs start with price_"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { adminDb } = await import("./notify.server");
    const db = await adminDb();
    const { error } = await db.from("billing_price_map").upsert({
      plan_key: data.planKey,
      stripe_price_id: data.priceId || null,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save the price mapping.");
    return { ok: true };
  });

export type TestResult = { channel: string; ok: boolean; detail: string };

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { channel: "inapp" | "push" | "email" }) => z.object({ channel: z.enum(["inapp", "push", "email"]) }).parse(d))
  .handler(async ({ data, context }): Promise<TestResult> => {
    await assertAdmin(context.supabase);
    const { dispatchNotification, emailConfigured } = await import("./notify.server");
    const { pushConfigured } = await import("./webpush.server");
    if (data.channel === "email" && !emailConfigured()) return { channel: "email", ok: false, detail: "Email delivery is not configured." };
    if (data.channel === "push" && !pushConfigured()) return { channel: "push", ok: false, detail: "Push keys are not configured." };
    const res = await dispatchNotification({
      audience: { kind: "users", userIds: [context.userId] },
      type: "test",
      title: "CoachSide test notification",
      body: `Launch QA ${data.channel} test at ${new Date().toLocaleTimeString("en-US")}`,
      link: "/launch-qa",
      channels: [data.channel],
    });
    if (data.channel === "inapp") return { channel: "inapp", ok: res.inapp > 0, detail: res.inapp ? "In-app notification created." : "Nothing was created." };
    if (data.channel === "push") {
      if (res.pushSent > 0) return { channel: "push", ok: true, detail: `Delivered to ${res.pushSent} device(s)${res.pushFailed ? `, ${res.pushFailed} failed` : ""}.` };
      return { channel: "push", ok: false, detail: res.pushFailed ? `${res.pushFailed} device(s) rejected the push.` : "No active push device for your account — enable push on this device first." };
    }
    return { channel: "email", ok: res.emailQueued > 0, detail: res.emailQueued ? "Email queued with the provider." : "Email was not queued (check your email preference)." };
  });

export const grantPilotAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { adminDb } = await import("./notify.server");
    const db = await adminDb();
    const { data: teams } = await db.from("teams").select("id, org_id");
    const { data: grants } = await db.from("complimentary_grants").select("team_id").eq("active", true);
    const has = new Set(((grants ?? []) as { team_id: string }[]).map((g) => g.team_id));
    const rows = ((teams ?? []) as { id: string; org_id: string | null }[])
      .filter((t) => !has.has(t.id))
      .map((t) => ({
        team_id: t.id,
        org_id: t.org_id,
        modules: ["playbook_plus", "gameday_plus", "team_hub_plus"],
        reason: "Pilot user — early access",
        source: "admin",
        active: true,
        created_by: context.userId,
      }));
    if (rows.length) {
      const { error } = await db.from("complimentary_grants").insert(rows);
      if (error) throw new Error(`Could not grant pilot access: ${error.message}`);
    }
    return { granted: rows.length };
  });

export const schedulePlayOfTheDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { day: string; playId: string | null }) =>
    z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), playId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { error } = await (context.supabase as unknown as Rpc).rpc("schedule_play_of_the_day", { _day: data.day, _play: data.playId });
    if (error) throw new Error((error as { message?: string }).message ?? "Could not schedule");
    return { ok: true };
  });

export const runDailyNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { ensurePlayOfTheDay } = await import("./retention.server");
    return ensurePlayOfTheDay();
  });
