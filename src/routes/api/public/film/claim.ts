/**
 * Worker pull API: POST /api/public/film/claim
 * The external CV worker claims the oldest queued job and receives a
 * time-limited signed video URL plus the analysis config. HMAC-signed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyWorkerRequest } from "@/lib/film/provider.server";

const bodySchema = z.object({ worker_id: z.string().min(1) });

export const Route = createFileRoute("/api/public/film/claim")({
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
        const { data: job } = await supabaseAdmin
          .from("film_jobs")
          .select("*")
          .eq("status", "queued")
          .eq("provider", "http")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!job) return Response.json({ job: null });

        let videoUrl: string | null = null;
        if (job.storage_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("game-film")
            .createSignedUrl(job.storage_path, 3600);
          videoUrl = signed?.signedUrl ?? null;
        }
        await supabaseAdmin
          .from("film_jobs")
          .update({ status: "analyzing", status_detail: `Claimed by worker ${parsed.data.worker_id}` })
          .eq("id", job.id)
          .eq("status", "queued");
        await supabaseAdmin.from("film_job_logs").insert({
          job_id: job.id,
          message: "claimed by worker",
          data: { worker_id: parsed.data.worker_id },
        });
        return Response.json({
          job: {
            job_id: job.id,
            video_url: videoUrl,
            source_url: job.source_url,
            config: {
              our_color: job.our_color,
              opp_color: job.opp_color,
              attack_basket_first_half: job.attack_basket_first_half,
              periods: job.periods,
              roster: job.roster_snapshot,
            },
          },
        });
      },
    },
  },
});
