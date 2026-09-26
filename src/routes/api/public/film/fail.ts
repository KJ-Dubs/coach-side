/** Worker callback: POST /api/public/film/fail — mark a job failed. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyWorkerRequest } from "@/lib/film/provider.server";

const bodySchema = z.object({
  job_id: z.string().uuid(),
  error: z.string().max(1000),
});

export const Route = createFileRoute("/api/public/film/fail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        try {
          verifyWorkerRequest(raw, request.headers.get("x-film-signature"));
        } catch (e) {
          const status = (e as { status?: number }).status ?? 401;
          return Response.json({ error: (e as Error).message }, { status });
        }
        const parsed = bodySchema.safeParse(JSON.parse(raw || "{}"));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("film_jobs")
          .update({ status: "failed", error: parsed.data.error })
          .eq("id", parsed.data.job_id);
        await supabaseAdmin.from("film_job_logs").insert({
          job_id: parsed.data.job_id,
          level: "error",
          message: "worker failed",
          data: { error: parsed.data.error },
        });
        return Response.json({ ok: true });
      },
    },
  },
});
