/**
 * Membership server functions. Every write happens here, never in the browser:
 * access codes are hashed, processor ids and secrets stay server-side, and
 * only coaches of a team may touch that team's membership.
 *
 * Square is the primary processor. A team with a live legacy Stripe
 * subscription keeps being managed on Stripe until it is canceled.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_MODULES, COMPLETE_NAME, MODULES, isComplete, type ModuleKey } from "./entitlements";
import {
  billingProviderFor,
  hasLiveSquareSubscription,
  priceCentsFor,
  reusableCheckout,
  safeReturnOrigin,
  variationForModules,
} from "./squareBilling";

const moduleSchema = z.enum(["playbook_plus", "gameday_plus", "team_hub_plus"]);

const GENERIC_UNAVAILABLE = "Checkout is temporarily unavailable.";
const SUPPORT_EMAIL = "support@coachside.live";

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

async function isAdmin(supabase: unknown): Promise<boolean> {
  const { data } = await (supabase as RpcClient).rpc("is_app_admin");
  return data === true;
}

async function hashCode(code: string): Promise<string> {
  const { hashAccessCode } = await import("./billing.server");
  return hashAccessCode(code);
}

function mask(value: string | null): string | null {
  if (!value) return null;
  return value.length <= 6 ? "••••" : `••••${value.slice(-6)}`;
}

/**
 * Database rules (e.g. GameDay+ stat tracking) read a mirror of the
 * BILLING_ENFORCEMENT_ENABLED secret. Keep it in step with the secret so the
 * kill switch reaches them too. Never blocks the caller.
 */
async function syncEnforcementMirror(enforced: boolean) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => { eq: (k: string, v: unknown) => { maybeSingle: () => PromiseLike<{ data: { enforced: boolean } | null }> } };
        upsert: (row: Record<string, unknown>) => PromiseLike<unknown>;
      };
    };
    const { data } = await db.from("billing_runtime").select("enforced").eq("id", true).maybeSingle();
    if (data?.enforced === enforced) return;
    await db.from("billing_runtime").upsert({ id: true, enforced, updated_at: new Date().toISOString() });
  } catch {
    /* mirror sync is best effort */
  }
}

function friendly(e: unknown): string {
  console.error("Membership billing error", e instanceof Error ? e.message : e);
  return `We couldn't reach the payment service. Please try again in a minute, or email ${SUPPORT_EMAIL}.`;
}

function planName(modules: ModuleKey[]): string {
  return isComplete(modules) ? COMPLETE_NAME : `CoachSide ${modules.map((m) => MODULES[m].name).join(" + ")}`;
}

export type BillingConfig = {
  enforcementEnabled: boolean;
  checkoutConfigured: boolean;
  /** Precise setup detail for owners; a generic line for everyone else. */
  checkoutReason: string | null;
};

/** Signed-in configuration. Never exposes secrets. */
export const getBillingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingConfig> => {
    const { enforcementEnabled, squareConfig } = await import("./billing.server");
    const cfg = squareConfig();
    const admin = cfg.configured ? false : await isAdmin(context.supabase);
    const enforced = enforcementEnabled();
    await syncEnforcementMirror(enforced);
    return {
      enforcementEnabled: enforced,
      checkoutConfigured: cfg.configured,
      checkoutReason: cfg.configured ? null : admin ? cfg.reason : GENERIC_UNAVAILABLE,
    };
  });

export type TeamBillingView = {
  teamId: string;
  status: string;
  modules: ModuleKey[];
  pendingModules: ModuleKey[] | null;
  pendingEffectiveAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  complimentary: boolean;
  complimentaryExpiresAt: string | null;
  /** Which processor manages this team's next change. */
  provider: "square" | "stripe";
  hasSubscription: boolean;
  /** False only when the processor this team needs is not configured. */
  checkoutAvailable: boolean;
  checkoutReason: string | null;
  subscriptionRef: string | null;
  lastWebhookAt: string | null;
  lastWebhookError: string | null;
  isAdmin: boolean;
};

const LIVE = ["active", "grace", "past_due", "pending"];

