/**
 * Membership server functions. Every write happens here, never in the browser:
 * access codes are hashed, Square ids stay server-side, and only coaches of a
 * team may touch that team's membership.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALL_MODULES,
  type ModuleKey,
} from "./entitlements";

const moduleSchema = z.enum(["playbook_plus", "gameday_plus", "team_hub_plus"]);

type RpcClient = {
  rpc: (
    fn: "is_team_coach" | "is_app_admin",
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

async function assertCoach(supabase: RpcClient, teamId: string) {
  const { data, error } = await supabase.rpc("is_team_coach", { _team: teamId });
  if (error || data !== true) throw new Error("Only coaches of this team can manage membership.");
}

async function assertAdmin(supabase: RpcClient) {
  const { data, error } = await supabase.rpc("is_app_admin");
  if (error || data !== true) throw new Error("CoachSide owners only.");
}

async function hashCode(code: string): Promise<string> {
  const { hashAccessCode } = await import("./billing.server");
  return hashAccessCode(code);
}

function mask(value: string | null): string | null {
  if (!value) return null;
  return value.length <= 6 ? "••••" : `••••${value.slice(-6)}`;
}

export type BillingConfig = {
  enforcementEnabled: boolean;
  checkoutConfigured: boolean;
  checkoutReason: string | null;
  webhookUrl: string;
};

/** Public-to-signed-in configuration. Never exposes secrets. */
export const getBillingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<BillingConfig> => {
    const { enforcementEnabled } = await import("./billing.server");
    const { stripeConfig } = await import("./stripe.server");
    const cfg = stripeConfig();
    return {
      enforcementEnabled: enforcementEnabled(),
      checkoutConfigured: cfg.secretPresent,
      checkoutReason: cfg.secretPresent ? null : "Checkout is not set up yet (Stripe server secret not configured).",
      webhookUrl: "https://coachside.live/api/public/stripe/webhook",
    };
  });

export type TeamBillingView = {
  teamId: string;
  status: string;
  modules: ModuleKey[];
  pendingModules: ModuleKey[] | null;
  pendingEffectiveAt: string | null;
  currentPeriodEnd: string | null;
  complimentary: boolean;
  complimentaryExpiresAt: string | null;
  subscriptionRef: string | null;
  lastWebhookAt: string | null;
  lastWebhookError: string | null;
  isAdmin: boolean;
};

/** Coach-visible membership state for one team. */
export const getTeamBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TeamBillingView> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("team_billing")
      .select("*")
      .eq("team_id", data.teamId)
      .maybeSingle();
    const { data: grants } = await supabaseAdmin
      .from("complimentary_grants")
      .select("modules,expires_at,active")
      .eq("team_id", data.teamId)
      .eq("active", true);
    const { data: isAdmin } = await (context.supabase as unknown as RpcClient).rpc("is_app_admin");

    const live = (grants ?? []).filter(
      (g) => !g.expires_at || new Date(g.expires_at as string).getTime() > Date.now(),
    );
    const compModules = live.flatMap((g) => (g.modules ?? []) as string[]);
    const paid = ((row?.modules as string[]) ?? []).filter((m) =>
      ["active", "grace", "past_due", "complimentary"].includes((row?.status as string) ?? ""),
    );
    const modules = [...new Set([...paid, ...compModules])].filter((m): m is ModuleKey =>
      ALL_MODULES.includes(m as ModuleKey),
    );

    return {
      teamId: data.teamId,
      status: (row?.status as string) ?? "free",
      modules,
      pendingModules: (row?.pending_modules as ModuleKey[] | null) ?? null,
      pendingEffectiveAt: (row?.pending_effective_at as string | null) ?? null,
      currentPeriodEnd: (row?.current_period_end as string | null) ?? null,
      complimentary: live.length > 0,
      complimentaryExpiresAt: (live[0]?.expires_at as string | null) ?? null,
      subscriptionRef: mask(((row as Record<string, unknown> | null)?.["stripe_subscription_id"] as string | null) ?? (row?.square_subscription_id as string | null) ?? null),
      lastWebhookAt: (row?.last_webhook_at as string | null) ?? null,
      lastWebhookError: (row?.last_webhook_error as string | null) ?? null,
      isAdmin: isAdmin === true,
    };
  });

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; setupIncomplete: boolean };

/**
 * Starts Stripe-hosted Checkout for the team's single subscription, or swaps
 * the existing subscription to the new price (never a second subscription).
 * The webhook — not this redirect — activates entitlements.
 */
