import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Hourly check for practices/games whose attendance is now due. Creates one
 * in-app + push "Attendance due" alert per event per coach (deduped).
 */
export const Route = createFileRoute("/api/public/cron/attendance")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runAttendanceDue } = await import("@/lib/attendanceDue.server");
        const res = await runAttendanceDue();
        return Response.json(res);
      },
    },
  },
});