/** Coach-visible membership state for one team. */
export const getTeamBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TeamBillingView> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { squareConfig } = await import("./billing.server");
    const { stripeConfig } = await import("./stripe.server");
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
    const admin = await isAdmin(context.supabase);

    const live = (grants ?? []).filter(
      (g) => !g.expires_at || new Date(g.expires_at as string).getTime() > Date.now(),
    );
    const compModules = live.flatMap((g) => (g.modules ?? []) as string[]);
    const paid = ((row?.modules as string[]) ?? []).filter(() =>
      ["active", "grace", "past_due", "complimentary"].includes((row?.status as string) ?? ""),
    );
    const modules = [...new Set([...paid, ...compModules])].filter((m): m is ModuleKey =>
      ALL_MODULES.includes(m as ModuleKey),
    );

    const provider = billingProviderFor(row);
    const status = (row?.status as string) ?? "free";
    const subId = provider === "stripe" ? row?.stripe_subscription_id ?? null : row?.square_subscription_id ?? null;
    const hasSubscription = !!subId && LIVE.includes(status);
    let checkoutAvailable = true;
    let checkoutReason: string | null = null;
    if (provider === "square") {
      const cfg = squareConfig();
      checkoutAvailable = cfg.configured;
      checkoutReason = cfg.configured ? null : admin ? cfg.reason : GENERIC_UNAVAILABLE;
    } else if (!stripeConfig().secretPresent) {
      checkoutAvailable = false;
      checkoutReason = admin ? "This team is on a legacy Stripe subscription, but the Stripe server secret is missing." : GENERIC_UNAVAILABLE;
    }

    return {
      teamId: data.teamId,
      status,
      modules,
      pendingModules: (row?.pending_modules as ModuleKey[] | null) ?? null,
      pendingEffectiveAt: (row?.pending_effective_at as string | null) ?? null,
      currentPeriodEnd: (row?.current_period_end as string | null) ?? null,
      cancelAtPeriodEnd: !!row?.cancel_at_period_end,
      complimentary: live.length > 0,
      complimentaryExpiresAt: (live[0]?.expires_at as string | null) ?? null,
      provider,
      hasSubscription,
      checkoutAvailable,
      checkoutReason,
      subscriptionRef: admin ? mask(subId) : null,
      lastWebhookAt: admin ? ((row?.last_webhook_at as string | null) ?? null) : null,
      lastWebhookError: admin ? ((row?.last_webhook_error as string | null) ?? null) : null,
      isAdmin: admin,
    };
  });

export type CheckoutResult =
  | { ok: true; url: string; message?: string }
  | { ok: false; reason: string; setupIncomplete: boolean };

type BillingRow = Record<string, unknown> & {
  status?: string | null;
  square_subscription_id?: string | null;
  square_customer_id?: string | null;
  square_plan_variation_id?: string | null;
  stripe_subscription_id?: string | null;
  cancel_at_period_end?: boolean | null;
};

/** Legacy Stripe teams: change the existing subscription only, never start a new Stripe checkout. */
async function changeLegacyStripe(input: {
  teamId: string;
  userId: string;
  modules: ModuleKey[];
  origin: string;
  row: BillingRow;
}): Promise<CheckoutResult> {
  const st = await import("./stripe.server");
  if (!st.stripeConfig().secretPresent) return { ok: false, reason: GENERIC_UNAVAILABLE, setupIncomplete: true };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const plan = st.planKeyFor(input.modules);
  const db = supabaseAdmin as never as Parameters<typeof st.resolvePrices>[0];
  const priceId = plan ? await st.priceIdFor(db, plan) : null;
  const subId = input.row.stripe_subscription_id;
  if (!plan || !priceId || !subId) return { ok: false, reason: GENERIC_UNAVAILABLE, setupIncomplete: true };
  type Sub = { items: { data: { id: string }[] } };
  const sub = await st.stripe<Sub>("GET", `/subscriptions/${subId}`);
  await st.stripe(
    "POST",
    `/subscriptions/${subId}`,
    {
      "items[0][id]": sub.items.data[0]?.id,
      "items[0][price]": priceId,
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      "metadata[team_id]": input.teamId,
      "metadata[billing_owner]": input.userId,
      "metadata[plan_key]": plan,
    },
    `swap-${subId}-${priceId}`,
  );
  await supabaseAdmin.from("team_billing").update({ pending_modules: input.modules }).eq("team_id", input.teamId);
  await supabaseAdmin.from("product_activity_events").insert({ user_id: input.userId, event_type: "upgrade", team_id: input.teamId });
  return { ok: true, url: `${input.origin}/membership?changed=stripe` };
}

/**
 * Starts Square-hosted checkout for the team's single subscription, or
 * changes the existing subscription (never a second one). Only the webhook
 * activates paid access — never this call or the browser redirect.
 */