export const startTeamCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ teamId: z.string().uuid(), modules: z.array(moduleSchema).min(1), origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const st = await import("./stripe.server");
    const cfg = st.stripeConfig();
    if (!cfg.secretPresent) return { ok: false, reason: "Checkout is not set up yet (Stripe server secret not configured).", setupIncomplete: true };
    const plan = st.planKeyFor(data.modules as ModuleKey[]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Parameters<typeof st.resolvePrices>[0];
    const priceId = plan ? await st.priceIdFor(db, plan) : null;
    if (!plan || !priceId) return { ok: false, reason: "That plan's Stripe price is not mapped yet.", setupIncomplete: true };

    const { data: row } = await supabaseAdmin.from("team_billing").select("*").eq("team_id", data.teamId).maybeSingle();
    const { data: profile } = await supabaseAdmin.from("profiles").select("email,full_name").eq("id", context.userId).maybeSingle();
    const origin = new URL(data.origin).origin;
    const meta = { team_id: data.teamId, billing_owner: context.userId, plan_key: plan };

    const subId = (row as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ?? null;
    const status = (row as { status?: string } | null)?.status ?? "free";
    if (subId && status !== "canceled") {
      type Sub = { items: { data: { id: string }[] }; current_period_end?: number };
      const sub = await st.stripe<Sub>("GET", `/subscriptions/${subId}`);
      const itemId = sub.items.data[0]?.id;
      await st.stripe("POST", `/subscriptions/${subId}`, {
        "items[0][id]": itemId,
        "items[0][price]": priceId,
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        "metadata[team_id]": meta.team_id,
        "metadata[billing_owner]": meta.billing_owner,
        "metadata[plan_key]": meta.plan_key,
      }, `swap-${subId}-${priceId}`);
      await supabaseAdmin.from("team_billing").update({ pending_modules: data.modules, billing_owner: context.userId }).eq("team_id", data.teamId);
      await supabaseAdmin.from("product_activity_events").insert({ user_id: context.userId, event_type: "upgrade", team_id: data.teamId });
      return { ok: true, url: `${origin}/membership?swapped=1` };
    }

    let customerId = (row as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
    if (!customerId) {
      const c = await st.stripe<{ id: string }>("POST", "/customers", {
        email: (profile?.email as string | null) ?? undefined,
        name: (profile?.full_name as string | null) ?? undefined,
        "metadata[team_id]": data.teamId,
        "metadata[billing_owner]": context.userId,
      }, `cust-${data.teamId}`);
      customerId = c.id;
    }
    const session = await st.stripe<{ id: string; url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      client_reference_id: data.teamId,
      success_url: `${origin}/membership?checkout=complete&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/membership?checkout=canceled`,
      allow_promotion_codes: false,
      "metadata[team_id]": meta.team_id,
      "metadata[billing_owner]": meta.billing_owner,
      "metadata[plan_key]": meta.plan_key,
      "subscription_data[metadata][team_id]": meta.team_id,
      "subscription_data[metadata][billing_owner]": meta.billing_owner,
      "subscription_data[metadata][plan_key]": meta.plan_key,
    });

    await supabaseAdmin.from("team_billing").upsert(
      {
        team_id: data.teamId,
        billing_provider: "stripe",
        status: status === "active" ? status : "pending",
        pending_modules: data.modules,
        stripe_customer_id: customerId,
        stripe_price_id: priceId,
        billing_owner: context.userId,
      },
      { onConflict: "team_id" },
    );
    await supabaseAdmin.from("product_activity_events").insert({ user_id: context.userId, event_type: "checkout_started", team_id: data.teamId });
    return { ok: true, url: session.url };
  });

/** Stripe Customer Portal: payment method, invoices, cancel, plan changes. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const st = await import("./stripe.server");
    if (!st.stripeConfig().secretPresent) return { ok: false, reason: "Stripe server secret not configured.", setupIncomplete: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("team_billing").select("stripe_customer_id").eq("team_id", data.teamId).maybeSingle();
    const customer = (row as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
    if (!customer) return { ok: false, reason: "This team has no Stripe billing yet.", setupIncomplete: false };
    const s = await st.stripe<{ url: string }>("POST", "/billing_portal/sessions", {
      customer,
      return_url: `${new URL(data.origin).origin}/membership`,
    });
    return { ok: true, url: s.url };
  });

/** Cancel at period end: access and data stay until the paid period ends. */
export const cancelTeamMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string }> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const st = await import("./stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("team_billing").select("stripe_subscription_id").eq("team_id", data.teamId).maybeSingle();
    const subId = (row as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
    if (!subId) return { ok: false, reason: "No active membership." };
    await st.stripe("POST", `/subscriptions/${subId}`, { cancel_at_period_end: true });
    await supabaseAdmin.from("team_billing").update({ cancel_at_period_end: true }).eq("team_id", data.teamId);
    await supabaseAdmin.from("product_activity_events").insert({ user_id: context.userId, event_type: "cancel", team_id: data.teamId });
    return { ok: true };
  });

