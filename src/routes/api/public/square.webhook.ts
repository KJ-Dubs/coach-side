import { createFileRoute } from "@tanstack/react-router";

/**
 * Square subscription webhooks. The signature is verified before anything is
 * read, and state is reconciled into team_billing only for the team named in
 * the subscription. Never deletes team content.
 */
export const Route = createFileRoute("/api/public/square/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const square = await import("@/lib/billing.server");
        const signature = request.headers.get("x-square-hmacsha256-signature");
        if (!square.verifyWebhookSignature(raw, signature, square.WEBHOOK_URL)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          type?: string;
          data?: { object?: { subscription?: Record<string, unknown> } };
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const sub = payload.data?.object?.subscription;
        const subscriptionId = sub?.["id"] as string | undefined;
        if (!subscriptionId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("team_billing")
          .select("team_id,pending_modules,modules")
          .eq("square_subscription_id", subscriptionId)
          .maybeSingle();

        // First confirmation: attach the subscription to the pending team.
        let teamId = (row?.team_id as string | undefined) ?? undefined;
        if (!teamId) {
          const customerId = sub?.["customer_id"] as string | undefined;
          if (!customerId) return new Response("ok");
          const { data: pending } = await supabaseAdmin
            .from("team_billing")
            .select("team_id,pending_modules,modules")
            .eq("square_customer_id", customerId)
            .eq("status", "pending")
            .maybeSingle();
          teamId = pending?.team_id as string | undefined;
          if (!teamId) return new Response("ok");
        }

        const status = square.mapSquareStatus(sub?.["status"] as string | undefined);
        const modules =
          status === "active"
            ? ((row?.pending_modules as string[] | null) ?? (row?.modules as string[]) ?? [])
            : ((row?.modules as string[]) ?? []);

        await supabaseAdmin
          .from("team_billing")
          .update({
            status,
            modules,
            pending_modules: status === "active" ? null : (row?.pending_modules ?? null),
            square_subscription_id: subscriptionId,
            current_period_end: (sub?.["charged_through_date"] as string | null) ?? null,
            last_webhook_at: new Date().toISOString(),
            last_webhook_error: null,
          })
          .eq("team_id", teamId);

        return new Response("ok");
      },
    },
  },
});
