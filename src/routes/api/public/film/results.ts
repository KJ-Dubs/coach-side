/**
 * Worker callback: POST /api/public/film/results
 * Receives batches of PROPOSED events/substitutions. They land in staging
 * tables only — a coach must review and finalize before they become stats.
 * Idempotent via (job_id, external_id) upsert.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyWorkerRequest } from "@/lib/film/provider.server";
import { FILM_EVENT_TYPES } from "@/lib/film.types";

const eventSchema = z.object({
  external_id: z.string().min(1).max(120),
  video_ts_ms: z.number().int().min(0),
  quarter: z.number().int().min(1).max(8).default(1),
  clock_seconds: z.number().int().min(0).default(0),
  event_type: z.enum(FILM_EVENT_TYPES),
  side: z.enum(["us", "opp"]).default("us"),
  jersey_detected: z.string().max(8).nullish(),
  player_id: z.string().uuid().nullish(),
  x: z.number().min(0).max(1).nullish(),
  y: z.number().min(0).max(1).nullish(),
  result: z.string().max(40).nullish(),
  points: z.number().int().min(0).max(3).default(0),
  confidence: z.number().min(0).max(1).nullish(),
  related_external_id: z.string().max(120).nullish(),
  lineup_guess: z.array(z.string().uuid()).max(5).default([]),
  raw: z.record(z.string(), z.unknown()).default({}),
});

const subSchema = z.object({
  external_id: z.string().min(1).max(120),
  video_ts_ms: z.number().int().min(0),
  quarter: z.number().int().min(1).max(8).default(1),
  clock_seconds: z.number().int().min(0).default(0),
  player_out: z.string().uuid().nullish(),
  player_in: z.string().uuid().nullish(),
  lineup_after: z.array(z.string().uuid()).max(5).default([]),
  confidence: z.number().min(0).max(1).nullish(),
  raw: z.record(z.string(), z.unknown()).default({}),
});

const bodySchema = z.object({
  job_id: z.string().uuid(),
  final: z.boolean().default(false),
  events: z.array(eventSchema).max(500).default([]),
  substitutions: z.array(subSchema).max(200).default([]),
});

export const Route = createFileRoute("/api/public/film/results")({
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
        let json: unknown;
        try {
          json = JSON.parse(raw || "{}");
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
        const body = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: job } = await supabaseAdmin
          .from("film_jobs")
          .select("id, status, roster_snapshot")
          .eq("id", body.job_id)
          .maybeSingle();
        if (!job) return Response.json({ error: "Unknown job" }, { status: 404 });
        if (job.status === "cancelled" || job.status === "complete") {
          return Response.json({ ok: true, ignored: true });
        }

        const roster = (job.roster_snapshot ?? []) as { jersey: string; player_id: string }[];
        const byJersey = new Map(roster.map((r) => [r.jersey, r.player_id]));

        if (body.events.length) {
          const rows = body.events.map((e) => ({
            job_id: body.job_id,
            external_id: e.external_id,
            video_ts_ms: e.video_ts_ms,
            quarter: e.quarter,
            clock_seconds: e.clock_seconds,
            event_type: e.event_type,
            side: e.side,
            jersey_detected: e.jersey_detected ?? null,
            player_id: e.player_id ?? (e.jersey_detected ? (byJersey.get(e.jersey_detected) ?? null) : null),
            x: e.x ?? null,
            y: e.y ?? null,
            result: e.result ?? null,
            points: e.points,
            confidence: e.confidence ?? null,
            lineup_guess: e.lineup_guess,
            raw: e.raw,
            review_state: "pending",
          }));
          const { error } = await supabaseAdmin
            .from("film_job_events")
            .upsert(rows as never, { onConflict: "job_id,external_id", ignoreDuplicates: true });
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }
        if (body.substitutions.length) {
          const rows = body.substitutions.map((s) => ({
            job_id: body.job_id,
            external_id: s.external_id,
            video_ts_ms: s.video_ts_ms,
            quarter: s.quarter,
            clock_seconds: s.clock_seconds,
            player_out: s.player_out ?? null,
            player_in: s.player_in ?? null,
            lineup_after: s.lineup_after,
            confidence: s.confidence ?? null,
            raw: s.raw,
            review_state: "pending",
          }));
          const { error } = await supabaseAdmin
            .from("film_job_substitutions")
            .upsert(rows as never, { onConflict: "job_id,external_id", ignoreDuplicates: true });
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }

        if (body.final) {
          await supabaseAdmin
            .from("film_jobs")
            .update({ status: "needs_review", progress: 100, status_detail: "Analysis finished — review the proposed events." })
            .eq("id", body.job_id);
          await supabaseAdmin.from("film_job_logs").insert({
            job_id: body.job_id,
            message: "results received",
            data: { events: body.events.length, subs: body.substitutions.length },
          });
        }
        return Response.json({ ok: true, accepted: body.events.length + body.substitutions.length });
      },
    },
  },
});
