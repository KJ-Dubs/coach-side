/**
 * Server-only Stripe adapter (replaces the Square adapter for memberships).
 *
 * Secrets (Project Settings → Secrets), never in browser code:
 *   STRIPE_SECRET_KEY      sk_test_… now, sk_live_… after QA
 *   STRIPE_WEBHOOK_SECRET  whsec_… from the Stripe webhook endpoint
 *
 * Price resolution order per plan: owner price map (Launch QA) →
 * env STRIPE_PRICE_<PLAN> → built-in TEST ids (test keys only) → lookup_key.
 * Live ids are never assumed; they must be mapped after QA.
 */
import type { ModuleKey } from "./entitlements";

export type PlanKey =
  | "playbook_plus"
  | "gameday_plus"
  | "team_hub_plus"
  | "playbook_plus+gameday_plus"
  | "playbook_plus+team_hub_plus"
  | "gameday_plus+team_hub_plus"
  | "complete";

export const PLAN_ORDER: PlanKey[] = [
  "playbook_plus",
  "gameday_plus",
  "team_hub_plus",
  "playbook_plus+gameday_plus",
  "playbook_plus+team_hub_plus",
  "gameday_plus+team_hub_plus",
  "complete",
];

/** Sandbox price ids supplied by the owner. Not secrets; used only with sk_test_ keys. */
export const TEST_PRICES: Record<PlanKey, string> = {
  playbook_plus: "price_1UJMZHA4w9aPCNC0ThFVnIDC",
  gameday_plus: "price_1UJMZUA4w9aPCNC09bXpNa8c",
  team_hub_plus: "price_1UJMZVA4w9aPCNC0hWzzKTxF",
  "playbook_plus+gameday_plus": "price_1UJMZXA4w9aPCNC0njKrTesM",
  "playbook_plus+team_hub_plus": "price_1UJMZZA4w9aPCNC0I3HwffgH",
  "gameday_plus+team_hub_plus": "price_1UJMZaA4w9aPCNC0qmKRG8J9",
  complete: "price_1UJMZcA4w9aPCNC0I4G6YcxY",
};

export const LOOKUP_KEYS: Record<PlanKey, string> = {
  playbook_plus: "coachside_playbook_plus_monthly",
  gameday_plus: "coachside_gameday_plus_monthly",
  team_hub_plus: "coachside_team_hub_plus_monthly",
  "playbook_plus+gameday_plus": "coachside_playbook_gameday_monthly",
  "playbook_plus+team_hub_plus": "coachside_playbook_team_hub_monthly",
  "gameday_plus+team_hub_plus": "coachside_gameday_team_hub_monthly",
  complete: "coachside_complete_monthly",
};

const ORDER: ModuleKey[] = ["playbook_plus", "gameday_plus", "team_hub_plus"];

export function planKeyFor(modules: ModuleKey[]): PlanKey | null {
  const set = ORDER.filter((m) => modules.includes(m));
  if (set.length === 0) return null;
  if (set.length === 3) return "complete";
  return set.join("+") as PlanKey;
}

export function modulesFor(plan: PlanKey | null): ModuleKey[] {
  if (!plan) return [];
  return plan === "complete" ? [...ORDER] : (plan.split("+") as ModuleKey[]);
}

export type StripeMode = "not_configured" | "test" | "live";

export function stripeMode(): StripeMode {
  const k = process.env["STRIPE_SECRET_KEY"] ?? "";
  if (!k) return "not_configured";
  return k.startsWith("sk_live_") || k.startsWith("rk_live_") ? "live" : "test";
}

export function stripeConfig() {
  const mode = stripeMode();
  const webhook = Boolean(process.env["STRIPE_WEBHOOK_SECRET"]);
  return {
    mode,
    secretPresent: mode !== "not_configured",
    webhookSecretPresent: webhook,
    reason: mode === "not_configured" ? "Stripe server secret not configured" : !webhook ? "Stripe webhook secret not configured" : null,
  };
}

type Params = Record<string, string | number | boolean | null | undefined>;

export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params?: Params, idempotencyKey?: string): Promise<T> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe server secret not configured");
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null) body.append(k, String(v));
  const url = `https://api.stripe.com/v1${path}${method === "GET" && params ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "GET" ? undefined : body,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("Stripe error", path, json.error?.message);
    throw new Error(json.error?.message ?? `Stripe request failed (${res.status})`);
  }
  return json;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

/** Resolves every plan's price id and where it came from. */
export async function resolvePrices(db: Db): Promise<{ plan: PlanKey; priceId: string | null; source: string }[]> {
  const { data } = await db.from("billing_price_map").select("plan_key, stripe_price_id");
  const map = new Map(((data ?? []) as { plan_key: string; stripe_price_id: string | null }[]).map((r) => [r.plan_key, r.stripe_price_id]));
  const mode = stripeMode();
  return PLAN_ORDER.map((plan) => {
    const fromMap = map.get(plan);
    if (fromMap) return { plan, priceId: fromMap, source: "Launch QA map" };
    const envId = process.env[`STRIPE_PRICE_${plan.replace(/\+/g, "_").toUpperCase()}`];
    if (envId) return { plan, priceId: envId, source: "server setting" };
    if (mode !== "live") return { plan, priceId: TEST_PRICES[plan], source: "test default" };
    return { plan, priceId: null, source: "missing (lookup key fallback)" };
  });
}

export async function priceIdFor(db: Db, plan: PlanKey): Promise<string | null> {
  const row = (await resolvePrices(db)).find((r) => r.plan === plan);
  if (row?.priceId) return row.priceId;
  const found = await stripe<{ data: { id: string }[] }>("GET", "/prices", { "lookup_keys[]": LOOKUP_KEYS[plan], active: true, limit: 1 });
  return found.data[0]?.id ?? null;
}

export async function planForPrice(db: Db, priceId: string | null, lookupKey?: string | null): Promise<PlanKey | null> {
  if (lookupKey) {
    const hit = (Object.entries(LOOKUP_KEYS) as [PlanKey, string][]).find(([, v]) => v === lookupKey);
    if (hit) return hit[0];
  }
  if (!priceId) return null;
  const hit = (await resolvePrices(db)).find((r) => r.priceId === priceId);
  if (hit) return hit.plan;
  const t = (Object.entries(TEST_PRICES) as [PlanKey, string][]).find(([, v]) => v === priceId);
  return t ? t[0] : null;
}

/** Stripe subscription status → CoachSide status. */
export function mapStatus(s: string | null | undefined): string {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "grace";
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "pending";
  }
}
