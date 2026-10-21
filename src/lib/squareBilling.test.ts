import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  billingProviderFor,
  priceCentsFor,
  reconcileSquareSubscription,
  reusableCheckout,
  safeReturnOrigin,
  tierForVariation,
  variationForModules,
} from "./squareBilling";
import { verifyWebhookSignature, squareConfig, WEBHOOK_URL } from "./billing.server";

const V = { single: "VAR_SINGLE", duo: "VAR_DUO", complete: "VAR_COMPLETE" };

describe("Square plan pricing", () => {
  it("charges $6 / $12 / $15 for one, two and three modules", () => {
    expect(priceCentsFor(["playbook_plus"])).toBe(600);
    expect(priceCentsFor(["playbook_plus", "gameday_plus"])).toBe(1200);
    expect(priceCentsFor(["playbook_plus", "gameday_plus", "team_hub_plus"])).toBe(1500);
  });

  it("maps module counts to the single, duo and complete plan variations", () => {
    expect(variationForModules(["team_hub_plus"], V)).toBe("VAR_SINGLE");
    expect(variationForModules(["team_hub_plus", "gameday_plus"], V)).toBe("VAR_DUO");
    expect(variationForModules(["playbook_plus", "gameday_plus", "team_hub_plus"], V)).toBe("VAR_COMPLETE");
    expect(variationForModules([], V)).toBeNull();
    expect(tierForVariation("VAR_DUO", V)).toBe("duo");
    expect(tierForVariation("SOMETHING_ELSE", V)).toBeNull();
  });
});

describe("which processor handles a team", () => {
  it("keeps a live legacy Stripe subscription on Stripe", () => {
    expect(billingProviderFor({ status: "active", billing_provider: "stripe", stripe_subscription_id: "sub_1" })).toBe("stripe");
  });
  it("sends new, free and canceled-Stripe teams to Square", () => {
    expect(billingProviderFor(null)).toBe("square");
    expect(billingProviderFor({ status: "free" })).toBe("square");
    expect(billingProviderFor({ status: "canceled", billing_provider: "stripe", stripe_subscription_id: "sub_1" })).toBe("square");
  });
  it("keeps a Square team on Square", () => {
    expect(billingProviderFor({ status: "active", billing_provider: "square", square_subscription_id: "sq_1", stripe_subscription_id: "old" })).toBe("square");
  });
});

describe("repeated checkout clicks", () => {
  const row = {
    square_checkout_url: "https://square.link/u/abc",
    square_checkout_variation_id: "VAR_DUO",
    square_checkout_started_at: new Date(1_000_000).toISOString(),
    pending_modules: ["playbook_plus", "gameday_plus"],
  };
  it("reopens the same checkout for the same plan within 30 minutes", () => {
    expect(reusableCheckout(row, "VAR_DUO", ["gameday_plus", "playbook_plus"], 1_000_000 + 29 * 60_000)).toBe(row.square_checkout_url);
  });
  it("starts fresh after 30 minutes or for different modules", () => {
    expect(reusableCheckout(row, "VAR_DUO", ["playbook_plus", "gameday_plus"], 1_000_000 + 31 * 60_000)).toBeNull();
    expect(reusableCheckout(row, "VAR_DUO", ["playbook_plus", "team_hub_plus"], 1_000_000)).toBeNull();
  });
});

describe("checkout return address", () => {
  it("only returns to CoachSide", () => {
    expect(safeReturnOrigin("https://www.coachside.live/x")).toBe("https://www.coachside.live");
    expect(safeReturnOrigin("https://evil.example.com")).toBe("https://coachside.live");
  });
});

