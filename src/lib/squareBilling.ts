/**
 * Pure membership billing rules shared by checkout, the Square webhook and
 * tests. No secrets and no network here: callers pass in configuration.
 */
import { ALL_MODULES, planTier, priceFor, type ModuleKey, type PlanTier } from "./entitlements";

export type PaidTier = Exclude<PlanTier, "free">;

export type VariationMap = Partial<Record<PaidTier, string | null>>;

const TIER_SIZE: Record<PaidTier, number> = { single: 1, duo: 2, complete: 3 };

/** Monthly price the Square plan variation must charge, in cents. */
export function priceCentsFor(modules: ModuleKey[]): number {
  return priceFor(modules) * 100;
}

export function variationForModules(modules: ModuleKey[], map: VariationMap): string | null {
  const tier = planTier(modules);
  if (tier === "free") return null;
  return map[tier] ?? null;
}

export function tierForVariation(variationId: string | null | undefined, map: VariationMap): PaidTier | null {
  if (!variationId) return null;
  for (const tier of ["single", "duo", "complete"] as const) {
    if (map[tier] && map[tier] === variationId) return tier;
  }
  return null;
}

/** Square subscription status → CoachSide status. Unknown keeps the previous one. */
export function mapSquareStatus(status: string | null | undefined): string | null {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "PENDING":
      return "pending";
    case "PAUSED":
      return "grace";
    case "DEACTIVATED":
      return "past_due";
    case "CANCELED":
      return "canceled";
    default:
      return null;
  }
}

const PAID = new Set(["active", "grace", "past_due"]);
const LIVE_SUB = new Set(["active", "grace", "past_due", "pending"]);

export type BillingRowLike = {
  status?: string | null;
  billing_provider?: string | null;
  stripe_subscription_id?: string | null;
  square_subscription_id?: string | null;
  modules?: string[] | null;
  pending_modules?: string[] | null;
};

/**
 * Which processor handles this team's next billing action. A live legacy
 * Stripe subscription stays on Stripe until it is canceled; everything else
 * (new teams, canceled teams, Square teams) uses Square.
 */
export function billingProviderFor(row: BillingRowLike | null | undefined): "square" | "stripe" {
  if (!row) return "square";
  const status = row.status ?? "free";
  if (row.square_subscription_id && LIVE_SUB.has(status) && row.billing_provider === "square") return "square";
  if (row.stripe_subscription_id && LIVE_SUB.has(status) && row.billing_provider !== "square") return "stripe";
  return "square";
}

/** True when the team already pays through a Square subscription we should change instead of duplicating. */
export function hasLiveSquareSubscription(row: BillingRowLike | null | undefined): boolean {
  return !!row?.square_subscription_id && LIVE_SUB.has(row.status ?? "free") && row.billing_provider === "square";
}

/** A recent unpaid checkout for the same plan can be reopened instead of creating another. */
export function reusableCheckout(
  row: { square_checkout_url?: string | null; square_checkout_variation_id?: string | null; square_checkout_started_at?: string | null; pending_modules?: string[] | null } | null | undefined,
  variationId: string,
  modules: ModuleKey[],
  now = Date.now(),
  maxAgeMs = 30 * 60_000,
): string | null {
  if (!row?.square_checkout_url || row.square_checkout_variation_id !== variationId || !row.square_checkout_started_at) return null;
  if (now - new Date(row.square_checkout_started_at).getTime() > maxAgeMs) return null;
  const same =
    (row.pending_modules ?? []).length === modules.length && modules.every((m) => (row.pending_modules ?? []).includes(m));
  return same ? row.square_checkout_url : null;
}

/** Redirects only ever go back to CoachSide. */
export function safeReturnOrigin(origin: string | null | undefined, fallback = "https://coachside.live"): string {
  try {
    const u = new URL(origin ?? "");
    const host = u.hostname;
    const ok =
      (u.protocol === "https:" &&
        (host === "coachside.live" || host === "www.coachside.live" || host.endsWith(".lovable.app"))) ||
      (u.protocol === "http:" && host === "localhost");
    return ok ? u.origin : fallback;
  } catch {
    return fallback;
  }
}

