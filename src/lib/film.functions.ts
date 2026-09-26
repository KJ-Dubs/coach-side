/**
 * Film Room server functions. Every function runs as the signed-in coach with
 * RLS enforced (film tables are coach-only via is_team_coach). Staged events
 * only reach game_events through finalizeFilmJob.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rosterEntry = z.object({ jersey: z.string(), player_id: z.string(), name: z.string() });

export const listFilmJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { teamId?: string }) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("film_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.teamId) q = q.eq("team_id", data.teamId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getFilmJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("film_jobs")
      .select("*")
      .eq("id", data.jobId)
      .single();
    if (error) throw new Error(error.message);
    const [{ count: total }, { count: pending }] = await Promise.all([
      context.supabase.from("film_job_events").select("id", { count: "exact", head: true }).eq("job_id", data.jobId),
      context.supabase
        .from("film_job_events")
        .select("id", { count: "exact", head: true })
        .eq("job_id", data.jobId)
        .eq("review_state", "pending"),
    ]);
    return { job, totalEvents: total ?? 0, pendingEvents: pending ?? 0 };
  });

export const createFilmJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    teamId: string;
    gameId?: string | null;
    sourceType: "upload" | "link";
    sourceUrl?: string | null;
    ourColor?: string | null;
    oppColor?: string | null;
    attackBasketFirstHalf?: "left" | "right";
    periods?: number;
    roster: z.infer<typeof rosterEntry>[];
    consent: boolean;
  }) =>
    z
      .object({
        teamId: z.string().uuid(),
        gameId: z.string().uuid().nullish(),
        sourceType: z.enum(["upload", "link"]),
        sourceUrl: z.string().url().nullish(),
        ourColor: z.string().nullish(),
        oppColor: z.string().nullish(),
        attackBasketFirstHalf: z.enum(["left", "right"]).default("right"),
        periods: z.number().int().min(1).max(8).default(4),
        roster: z.array(rosterEntry),
        consent: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { filmWorkerConfigured } = await import("./film/provider.server");
    const worker = filmWorkerConfigured();
    const { data: job, error } = await context.supabase
      .from("film_jobs")
      .insert({
        team_id: data.teamId,
        game_id: data.gameId ?? null,
        created_by: context.userId,
        source_type: data.sourceType,
        source_url: data.sourceType === "link" ? (data.sourceUrl ?? null) : null,
        our_color: data.ourColor ?? null,
        opp_color: data.oppColor ?? null,
        attack_basket_first_half: data.attackBasketFirstHalf,
        periods: data.periods,
        roster_snapshot: data.roster,
        provider: worker ? "http" : "none",
        status: data.sourceType === "upload" ? "uploading" : worker ? "queued" : "needs_review",
        status_detail: worker
          ? null
          : "Automatic film analysis is not connected yet. You can tag this film manually in the review workspace.",
        consent_acknowledged_at: new Date().toISOString(),
        consent_acknowledged_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return job;
  });

export const getFilmUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string; teamId: string }) => data)
  .handler(async ({ data, context }) => {
    const path = `${data.teamId}/${data.jobId}/source.mp4`;
    const { data: signed, error } = await context.supabase.storage
      .from("game-film")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const markFilmUploaded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string; path: string; durationSeconds?: number | null }) => data)
  .handler(async ({ data, context }) => {
    const { filmWorkerConfigured, getFilmProcessor } = await import("./film/provider.server");
    const worker = filmWorkerConfigured();
    const { data: job, error } = await context.supabase
      .from("film_jobs")
      .update({
        storage_path: data.path,
        duration_seconds: data.durationSeconds ?? null,
        status: worker ? "queued" : "needs_review",
        status_detail: worker
          ? "Queued for automatic analysis."
          : "Automatic film analysis is not connected yet. You can tag this film manually in the review workspace.",
      })
      .eq("id", data.jobId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (worker) {
      // Best-effort submit; the worker can also claim via the pull API.
      try {
        const { data: signed } = await context.supabase.storage
          .from("game-film")
          .createSignedUrl(data.path, 3600);
        const processor = getFilmProcessor();
        const origin = new URL(process.env["SUPABASE_URL"]!).origin;
        const result = await processor.submit({
          jobId: job.id,
          teamId: job.team_id,
          gameId: job.game_id,
          videoUrl: signed?.signedUrl ?? null,
          sourceUrl: job.source_url,
          config: {
            ourColor: job.our_color,
            oppColor: job.opp_color,
            attackBasketFirstHalf: job.attack_basket_first_half,
            periods: job.periods,
            roster: job.roster_snapshot as { jersey: string; player_id: string; name?: string }[],
          },
          callbackBase: origin,
        });
        await context.supabase
          .from("film_jobs")
          .update({ provider_job_id: result.providerJobId, status_detail: result.detail })
          .eq("id", job.id);
      } catch (e) {
        await context.supabase
          .from("film_jobs")
          .update({ status_detail: `Worker submit failed; it can still claim the job. (${(e as Error).message})` })
          .eq("id", job.id);
      }
    }
    return job;
  });

export const getFilmPlaybackUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("film_jobs")
      .select("storage_path")
      .eq("id", data.jobId)
      .single();
    if (error || !job?.storage_path) throw new Error("No video uploaded for this job");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("game-film")
      .createSignedUrl(job.storage_path, 3600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

export const listFilmEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("film_job_events")
      .select("*")
      .eq("job_id", data.jobId)
      .order("video_ts_ms", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listFilmSubs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("film_job_substitutions")
      .select("*")
      .eq("job_id", data.jobId)
      .order("video_ts_ms", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const eventPatch = z.object({
  event_type: z.string().optional(),
  player_id: z.string().uuid().nullish(),
  x: z.number().nullish(),
  y: z.number().nullish(),
  points: z.number().int().optional(),
  quarter: z.number().int().optional(),
  clock_seconds: z.number().int().optional(),
  side: z.enum(["us", "opp"]).optional(),
  video_ts_ms: z.number().int().optional(),
});

export const reviewFilmEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; action: "accept" | "edit" | "reject"; patch?: z.infer<typeof eventPatch> }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["accept", "edit", "reject"]), patch: eventPatch.optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const state = data.action === "accept" ? "accepted" : data.action === "reject" ? "rejected" : "edited";
    const { error } = await context.supabase
      .from("film_job_events")
      .update({
        ...(data.patch ?? {}),
        review_state: state,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addFilmEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string } & z.infer<typeof eventPatch>) =>
    z.object({ jobId: z.string().uuid(), ...eventPatch.shape }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { jobId, ...fields } = data;
    const { data: row, error } = await context.supabase
      .from("film_job_events")
      .insert({
        job_id: jobId,
        event_type: fields.event_type ?? "MADE",
        player_id: fields.player_id ?? null,
        x: fields.x ?? null,
        y: fields.y ?? null,
        points: fields.points ?? 0,
        quarter: fields.quarter ?? 1,
        clock_seconds: fields.clock_seconds ?? 0,
        side: fields.side ?? "us",
        video_ts_ms: fields.video_ts_ms ?? 0,
        review_state: "coach_added",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const bulkAcceptFilmEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string; minConfidence: number }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("film_job_events")
      .update({ review_state: "accepted", reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("job_id", data.jobId)
      .eq("review_state", "pending")
      .gte("confidence", data.minConfidence);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewFilmSub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; action: "accept" | "reject" }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("film_job_substitutions")
      .update({
        review_state: data.action === "accept" ? "accepted" : "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const finalizeFilmJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string; mode?: "merge" | "replace" }) => data)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("finalize_film_job", {
      _job: data.jobId,
      _mode: data.mode ?? "merge",
    });
    if (error) throw new Error(error.message);
    return result as { events: number; subs: number };
  });

export const cancelFilmJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("film_jobs")
      .update({ status: "cancelled" })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFilmJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string; removePromotedStats?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("film_jobs")
      .select("storage_path")
      .eq("id", data.jobId)
      .single();
    if (error) throw new Error(error.message);
    if (data.removePromotedStats) {
      await context.supabase.from("game_events").delete().eq("context->>film_job_id", data.jobId);
    }
    if (job?.storage_path) {
      await context.supabase.storage.from("game-film").remove([job.storage_path]);
    }
    const { error: dErr } = await context.supabase.from("film_jobs").delete().eq("id", data.jobId);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });
