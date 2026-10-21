/**
 * Server-only Square boundary — the primary membership processor.
 *
 * No Square token, signature key or catalog id ever reaches the browser, and
 * nothing here invents credentials: when configuration is missing the callers
 * report "setup incomplete" instead of pretending a checkout worked.
 *
 * Project secrets (Project Settings → Secrets):
 *   SQUARE_ACCESS_TOKEN            server API token
 *   SQUARE_ENVIRONMENT             "production" | "sandbox" (default sandbox)
 *   SQUARE_LOCATION_ID             location the subscription is sold from
 *   SQUARE_WEBHOOK_SIGNATURE_KEY   verifies incoming webhooks
 *   SQUARE_APP_ID                  optional, only if a client SDK is added
 *   SQUARE_PLAN_VARIATION_SINGLE   $6/month plan variation id (one module)
 *   SQUARE_PLAN_VARIATION_DUO      $12/month plan variation id (two modules)
 *   SQUARE_PLAN_VARIATION_COMPLETE $15/month plan variation id (Complete)
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PlanTier } from "./entitlements";
import type { VariationMap } from "./squareBilling";

export const SQUARE_ENV_KEYS = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_ENVIRONMENT",
  "SQUARE_LOCATION_ID",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_PLAN_VARIATION_SINGLE",
  "SQUARE_PLAN_VARIATION_DUO",
  "SQUARE_PLAN_VARIATION_COMPLETE",
] as const;

export const WEBHOOK_PATH = "/api/public/square/webhook";
export const PRODUCTION_ORIGIN = "https://coachside.live";
/** Must match the notification URL registered in Square exactly (it is part of the signature). */
export const WEBHOOK_URL = `${PRODUCTION_ORIGIN}${WEBHOOK_PATH}`;

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export function squareEnvironment(): "production" | "sandbox" {
  return env("SQUARE_ENVIRONMENT")?.toLowerCase() === "production" ? "production" : "sandbox";
}

export function squareApiBase(): string {
  return squareEnvironment() === "production"
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
      reason: `Square checkout is not set up yet. Missing server settings: ${missing.join(", ")}.`,
    };
  }
  return { configured: true, missing: [], reason: null };
}

export type SquareDiagnostics = {
  provider: "Square";
  environment: "production" | "sandbox";
  environmentExplicit: boolean;
  accessToken: boolean;
  location: boolean;
  webhookSignature: boolean;
  appId: boolean;
  variations: { single: boolean; duo: boolean; complete: boolean };
  webhookUrl: string;
  configured: boolean;
  missing: string[];
};

/** Yes/no only — never a value, prefix or length. */
export function squareDiagnostics(): SquareDiagnostics {
  const cfg = squareConfig();
  return {
    provider: "Square",
    environment: squareEnvironment(),
    environmentExplicit: !!env("SQUARE_ENVIRONMENT"),
    accessToken: !!env("SQUARE_ACCESS_TOKEN"),
    location: !!env("SQUARE_LOCATION_ID"),
    webhookSignature: !!env("SQUARE_WEBHOOK_SIGNATURE_KEY"),
    appId: !!env("SQUARE_APP_ID"),
    variations: {
      single: !!env("SQUARE_PLAN_VARIATION_SINGLE"),
      duo: !!env("SQUARE_PLAN_VARIATION_DUO"),
      complete: !!env("SQUARE_PLAN_VARIATION_COMPLETE"),
    },
    webhookUrl: WEBHOOK_URL,
    configured: cfg.configured,
    missing: cfg.missing,
  };
}

/** Enforcement stays off until this is explicitly switched on. */
export function enforcementEnabled(): boolean {
  return (env("BILLING_ENFORCEMENT_ENABLED") ?? "").toLowerCase() === "true";
}

export function variationMap(): VariationMap {
  return {
    single: env("SQUARE_PLAN_VARIATION_SINGLE"),
    duo: env("SQUARE_PLAN_VARIATION_DUO"),
    complete: env("SQUARE_PLAN_VARIATION_COMPLETE"),
  };
}

export function planVariationId(tier: PlanTier): string | null {
  if (tier === "free") return null;
  return variationMap()[tier] ?? null;
}

export class SquareError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function squareFetch<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
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
    const errs = (body["errors"] as { detail?: string; code?: string }[] | undefined) ?? [];
    console.error("Square error", path, res.status, errs[0]?.code);
    throw new SquareError(errs[0]?.detail ?? `Square request failed (${res.status})`, res.status);
  }
  return body as T;
}

/** Reuse the Square customer for this billing owner, or create one. */
export async function findOrCreateCustomer(input: {
  existingId: string | null;
  email: string | null;
  name: string | null;
  referenceId: string;
  idempotencyKey: string;
}): Promise<string> {
  if (input.existingId) return input.existingId;
  if (input.email) {
    const found = await squareFetch<{ customers?: { id: string }[] }>("/v2/customers/search", {
      method: "POST",
      body: JSON.stringify({ limit: 1, query: { filter: { email_address: { exact: input.email } } } }),
    });
    if (found.customers?.length) return found.customers[0]!.id;
  }
  const created = await squareFetch<{ customer?: { id: string } }>("/v2/customers", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      email_address: input.email ?? undefined,
      given_name: input.name ?? undefined,
      reference_id: input.referenceId,
    }),
  });
  if (!created.customer?.id) throw new Error("Square did not return a customer.");
  return created.customer.id;
}

export async function getCustomerEmail(customerId: string): Promise<string | null> {
  const res = await squareFetch<{ customer?: { email_address?: string } }>(`/v2/customers/${customerId}`);
  return res.customer?.email_address?.toLowerCase() ?? null;
}

/** Square-hosted checkout for one recurring team plan variation. */
export async function createSubscriptionCheckout(input: {
  planVariationId: string;
  priceCents: number;
  teamId: string;
  redirectUrl: string;
  name: string;
  buyerEmail: string | null;
  idempotencyKey: string;
}): Promise<{ id: string; url: string; orderId: string | null }> {
  const res = await squareFetch<{ payment_link?: { id?: string; url?: string; order_id?: string } }>(
    "/v2/online-checkout/payment-links",
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: input.idempotencyKey,
        description: input.name,
        quick_pay: {
          name: input.name,
          price_money: { amount: input.priceCents, currency: "USD" },
          location_id: env("SQUARE_LOCATION_ID"),
        },
        checkout_options: {
          subscription_plan_id: input.planVariationId,
          redirect_url: input.redirectUrl,
          ask_for_shipping_address: false,
        },
        pre_populated_data: input.buyerEmail ? { buyer_email: input.buyerEmail } : {},
        payment_note: `CoachSide team ${input.teamId}`,
      }),
    },
  );
  const link = res.payment_link;
  if (!link?.url || !link.id) throw new Error("Square did not return a checkout link.");
  return { id: link.id, url: link.url, orderId: link.order_id ?? null };
}

export type SquareSubscription = {
  id: string;
  status?: string;
  plan_variation_id?: string;
  customer_id?: string;
  location_id?: string;
  charged_through_date?: string;
  canceled_date?: string;
  invoice_ids?: string[];
};

type SquareAction = { id: string; type: string; effective_date?: string; new_plan_variation_id?: string };

export async function getSubscription(subscriptionId: string): Promise<{ sub: SquareSubscription; actions: SquareAction[] }> {
  const res = await squareFetch<{ subscription?: SquareSubscription; actions?: SquareAction[] }>(
    `/v2/subscriptions/${encodeURIComponent(subscriptionId)}?include=actions`,
  );
  if (!res.subscription?.id) throw new Error("Square did not return the subscription.");
  return { sub: res.subscription, actions: res.actions ?? [] };
}

/**
 * Square applies plan swaps at the start of the next billing period. Any
 * earlier scheduled swap is replaced so only one change is ever pending.
 */
export async function swapSubscriptionPlan(subscriptionId: string, newPlanVariationId: string): Promise<SquareSubscription> {
  const { actions } = await getSubscription(subscriptionId);
  for (const a of actions.filter((x) => x.type === "SWAP_PLAN")) await deleteSubscriptionAction(subscriptionId, a.id);
  const res = await squareFetch<{ subscription?: SquareSubscription }>(
    `/v2/subscriptions/${encodeURIComponent(subscriptionId)}/swap-plan`,
    { method: "POST", body: JSON.stringify({ new_plan_variation_id: newPlanVariationId }) },
  );
  return res.subscription ?? { id: subscriptionId };
}

export async function deleteSubscriptionAction(subscriptionId: string, actionId: string): Promise<void> {
  await squareFetch(`/v2/subscriptions/${encodeURIComponent(subscriptionId)}/actions/${encodeURIComponent(actionId)}`, {
    method: "DELETE",
  });
}

/** Removes a scheduled cancellation so the membership simply continues. */
export async function undoScheduledCancel(subscriptionId: string): Promise<boolean> {
  const { actions } = await getSubscription(subscriptionId);
  const cancels = actions.filter((a) => a.type === "CANCEL");
  for (const a of cancels) await deleteSubscriptionAction(subscriptionId, a.id);
  return cancels.length > 0;
}

/** Square ends the subscription at the end of the paid period (canceled_date). Never deletes team data. */
export async function cancelSubscription(subscriptionId: string): Promise<SquareSubscription> {
  const res = await squareFetch<{ subscription?: SquareSubscription }>(
    `/v2/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { method: "POST" },
  );
  return res.subscription ?? { id: subscriptionId };
}

export async function getInvoice(invoiceId: string): Promise<{ order_id?: string; subscription_id?: string } | null> {
  const res = await squareFetch<{ invoice?: { order_id?: string; subscription_id?: string } }>(
    `/v2/invoices/${encodeURIComponent(invoiceId)}`,
  );
  return res.invoice ?? null;
}

/** Square signs notificationUrl + raw body with the webhook signature key (HMAC-SHA256, base64). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, notificationUrl: string): boolean {
  const key = env("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!key || !signature) return false;
  const expected = createHmac("sha256", key).update(notificationUrl + rawBody).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Access codes are stored hashed; the plain code is never persisted. */
export function hashAccessCode(code: string): string {
  const pepper = process.env["ACCESS_CODE_PEPPER"] ?? "";
  return createHash("sha256").update(`${pepper}:${code.trim().toUpperCase()}`).digest("hex");
}
