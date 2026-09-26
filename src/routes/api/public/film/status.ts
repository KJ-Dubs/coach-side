/** Worker callback: POST /api/public/film/status — progress updates. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyWorkerRequest } from "@/lib/film/provider.server";

const bodySchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(["analyzing", "needs_review"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  detail: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/public/film/status")({
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
        const patch: Record<string, unknown> = {};
        if (parsed.data.status) patch.status = parsed.data.status;
        if (parsed.data.progress !== undefined) patch.progress = parsed.data.progress;
        if (parsed.data.detail) patch.status_detail = parsed.data.detail;
        await supabaseAdmin.from("film_jobs").update(patch).eq("id", parsed.data.job_id);
        return Response.json({ ok: true });
      },
    },
  },
});
