import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook — the only thing that activates or removes paid access.
 * Verifies Stripe-Signature, stores each event id once (retries are no-ops),
 * then syncs the team's single subscription into team_billing.
 * Data is never deleted: cancellation only clears modules.
 */
async function verify(body: string, header: string, secret: string): Promise<boolean> {
  const t = header.split(",").find((p) => p.startsWith("t="))?.slice(2);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  return sigs.some((s) => {
    const b = Buffer.from(s);
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Stripe webhook secret not configured", { status: 503 });
        const body = await request.text();
        if (!(await verify(body, request.headers.get("stripe-signature") ?? "", secret))) {
          return new Response("Invalid signature", { status: 401 });
        }
        const event = JSON.parse(body) as { id: string; type: string; livemode: boolean; data: { object: Any } };
        const obj = event.data.object ?? {};
        const { adminDb } = await import("@/lib/notify.server");
        const st = await import("@/lib/stripe.server");
        const db = await adminDb();

        // Resolve the team: metadata first, then our stored subscription/customer.
        let teamId: string | null =
          obj.metadata?.team_id ?? obj.subscription_details?.metadata?.team_id ?? obj.parent?.subscription_details?.metadata?.team_id ?? obj.client_reference_id ?? null;
        const subRef: string | null = typeof obj.subscription === "string" ? obj.subscription : obj.object === "subscription" ? obj.id : null;
        if (!teamId && subRef) {
          const { data } = await db.from("team_billing").select("team_id").eq("stripe_subscription_id", subRef).maybeSingle();
          teamId = data?.team_id ?? null;
        }
        if (!teamId && typeof obj.customer === "string") {
          const { data } = await db.from("team_billing").select("team_id").eq("stripe_customer_id", obj.customer).maybeSingle();
          teamId = data?.team_id ?? null;
        }

        const { error: dup } = await db.from("billing_webhook_events").insert({
          event_id: event.id, provider: "stripe", event_type: event.type, livemode: event.livemode, team_id: teamId,
        });
        if (dup) return new Response("ok (already processed)");

        let error: string | null = null;
        try {
          const now = new Date().toISOString();
          const base = { billing_provider: "stripe", last_webhook_at: now, last_webhook_event_id: event.id };
          const owner = obj.metadata?.billing_owner ?? null;
          const log = (type: string) =>
            owner ? db.from("product_activity_events").insert({ user_id: owner, event_type: type, team_id: teamId }) : Promise.resolve();

          const syncSubscription = async (sub: Any, deleted = false) => {
            const item = sub.items?.data?.[0];
            const priceId: string | null = item?.price?.id ?? null;
            const plan = await st.planForPrice(db, priceId, item?.price?.lookup_key ?? null);
            const status = deleted ? "canceled" : st.mapStatus(sub.status);
            const periodEnd = sub.current_period_end ?? item?.current_period_end ?? null;
            const { data: prev } = await db.from("team_billing").select("modules, status").eq("team_id", teamId).maybeSingle();
            await db.from("team_billing").upsert({
              team_id: teamId,
              ...base,
              stripe_customer_id: sub.customer ?? null,
              stripe_subscription_id: sub.id,
              stripe_price_id: priceId,
              subscription_status: deleted ? "canceled" : sub.status,
              status,
              modules: status === "canceled" ? [] : st.modulesFor(plan),
              pending_modules: null,
              cancel_at_period_end: !!sub.cancel_at_period_end,
              current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
              last_webhook_error: plan ? null : `Price ${priceId} is not mapped to a CoachSide plan`,
              ...(sub.metadata?.billing_owner ? { billing_owner: sub.metadata.billing_owner } : {}),
            }, { onConflict: "team_id" });
            const ownerId = sub.metadata?.billing_owner;
            if (ownerId && status === "active" && prev?.status !== "active") {
              await db.from("product_activity_events").insert({ user_id: ownerId, event_type: "paid_active", team_id: teamId });
            }
            if (ownerId && deleted) await db.from("product_activity_events").insert({ user_id: ownerId, event_type: "cancel", team_id: teamId });
          };

          if (!teamId) {
            error = "No CoachSide team found for this event";
          } else if (event.type === "checkout.session.completed") {
            await db.from("team_billing").upsert({
              team_id: teamId, ...base,
              stripe_customer_id: obj.customer ?? null,
              stripe_subscription_id: obj.subscription ?? null,
            }, { onConflict: "team_id" });
            await log("checkout_completed");
            // Pull the subscription now so access doesn't wait for the next event.
            if (obj.subscription && st.stripeConfig().secretPresent) {
              await syncSubscription(await st.stripe("GET", `/subscriptions/${obj.subscription}`));
            }
          } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
            await syncSubscription(obj);
          } else if (event.type === "customer.subscription.deleted") {
            await syncSubscription(obj, true);
          } else if (event.type === "invoice.paid") {
            await db.from("team_billing").update({ ...base, status: "active", last_webhook_error: null }).eq("team_id", teamId).neq("status", "canceled");
          } else if (event.type === "invoice.payment_failed") {
            // Smart Retries keep trying; access continues in grace until Stripe gives up.
            await db.from("team_billing").update({ ...base, status: "grace", last_webhook_error: "Payment failed — Stripe is retrying" }).eq("team_id", teamId);
          } else if (event.type === "customer.subscription.trial_will_end") {
            await db.from("team_billing").update(base).eq("team_id", teamId);
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "processing failed";
        }
        await db.from("billing_webhook_events").update({ processed: !error, error }).eq("event_id", event.id);
        // Return 500 on processing errors so Stripe retries (the id row is cleared to allow it).
        if (error && error !== "No CoachSide team found for this event") {
          await db.from("billing_webhook_events").delete().eq("event_id", event.id);
          return new Response("error", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
