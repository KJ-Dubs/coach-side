import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook. Inactive until STRIPE_WEBHOOK_SECRET exists. Verifies the
 * Stripe-Signature header, stores each event id once (idempotent retries),
 * and maps the subscription price to team modules via the owner price map.
 * Checkout sessions and subscriptions must carry metadata.team_id.
 */
async function verify(body: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
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

const STATUS: Record<string, string> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete: "pending",
  incomplete_expired: "canceled",
  paused: "canceled",
};

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Stripe webhook not configured", { status: 503 });
        const body = await request.text();
        const sig = request.headers.get("stripe-signature") ?? "";
        if (!(await verify(body, sig, secret))) return new Response("Invalid signature", { status: 401 });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = JSON.parse(body) as { id: string; type: string; livemode: boolean; data: { object: any } };
        const { adminDb } = await import("@/lib/notify.server");
        const db = await adminDb();
        const obj = event.data.object ?? {};
        const teamId: string | null = obj.metadata?.team_id ?? obj.subscription_details?.metadata?.team_id ?? null;

        const { error: dup } = await db.from("billing_webhook_events").insert({
          event_id: event.id,
          provider: "stripe",
          event_type: event.type,
          livemode: event.livemode,
          team_id: teamId,
        });
        if (dup) return new Response("ok (duplicate)"); // already processed

        let error: string | null = null;
        try {
          if (teamId && (event.type.startsWith("customer.subscription.") || event.type === "checkout.session.completed")) {
            const now = new Date().toISOString();
            if (event.type === "checkout.session.completed") {
              await db.from("team_billing").upsert({
                team_id: teamId,
                billing_provider: "stripe",
                stripe_customer_id: obj.customer ?? null,
                stripe_subscription_id: obj.subscription ?? null,
                last_webhook_at: now,
                last_webhook_event_id: event.id,
                status: "pending",
                modules: [],
              }, { onConflict: "team_id" });
              await db.from("product_activity_events").insert({ user_id: obj.metadata?.user_id ?? null, event_type: "checkout_completed", team_id: teamId }).then(() => null, () => null);
            } else {
              const priceId: string | null = obj.items?.data?.[0]?.price?.id ?? null;
              const { data: map } = await db.from("billing_price_map").select("plan_key").eq("stripe_price_id", priceId).maybeSingle();
              const key = (map?.plan_key as string | undefined) ?? null;
              const modules = !key ? [] : key === "complete" ? ["playbook_plus", "gameday_plus", "team_hub_plus"] : key.split("+");
              const status = event.type === "customer.subscription.deleted" ? "canceled" : (STATUS[obj.status] ?? "pending");
              await db.from("team_billing").upsert({
                team_id: teamId,
                billing_provider: "stripe",
                stripe_customer_id: obj.customer ?? null,
                stripe_subscription_id: obj.id ?? null,
                stripe_price_id: priceId,
                subscription_status: obj.status ?? null,
                status,
                modules: status === "canceled" ? [] : modules,
                cancel_at_period_end: !!obj.cancel_at_period_end,
                current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
                last_webhook_at: now,
                last_webhook_event_id: event.id,
                last_webhook_error: key ? null : "Price ID not in the owner price map",
              }, { onConflict: "team_id" });
            }
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "processing failed";
        }
        await db.from("billing_webhook_events").update({ processed: !error, error }).eq("event_id", event.id);
        return error ? new Response("error", { status: 500 }) : new Response("ok");
      },
    },
  },
});