export type SquareSubscriptionLike = {
  id: string;
  status?: string | null;
  plan_variation_id?: string | null;
  customer_id?: string | null;
  charged_through_date?: string | null;
  canceled_date?: string | null;
};

export type ReconcileInput = {
  prev: BillingRowLike | null;
  sub: SquareSubscriptionLike;
  variations: VariationMap;
};

export type ReconcileResult = {
  patch: Record<string, unknown> | null;
  error: string | null;
};

function clean(list: string[] | null | undefined): ModuleKey[] {
  return [...new Set((list ?? []).filter((m): m is ModuleKey => ALL_MODULES.includes(m as ModuleKey)))];
}

/** Square dates are YYYY-MM-DD. */
function dateToIso(d: string | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d.length === 10 ? `${d}T23:59:59Z` : d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/**
 * Turns the authoritative Square subscription into a team_billing patch.
 * Modules are only ever granted up to the number the paid plan covers, and
 * only from what the coach chose on CoachSide.
 */
export function reconcileSquareSubscription({ prev, sub, variations }: ReconcileInput): ReconcileResult {
  if (
    prev?.square_subscription_id &&
    prev.square_subscription_id !== sub.id &&
    PAID.has(prev.status ?? "") &&
    prev.billing_provider === "square" &&
    mapSquareStatus(sub.status) !== "canceled"
  ) {
    return {
      patch: null,
      error: `A second Square subscription (${sub.id}) was created for a team that already pays. Cancel one in Square.`,
    };
  }

  const status = mapSquareStatus(sub.status) ?? prev?.status ?? "free";
  const tier = tierForVariation(sub.plan_variation_id, variations);
  const pending = clean(prev?.pending_modules);
  const current = clean(prev?.modules);
  let modules: ModuleKey[] = [];
  let pendingAfter: ModuleKey[] | null = pending.length ? pending : null;
  let error: string | null = null;

  if (status === "canceled") {
    modules = [];
    pendingAfter = null;
  } else if (!tier) {
    modules = PAID.has(status) ? current : [];
    error = `Square plan variation ${sub.plan_variation_id ?? "(none)"} is not mapped to a CoachSide plan.`;
  } else if (PAID.has(status)) {
    const n = TIER_SIZE[tier];
    if (tier === "complete") {
      modules = [...ALL_MODULES];
      pendingAfter = null;
    } else if (pending.length === n) {
      modules = pending;
      pendingAfter = null;
    } else if (current.length === n) {
      modules = current;
    } else {
      modules = [...pending, ...current.filter((m) => !pending.includes(m))].slice(0, n);
      if (modules.length < n) error = "The paid plan covers more modules than were chosen — pick them on Membership.";
      else error = "The paid plan and the chosen modules did not match; access was limited to what was paid.";
    }
  } else {
    modules = [];
  }

  const cancelling = status !== "canceled" && !!sub.canceled_date;
  return {
    patch: {
      billing_provider: "square",
      square_subscription_id: sub.id,
      square_customer_id: sub.customer_id ?? null,
      square_plan_variation_id: sub.plan_variation_id ?? null,
      subscription_status: sub.status ?? null,
      status,
      modules,
      pending_modules: pendingAfter,
      pending_effective_at: pendingAfter ? dateToIso(sub.charged_through_date) : null,
      cancel_at_period_end: cancelling,
      current_period_end: dateToIso(cancelling ? sub.canceled_date : sub.charged_through_date),
      last_webhook_error: error,
      ...(status === "active" || status === "canceled"
        ? { square_checkout_link_id: null, square_checkout_order_id: null, square_checkout_url: null, square_checkout_variation_id: null, square_checkout_started_at: null }
        : {}),
    },
    error,
  };
}
