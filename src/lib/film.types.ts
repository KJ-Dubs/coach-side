/**
 * Film Room shared types (client-safe).
 *
 * AI/worker output NEVER writes game_events directly. It lands in
 * film_job_events / film_job_substitutions as proposals and only becomes real
 * stats when a coach finalizes the job (see finalize_film_job).
 */

export const FILM_STATUSES = [
  "uploading",
  "queued",
  "analyzing",
  "needs_review",
  "complete",
  "failed",
  "cancelled",
] as const;

export type FilmJobStatus = (typeof FILM_STATUSES)[number];

export const FILM_STATUS_LABEL: Record<string, string> = {
  uploading: "Uploading",
  queued: "Queued",
  analyzing: "Analyzing",
  needs_review: "Needs review",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
};

export type FilmJob = {
  id: string;
  team_id: string;
  game_id: string | null;
  created_by: string;
  source_type: "upload" | "link";
  storage_path: string | null;
  source_url: string | null;
  duration_seconds: number | null;
  status: FilmJobStatus | string;
  status_detail: string | null;
  progress: number;
  our_color: string | null;
  opp_color: string | null;
  attack_basket_first_half: string;
  periods: number;
  roster_snapshot: { jersey: string; player_id: string; name: string }[];
  provider: string;
  provider_job_id: string | null;
  consent_acknowledged_at: string | null;
  retention_until: string;
  error: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FilmReviewState = "pending" | "accepted" | "edited" | "rejected" | "coach_added";

export type FilmEvent = {
  id: string;
  job_id: string;
  external_id: string | null;
  video_ts_ms: number;
  quarter: number;
  clock_seconds: number;
  event_type: string;
  side: "us" | "opp";
  jersey_detected: string | null;
  player_id: string | null;
  x: number | null;
  y: number | null;
  result: string | null;
  points: number;
  confidence: number | null;
  related_proposed_id: string | null;
  lineup_guess: string[];
  review_state: FilmReviewState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  promoted_event_id: string | null;
  raw: Record<string, unknown>;
  created_at: string;
};

export type FilmSub = {
  id: string;
  job_id: string;
  external_id: string | null;
  video_ts_ms: number;
  quarter: number;
  clock_seconds: number;
  player_out: string | null;
  player_in: string | null;
  lineup_after: string[];
  confidence: number | null;
  review_state: FilmReviewState;
  promoted_sub_id: string | null;
  created_at: string;
};

/** Event types a worker may propose — same vocabulary as live tracking. */
export const FILM_EVENT_TYPES = [
  "MADE",
  "MISS",
  "FT_MADE",
  "FT_MISS",
  "REBOUND",
  "ASSIST",
  "STEAL",
  "TURNOVER",
  "BLOCK",
  "FOUL",
  "OPP_FOUL",
  "OPP_REBOUND",
  "OPP_SCORE",
] as const;

export function formatVideoTime(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