export const startTeamCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ teamId: z.string().uuid(), modules: z.array(moduleSchema).min(1), origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const modules = [...new Set(data.modules)] as ModuleKey[];
    const origin = safeReturnOrigin(data.origin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rowData } = await supabaseAdmin.from("team_billing").select("*").eq("team_id", data.teamId).maybeSingle();
    const row = (rowData ?? null) as BillingRow | null;

    try {
      if (row && billingProviderFor(row) === "stripe") {
        return await changeLegacyStripe({ teamId: data.teamId, userId: context.userId, modules, origin, row });
      }

      const sq = await import("./billing.server");
      const cfg = sq.squareConfig();
      if (!cfg.configured) {
        const admin = await isAdmin(context.supabase);
        return { ok: false, reason: admin && cfg.reason ? cfg.reason : GENERIC_UNAVAILABLE, setupIncomplete: true };
      }
      const variation = variationForModules(modules, sq.variationMap());
      if (!variation) return { ok: false, reason: GENERIC_UNAVAILABLE, setupIncomplete: true };

      // Existing Square subscription: change it in place.
      if (row && hasLiveSquareSubscription(row)) {
        const subId = row.square_subscription_id!;
        if (row.cancel_at_period_end) {
          await sq.undoScheduledCancel(subId);
          await supabaseAdmin.from("team_billing").update({ cancel_at_period_end: false }).eq("team_id", data.teamId);
        }
        if (row.square_plan_variation_id === variation) {
          // Same price tier: just swap which modules are on, no charge change.
          const patch = row.status === "active" ? { modules, pending_modules: null, pending_effective_at: null } : { pending_modules: modules };
          await supabaseAdmin.from("team_billing").update(patch).eq("team_id", data.teamId);
          return { ok: true, url: `${origin}/membership?changed=now` };
        }
        const { sub } = await sq.getSubscription(subId);
        await sq.swapSubscriptionPlan(subId, variation);
        const effective = sub.charged_through_date ? new Date(`${sub.charged_through_date}T00:00:00Z`).toISOString() : null;
        await supabaseAdmin
          .from("team_billing")
          .update({ pending_modules: modules, pending_effective_at: effective, billing_owner: context.userId })
          .eq("team_id", data.teamId);
        await supabaseAdmin.from("product_activity_events").insert({ user_id: context.userId, event_type: "upgrade", team_id: data.teamId });
        return { ok: true, url: `${origin}/membership?changed=renewal` };
      }

      // A recent unpaid checkout for the same plan is reopened, not duplicated.
      const reuse = reusableCheckout(row as never, variation, modules);
      if (reuse) return { ok: true, url: reuse };

      const { data: profile } = await supabaseAdmin.from("profiles").select("email,full_name").eq("id", context.userId).maybeSingle();
      const email = (profile?.email as string | null) ?? null;
      const customerId = await sq.findOrCreateCustomer({
        existingId: row?.square_customer_id ?? null,
        email,
        name: (profile?.full_name as string | null) ?? null,
        referenceId: data.teamId,
        idempotencyKey: `cust-${data.teamId}`,
      });
      // Same team + plan within a 30-minute window → Square returns the same link.
      const bucket = Math.floor(Date.now() / (30 * 60_000));
      const link = await sq.createSubscriptionCheckout({
        planVariationId: variation,
        priceCents: priceCentsFor(modules),
        teamId: data.teamId,
        redirectUrl: `${origin}/membership?checkout=complete&team=${data.teamId}`,
        name: planName(modules),
        buyerEmail: email,
        idempotencyKey: `link-${data.teamId}-${[...modules].sort().join(".")}-${bucket}`,
      });

      await supabaseAdmin.from("team_billing").upsert(
        {
          team_id: data.teamId,
          billing_owner: context.userId,
          square_customer_id: customerId,
          pending_modules: modules,
          square_checkout_link_id: link.id,
          square_checkout_order_id: link.orderId,
          square_checkout_url: link.url,
          square_checkout_variation_id: variation,
          square_checkout_started_at: new Date().toISOString(),
        },
        { onConflict: "team_id" },
      );
      await supabaseAdmin.from("product_activity_events").insert({ user_id: context.userId, event_type: "checkout_started", team_id: data.teamId });
      return { ok: true, url: link.url };
    } catch (e) {
      return { ok: false, reason: friendly(e), setupIncomplete: false };
    }
  });

