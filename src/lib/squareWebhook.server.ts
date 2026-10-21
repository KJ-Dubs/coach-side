/**
 * Square webhook processing — the only path that grants or removes paid
 * access for Square memberships. The route verifies the signature first;
 * this module dedupes by event id, re-reads the subscription from Square
 * (so out-of-order deliveries are harmless) and reconciles team_billing.
 */
import { reconcileSquareSubscription } from "./squareBilling";
import * as square from "./billing.server";

type Db = Awaited<ReturnType<typeof import("./notify.server").adminDb>>;

type Payload = {
  event_id?: string;
  type?: string;
  data?: {
    type?: string;
    id?: string;
    object?: {
      subscription?: square.SquareSubscription;
      invoice?: { id?: string; subscription_id?: string; order_id?: string };
    };
  };
};

const NO_TEAM = "No CoachSide team matched this Square subscription";

async function resolveTeam(db: Db, sub: square.SquareSubscription, orderHint: string | null): Promise<string | null> {
  const bySub = await db.from("team_billing").select("team_id").eq("square_subscription_id", sub.id).maybeSingle();
  if (bySub.data?.team_id) return bySub.data.team_id as string;

  // The checkout order created with the payment link, when Square links it to the first invoice.
  let orderId = orderHint;
  if (!orderId && sub.invoice_ids?.length && process.env["SQUARE_ACCESS_TOKEN"]) {
    orderId = (await square.getInvoice(sub.invoice_ids[sub.invoice_ids.length - 1]!).catch(() => null))?.order_id ?? null;
  }
  if (orderId) {
    const byOrder = await db.from("team_billing").select("team_id").eq("square_checkout_order_id", orderId).maybeSingle();
    if (byOrder.data?.team_id) return byOrder.data.team_id as string;
  }

  const open = () =>
    db
      .from("team_billing")
      .select("team_id, billing_owner")
      .not("square_checkout_link_id", "is", null)
      .eq("square_checkout_variation_id", sub.plan_variation_id ?? "");

  if (sub.customer_id) {
    const byCustomer = await open().eq("square_customer_id", sub.customer_id);
    if (byCustomer.data?.length === 1) return byCustomer.data[0]!.team_id as string;
  }

  // Square may create its own customer at checkout: match the buyer's email to exactly one open checkout.
  if (sub.customer_id && process.env["SQUARE_ACCESS_TOKEN"]) {
    const email = await square.getCustomerEmail(sub.customer_id).catch(() => null);
    if (email) {
      const { data: people } = await db.from("profiles").select("id").ilike("email", email);
      const ids = ((people ?? []) as { id: string }[]).map((p) => p.id);
      if (ids.length) {
        const byEmail = await open().in("billing_owner", ids);
        if (byEmail.data?.length === 1) return byEmail.data[0]!.team_id as string;
      }
    }
  }
  return null;
}

export async function processSquareWebhook(raw: string): Promise<Response> {
  let payload: Payload;
  try {
    payload = JSON.parse(raw) as Payload;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const eventId = payload.event_id;
  const type = payload.type ?? "unknown";
  if (!eventId) return new Response("Missing event id", { status: 400 });

  const { adminDb } = await import("./notify.server");
  const db = await adminDb();

  // Idempotency: each Square event id is processed once.
  const { error: dup } = await db.from("billing_webhook_events").insert({
    event_id: `square:${eventId}`,
    provider: "square",
    event_type: type,
    livemode: square.squareEnvironment() === "production",
  });
  if (dup) return new Response("ok (already processed)");

  let error: string | null = null;
  let teamId: string | null = null;
  try {
    const obj = payload.data?.object ?? {};
    const subId = obj.subscription?.id ?? obj.invoice?.subscription_id ?? null;
    if (subId) {
      // Square's API is the source of truth; the payload is a fallback only.
      const sub = process.env["SQUARE_ACCESS_TOKEN"]
        ? (await square.getSubscription(subId)).sub
        : obj.subscription ?? null;
      if (!sub?.id) throw new Error("Square subscription could not be read");

      teamId = await resolveTeam(db, sub, obj.invoice?.order_id ?? null);
      if (!teamId) {
        error = `${NO_TEAM} (${sub.id})`;
      } else {
        const { data: prev } = await db.from("team_billing").select("*").eq("team_id", teamId).maybeSingle();
        const result = reconcileSquareSubscription({ prev, sub, variations: square.variationMap() });
        const now = new Date().toISOString();
        const stamp = { last_webhook_at: now, last_webhook_event_id: `square:${eventId}` };
        if (!result.patch) {
          error = result.error;
          await db.from("team_billing").update({ ...stamp, last_webhook_error: result.error }).eq("team_id", teamId);
        } else {
          const patch: Record<string, unknown> = { ...result.patch, ...stamp };
          if (type === "invoice.scheduled_charge_failed" && patch["status"] === "active") {
            patch["status"] = "grace";
            patch["last_webhook_error"] = "A renewal payment failed — Square will retry the card.";
          }
          const { error: upErr } = await db
            .from("team_billing")
            .upsert({ team_id: teamId, ...patch } as never, { onConflict: "team_id" });
          if (upErr) throw new Error(upErr.message);
          error = result.error;

          const owner = (prev?.billing_owner as string | null) ?? null;
          if (owner && patch["status"] === "active" && prev?.status !== "active") {
            await db.from("product_activity_events").insert({ user_id: owner, event_type: "paid_active", team_id: teamId });
          }
          if (owner && patch["status"] === "canceled" && prev?.status !== "canceled") {
            await db.from("product_activity_events").insert({ user_id: owner, event_type: "cancel", team_id: teamId });
          }
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "processing failed";
    console.error("Square webhook failed", type, message);
    // Let Square retry: clear the id so the retry is processed.
    await db.from("billing_webhook_events").delete().eq("event_id", `square:${eventId}`);
    if (teamId) {
      await db.from("team_billing").update({ last_webhook_at: new Date().toISOString(), last_webhook_error: message }).eq("team_id", teamId);
    }
    return new Response("error", { status: 500 });
  }

  await db
    .from("billing_webhook_events")
    .update({ processed: !error, error, team_id: teamId })
    .eq("event_id", `square:${eventId}`);
  return new Response("ok");
}
