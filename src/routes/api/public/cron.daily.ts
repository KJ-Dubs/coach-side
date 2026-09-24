import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Optional daily trigger for Play of the Day. The same job also runs lazily
 * the first time any coach opens CoachSide each day, so a day is never skipped.
 */
export const Route = createFileRoute("/api/public/cron/daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { ensurePlayOfTheDay } = await import("@/lib/retention.server");
        const res = await ensurePlayOfTheDay();
        return Response.json(res);
      },
    },
  },
});
