/**
 * Server-only Square boundary.
 *
 * No Square token, signature key or catalog id ever reaches the browser, and
 * nothing here invents credentials: when configuration is missing the callers
 * report "setup incomplete" instead of pretending a checkout worked.
 *
 * Required project secrets (add later in Project Settings → Secrets):
 *   SQUARE_ACCESS_TOKEN            server API token
 *   SQUARE_ENVIRONMENT             "sandbox" | "production" (default sandbox)
 *   SQUARE_LOCATION_ID             location the subscription is sold from
 *   SQUARE_WEBHOOK_SIGNATURE_KEY   verifies incoming webhooks
 *   SQUARE_APP_ID                  optional, only if a client SDK is added
 *   SQUARE_PLAN_VARIATION_SINGLE   $6/month plan variation id
 *   SQUARE_PLAN_VARIATION_DUO      $12/month plan variation id
 *   SQUARE_PLAN_VARIATION_COMPLETE $15/month plan variation id
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanTier } from "./entitlements";

export const SQUARE_ENV_KEYS = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_LOCATION_ID",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_PLAN_VARIATION_SINGLE",
  "SQUARE_PLAN_VARIATION_DUO",
  "SQUARE_PLAN_VARIATION_COMPLETE",
] as const;

export const WEBHOOK_PATH = "/api/public/square/webhook";
export const PRODUCTION_ORIGIN = "https://coachside.live";
export const WEBHOOK_URL = `${PRODUCTION_ORIGIN}${WEBHOOK_PATH}`;

function env(name: string): string | null {
  return process.env[name] ?? null;
}

export function squareApiBase(): string {
  return env("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export type SquareConfig = { configured: boolean; missing: string[]; reason: string | null };

export function squareConfig(): SquareConfig {
  const missing = SQUARE_ENV_KEYS.filter((k) => !env(k));
  if (missing.length) {
    return {
      configured: false,
      missing: [...missing],
      reason: `Checkout is not set up yet. Missing server settings: ${missing.join(", ")}.`,
    };
  }
  return { configured: true, missing: [], reason: null };
}

/** Enforcement stays off until this is explicitly switched on. */
export function enforcementEnabled(): boolean {
  return (env("BILLING_ENFORCEMENT_ENABLED") ?? "").toLowerCase() === "true";
}

export function planVariationId(tier: PlanTier): string | null {
  if (tier === "single") return env("SQUARE_PLAN_VARIATION_SINGLE");
  if (tier === "duo") return env("SQUARE_PLAN_VARIATION_DUO");
  if (tier === "complete") return env("SQUARE_PLAN_VARIATION_COMPLETE");
  return null;
}

async function squareFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${squareApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env("SQUARE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-01-23",
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errs = (body["errors"] as { detail?: string }[] | undefined) ?? [];
    throw new Error(errs[0]?.detail ?? `Square request failed (${res.status})`);
  }
  return body;
}

/** Reuse a Square customer for this billing owner, or create one. */
export async function findOrCreateCustomer(input: {
  existingId: string | null;
  email: string | null;
  name: string | null;
  referenceId: string;
}): Promise<string> {
  if (input.existingId) return input.existingId;
  if (input.email) {
    const found = (await squareFetch("/v2/customers/search", {
      method: "POST",
      body: JSON.stringify({
        limit: 1,
        query: { filter: { email_address: { exact: input.email } } },
      }),
    })) as { customers?: { id: string }[] };
    if (found.customers?.length) return found.customers[0]!.id;
  }
  const created = (await squareFetch("/v2/customers", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      email_address: input.email ?? undefined,
      given_name: input.name ?? undefined,
      reference_id: input.referenceId,
    }),
  })) as { customer?: { id: string } };
  if (!created.customer?.id) throw new Error("Square did not return a customer.");
  return created.customer.id;
}

/** Hosted checkout link for one recurring team plan. */
export async function createSubscriptionCheckout(input: {
  planVariationId: string;
  customerId: string;
  teamId: string;
  redirectUrl: string;
  note: string;
}): Promise<string> {
  const res = (await squareFetch("/v2/online-checkout/payment-links", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      description: input.note,
      quick_pay: {
        name: input.note,
        price_money: { amount: 0, currency: "USD" },
        location_id: env("SQUARE_LOCATION_ID"),
      },
      checkout_options: {
        subscription_plan_id: input.planVariationId,
        redirect_url: input.redirectUrl,
        ask_for_shipping_address: false,
      },
      pre_populated_data: {},
      payment_note: `team:${input.teamId}`,
    }),
  })) as { payment_link?: { url?: string } };
  if (!res.payment_link?.url) throw new Error("Square did not return a checkout link.");
  return res.payment_link.url;
}

/** Move an existing subscription between the $6 / $12 / $15 variations. */
export async function swapSubscriptionPlan(
  subscriptionId: string,
  newPlanVariationId: string,
): Promise<void> {
  await squareFetch(`/v2/subscriptions/${subscriptionId}/swap-plan`, {
    method: "POST",
    body: JSON.stringify({ new_plan_variation_id: newPlanVariationId }),
  });
}

/** Ends at the end of the paid period; never deletes team data. */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await squareFetch(`/v2/subscriptions/${subscriptionId}/cancel`, { method: "POST" });
}

export async function getSubscription(subscriptionId: string): Promise<{
  status?: string;
  charged_through_date?: string;
  plan_variation_id?: string;
  customer_id?: string;
}> {
  const res = (await squareFetch(`/v2/subscriptions/${subscriptionId}`)) as {
    subscription?: Record<string, string>;
  };
  return res.subscription ?? {};
}

/** Square signs notificationUrl + raw body with the webhook signature key. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  notificationUrl: string,
): boolean {
  const key = env("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!key || !signature) return false;
  const expected = createHmac("sha256", key)
    .update(notificationUrl + rawBody)
    .digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Square subscription status → CoachSide billing status. */
export function mapSquareStatus(status: string | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "PENDING":
      return "pending";
    case "PAUSED":
    case "DEACTIVATED":
      return "grace";
    case "CANCELED":
      return "canceled";
    default:
      return "free";
  }
}
