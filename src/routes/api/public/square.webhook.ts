import { createFileRoute } from "@tanstack/react-router";

/**
 * Square subscription webhooks — the source of truth for paid access.
 * The signature is verified before anything is read; processing is
 * idempotent per event id and never deletes team content.
 */
export const Route = createFileRoute("/api/public/square/webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const square = await import("@/lib/billing.server");
        const signature = request.headers.get("x-square-hmacsha256-signature");
        if (!square.verifyWebhookSignature(raw, signature, square.WEBHOOK_URL)) {
          return new Response("Invalid signature", { status: 401 });
        }
        const { processSquareWebhook } = await import("@/lib/squareWebhook.server");
        return processSquareWebhook(raw);
      },
    },
  },
});