export type RedeemResult = { ok: boolean; message: string; modules?: ModuleKey[] };

/** Complimentary access codes. Validation is server-side only. */
export const redeemAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ teamId: z.string().uuid(), code: z.string().min(3).max(64) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RedeemResult> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: code } = await supabaseAdmin
      .from("access_codes")
      .select("*")
      .eq("code_hash", await hashCode(data.code))
      .maybeSingle();
    if (!code || code.active !== true) return { ok: false, message: "That code is not valid." };
    if (code.expires_at && new Date(code.expires_at as string).getTime() < Date.now())
      return { ok: false, message: "That code has expired." };
    if (code.max_uses != null && (code.uses as number) >= (code.max_uses as number))
      return { ok: false, message: "That code has already been fully used." };

    const { count } = await supabaseAdmin
      .from("access_code_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("access_code_id", code.id)
      .eq("team_id", data.teamId);
    if ((count ?? 0) >= ((code.per_team_limit as number) ?? 1))
      return { ok: false, message: "This team has already used that code." };

    const modules = ((code.modules as string[]) ?? []).filter((m): m is ModuleKey =>
      ALL_MODULES.includes(m as ModuleKey),
    );
    const expiresAt = code.grant_days
      ? new Date(Date.now() + (code.grant_days as number) * 86_400_000).toISOString()
      : null;

    const { error: grantErr } = await supabaseAdmin.from("complimentary_grants").insert({
      team_id: data.teamId,
      modules,
      reason: (code.label as string | null) ?? "Access code",
      source: "access_code",
      access_code_id: code.id,
      expires_at: expiresAt,
      created_by: context.userId,
    });
    if (grantErr) return { ok: false, message: "Could not apply that code. Try again." };

    await supabaseAdmin.from("access_code_redemptions").insert({
      access_code_id: code.id,
      team_id: data.teamId,
      user_id: context.userId,
      modules,
    });
    await supabaseAdmin
      .from("access_codes")
      .update({ uses: (code.uses as number) + 1 })
      .eq("id", code.id);

    return { ok: true, message: "Complimentary access applied to this team.", modules };
  });

export type AccessCodeRow = {
  id: string;
  hint: string;
  label: string | null;
  modules: ModuleKey[];
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  active: boolean;
};

export const listAccessCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessCodeRow[]> => {
    await assertAdmin(context.supabase as unknown as RpcClient);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("access_codes")
      .select("id,code_hint,label,modules,uses,max_uses,expires_at,active")
      .order("created_at", { ascending: false });
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r["id"] as string,
      hint: r["code_hint"] as string,
      label: (r["label"] as string | null) ?? null,
      modules: (r["modules"] as ModuleKey[]) ?? [],
      uses: (r["uses"] as number) ?? 0,
      maxUses: (r["max_uses"] as number | null) ?? null,
      expiresAt: (r["expires_at"] as string | null) ?? null,
      active: r["active"] === true,
    }));
  });

/** Owner-only. The plain code is returned once, here, and never stored. */
export const createAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(4).max(64),
        label: z.string().max(120).optional(),
        modules: z.array(moduleSchema).min(1),
        maxUses: z.number().int().positive().nullable().optional(),
        perTeamLimit: z.number().int().positive().default(1),
        grantDays: z.number().int().positive().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context.supabase as unknown as RpcClient);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clean = data.code.trim().toUpperCase();
    const { error } = await supabaseAdmin.from("access_codes").insert({
      code_hash: await hashCode(clean),
      code_hint: `${clean.slice(0, 3)}••••${clean.slice(-2)}`,
      label: data.label ?? null,
      modules: data.modules,
      max_uses: data.maxUses ?? null,
      per_team_limit: data.perTeamLimit,
      grant_days: data.grantDays ?? null,
      expires_at: data.expiresAt ?? null,
      created_by: context.userId,
    });
    if (error) return { ok: false, message: "That code already exists." };
    return { ok: true, message: "Access code created." };
  });

export const setAccessCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    await assertAdmin(context.supabase as unknown as RpcClient);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("access_codes").update({ active: data.active }).eq("id", data.id);
    return { ok: true };
  });