/** Legacy Stripe teams only: Stripe Customer Portal. Square teams manage their plan on Membership. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("team_billing").select("*").eq("team_id", data.teamId).maybeSingle();
    if (billingProviderFor(row) !== "stripe" || !row?.stripe_customer_id) {
      return {
        ok: false,
        reason: `Change your plan or cancel right here on Membership. For card or receipt questions, email ${SUPPORT_EMAIL}.`,
        setupIncomplete: false,
      };
    }
    const st = await import("./stripe.server");
    if (!st.stripeConfig().secretPresent) return { ok: false, reason: GENERIC_UNAVAILABLE, setupIncomplete: true };
    try {
      const s = await st.stripe<{ url: string }>("POST", "/billing_portal/sessions", {
        customer: row.stripe_customer_id,
        return_url: `${safeReturnOrigin(data.origin)}/membership`,
      });
      return { ok: true, url: s.url };
    } catch (e) {
      return { ok: false, reason: friendly(e), setupIncomplete: false };
    }
  });

export type CancelResult = { ok: boolean; reason?: string; endsAt?: string | null };

/** Cancel at period end: access and data stay until the paid period ends. */
export const cancelTeamMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CancelResult> => {
    await assertCoach(context.supabase as unknown as RpcClient, data.teamId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("team_billing").select("*").eq("team_id", data.teamId).maybeSingle();
    const provider = billingProviderFor(row);
    try {
      if (provider === "stripe" && row?.stripe_subscription_id) {
        const st = await import("./stripe.server");
        if (!st.stripeConfig().secretPresent) return { ok: false, reason: GENERIC_UNAVAILABLE };
        await st.stripe("POST", `/subscriptions/${row.stripe_subscription_id}`, { cancel_at_period_end: true });
        await supabaseAdmin.from("team_billing").update({ cancel_at_period_end: true }).eq("team_id", data.teamId);
      } else if (row && hasLiveSquareSubscription(row)) {
        if (row.cancel_at_period_end) return { ok: true, endsAt: row.current_period_end };
        const sq = await import("./billing.server");
        if (!sq.squareConfig().configured) return { ok: false, reason: GENERIC_UNAVAILABLE };
        const sub = await sq.cancelSubscription(row.square_subscription_id!);
        const endsAt = sub.canceled_date ? new Date(`${sub.canceled_date}T23:59:59Z`).toISOString() : row.current_period_end;
        await supabaseAdmin
          .from("team_billing")
          .update({ cancel_at_period_end: true, current_period_end: endsAt, pending_modules: null, pending_effective_at: null })
          .eq("team_id", data.teamId);
        await supabaseAdmin.from("product_activity_events").insert({ user_id: context.userId, event_type: "cancel", team_id: data.teamId });
        return { ok: true, endsAt };
      } else {
        return { ok: false, reason: "This team has no paid membership to cancel." };
      }
    } catch (e) {
      return { ok: false, reason: friendly(e) };
    }
    await supabaseAdmin.from("product_activity_events").insert({ user_id: context.userId, event_type: "cancel", team_id: data.teamId });
    return { ok: true, endsAt: row?.current_period_end ?? null };
  });

export type SquareBillingDiagnostics = import("./billing.server").SquareDiagnostics & {
  enforcementEnabled: boolean;
  squareTeams: { status: string; count: number }[];
  legacyStripeLive: number;
  openCheckouts: number;
  lastWebhookAt: string | null;
  recentEvents: { type: string; processed: boolean; error: string | null; receivedAt: string }[];
};

/** Owner-only processor diagnostics: yes/no flags, never secret values. */
export const getSquareBillingDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SquareBillingDiagnostics> => {
    await assertAdmin(context.supabase as unknown as RpcClient);
    const sq = await import("./billing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [rows, events] = await Promise.all([
      supabaseAdmin.from("team_billing").select("status, billing_provider, square_subscription_id, stripe_subscription_id, square_checkout_link_id, cancel_at_period_end"),
      supabaseAdmin.from("billing_webhook_events").select("event_type, processed, error, received_at").eq("provider", "square").order("received_at", { ascending: false }).limit(15),
    ]);
    const all = rows.data ?? [];
    const counts = new Map<string, number>();
    for (const r of all.filter((x) => x.square_subscription_id)) {
      const k = r.cancel_at_period_end ? `${r.status} (ends at period end)` : r.status;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const ev = events.data ?? [];
    return {
      ...sq.squareDiagnostics(),
      enforcementEnabled: sq.enforcementEnabled(),
      squareTeams: [...counts].map(([status, count]) => ({ status, count })),
      legacyStripeLive: all.filter((r) => billingProviderFor(r) === "stripe").length,
      openCheckouts: all.filter((r) => r.square_checkout_link_id && !r.square_subscription_id).length,
      lastWebhookAt: ev[0]?.received_at ?? null,
      recentEvents: ev.map((e) => ({ type: e.event_type, processed: e.processed, error: e.error, receivedAt: e.received_at })),
    };
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