describe("Square webhook reconciliation", () => {
  const base = { id: "sq_1", customer_id: "cust_1", charged_through_date: "2026-11-21" };

  it("activates exactly the modules the coach chose once Square reports ACTIVE", () => {
    const r = reconcileSquareSubscription({
      prev: { status: "free", modules: [], pending_modules: ["playbook_plus", "team_hub_plus"] },
      sub: { ...base, status: "ACTIVE", plan_variation_id: "VAR_DUO" },
      variations: V,
    });
    expect(r.patch?.["status"]).toBe("active");
    expect(r.patch?.["modules"]).toEqual(["playbook_plus", "team_hub_plus"]);
    expect(r.patch?.["pending_modules"]).toBeNull();
  });

  it("grants no access while the subscription is not active (failed or abandoned checkout)", () => {
    const r = reconcileSquareSubscription({
      prev: { status: "free", modules: [], pending_modules: ["playbook_plus"] },
      sub: { ...base, status: "PENDING", plan_variation_id: "VAR_SINGLE" },
      variations: V,
    });
    expect(r.patch?.["modules"]).toEqual([]);
  });

  it("never grants more modules than the paid plan covers", () => {
    const r = reconcileSquareSubscription({
      prev: { status: "active", billing_provider: "square", square_subscription_id: "sq_1", modules: ["gameday_plus"], pending_modules: ["gameday_plus", "playbook_plus"] },
      sub: { ...base, status: "ACTIVE", plan_variation_id: "VAR_SINGLE" },
      variations: V,
    });
    expect(r.patch?.["modules"]).toEqual(["gameday_plus"]);
    expect(r.patch?.["pending_modules"]).toEqual(["gameday_plus", "playbook_plus"]);
  });

  it("removes modules when Square cancels, without touching anything else", () => {
    const r = reconcileSquareSubscription({
      prev: { status: "active", billing_provider: "square", square_subscription_id: "sq_1", modules: ["gameday_plus"] },
      sub: { ...base, status: "CANCELED", plan_variation_id: "VAR_SINGLE" },
      variations: V,
    });
    expect(r.patch?.["status"]).toBe("canceled");
    expect(r.patch?.["modules"]).toEqual([]);
  });

  it("marks a scheduled cancel as ending at the period boundary", () => {
    const r = reconcileSquareSubscription({
      prev: { status: "active", billing_provider: "square", square_subscription_id: "sq_1", modules: ["gameday_plus"] },
      sub: { ...base, status: "ACTIVE", plan_variation_id: "VAR_SINGLE", canceled_date: "2026-11-21" },
      variations: V,
    });
    expect(r.patch?.["cancel_at_period_end"]).toBe(true);
    expect(r.patch?.["modules"]).toEqual(["gameday_plus"]);
  });

  it("grants nothing for an unmapped plan variation", () => {
    const r = reconcileSquareSubscription({
      prev: { status: "free", modules: [], pending_modules: ["gameday_plus"] },
      sub: { ...base, status: "ACTIVE", plan_variation_id: "UNKNOWN" },
      variations: V,
    });
    expect(r.patch?.["modules"]).toEqual([]);
    expect(r.error).toMatch(/not mapped/);
  });

  it("refuses to attach a second paid subscription to a team", () => {
    const r = reconcileSquareSubscription({
      prev: { status: "active", billing_provider: "square", square_subscription_id: "sq_1", modules: ["gameday_plus"] },
      sub: { ...base, id: "sq_2", status: "ACTIVE", plan_variation_id: "VAR_SINGLE" },
      variations: V,
    });
    expect(r.patch).toBeNull();
  });
});

describe("Square webhook signature and config", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("accepts only Square's signature over the registered URL and raw body", () => {
    process.env["SQUARE_WEBHOOK_SIGNATURE_KEY"] = "test-key";
    const body = '{"event_id":"e1"}';
    const sig = createHmac("sha256", "test-key").update(WEBHOOK_URL + body).digest("base64");
    expect(verifyWebhookSignature(body, sig, WEBHOOK_URL)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, WEBHOOK_URL)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "https://other.example/webhook")).toBe(false);
    expect(verifyWebhookSignature(body, null, WEBHOOK_URL)).toBe(false);
  });

  it("reports setup incomplete when production settings are missing", () => {
    for (const k of Object.keys(process.env)) if (k.startsWith("SQUARE_")) delete process.env[k];
    const cfg = squareConfig();
    expect(cfg.configured).toBe(false);
    expect(cfg.missing).toContain("SQUARE_ACCESS_TOKEN");
    expect(cfg.missing).toContain("SQUARE_PLAN_VARIATION_COMPLETE");
  });
});
