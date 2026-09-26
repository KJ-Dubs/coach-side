# CoachSide Film Room: AI game-film stat analysis (infrastructure first)

## What exists today (verified)
- Stats come only from `games`, `game_events` (x/y normalized, event_type, player_id, current_lineup, related_event_id, context JSON) and `substitutions`. `src/lib/stats.ts` works out every box score, shot chart and minutes number from those tables. Nothing is stored twice.
- Coach write access uses `is_team_coach(team)` RLS. The live tracker writes through the offline queue in `src/lib/offline.ts`.
- Storage: there is only a `team-logos` bucket. There is no private video storage yet.

## Core principle
AI output never goes straight into `game_events`. It lands in a separate staging table as **proposed events**. A coach accepts, edits or rejects each one. Only accepted events become real `game_events` rows, marked with `context.source = 'film_ai'`. Everything downstream (box score, shot chart, players, PDF, Locker Room) then works unchanged. No results are shown until a real worker posts them. The UI says plainly: "Automatic analysis is not connected yet."

## 1) Built entirely in Lovable Cloud now
- Private video upload (resumable, large files) or a pasted link (YouTube/Hudl/Drive URL is stored only as a reference).
- Job setup wizard: team, game (existing or create new), roster confirmation, our jersey color, opponent color, which basket we attack in the 1st half, periods.
- Job lifecycle and status screen: uploading, queued, analyzing, needs review, complete, failed, cancelled.
- Review workspace: video player synced to an event timeline, the CoachSide court with proposed shot locations, and accept / edit / reject / add-missing for each event.
- Worker interface: signed webhook to receive results, plus a signed-URL handoff so the worker can fetch the video.
- A **Manual film tagging** mode that uses the same review screen with zero AI, so the feature is useful before any model exists: coach watches, taps court → player → stat, and it's timestamped to video.
- Privacy: consent acknowledgment, deletion, retention, and coach-only access.

## 2) Needs a separate Python/GPU service (later)
- Player/ball detection and tracking, jersey-number OCR, team assignment by color.
- Mapping the court (homography) to turn video pixels into court x/y.
- Detecting shots, makes/misses, rebounds, possession, turnovers, fouls, and lineup/substitution changes.
- Highlight clip cutting (ffmpeg) and heavier processing.
- It runs outside CoachSide (e.g. Modal/RunPod/own GPU box), pulls the job, downloads the video by signed URL, and POSTs back structured events. CoachSide does not host any model code.

## 3) Database / storage / API changes
Storage
- New private bucket `game-film`, path `{team_id}/{job_id}/source.mp4`. RLS: only coaches of that team (`is_team_coach`) can read/write. Only short-lived signed URLs for playback and the worker. No public URLs.

Tables (all with GRANTs, RLS through `is_team_coach`, players/public get nothing)
- `film_jobs`: team_id, game_id, created_by, source_type (upload|link), storage_path, source_url, duration_seconds, status, status_detail, progress, our_color, opp_color, attack_basket_first_half, periods, roster_snapshot (jersey→player_id), provider, provider_job_id, consent_acknowledged_at/by, retention_until, error, timestamps.
- `film_job_events` (staging): job_id, video_ts_ms, quarter, clock_seconds, proposed event_type (the existing EventType set), team side (us|opp), jersey_detected, player_id (resolved or null), x, y, result, points, confidence, related_proposed_id, lineup_guess, review_state (pending|accepted|edited|rejected|coach_added), reviewed_by/at, promoted_event_id → game_events.id, raw JSON.
- `film_job_substitutions` (staging, same pattern) → promoted into `substitutions`.
- `film_job_logs`: status transitions and worker callbacks (for audit/debugging).
- `film_provider_secrets` stays out of the database. The webhook signing secret goes in project secrets (`FILM_WORKER_SECRET`).

Server functions (`src/lib/film.functions.ts`, all with `requireSupabaseAuth` and a team-coach check)
- createFilmJob, getUploadTarget (signed upload URL), markUploaded → queued, getPlaybackUrl, listJobs, getJob, reviewEvent (accept/edit/reject), addEvent, bulkAcceptAboveConfidence, finalizeJob (promote accepted events into game_events/substitutions in one transaction via an RPC), deleteJob (removes video + staging; optionally the promoted events), cancelJob.

Worker API (under `src/routes/api/public/film/`, HMAC-signed, Zod-validated, idempotent by `provider_job_id` + event external id)
- `POST /api/public/film/claim`: the worker takes the next queued job and gets a 1-hour signed video URL plus the config.
- `POST /api/public/film/status`: progress/status updates.
- `POST /api/public/film/results`: batches of proposed events/subs. Moves the job to `needs_review`.
- `POST /api/public/film/fail`.
- Provider interface in `src/lib/film/provider.server.ts`: `FilmProcessor { submit(job), cancel(job) }`. Implementations: `NoneProcessor` (jobs sit in "queued, analysis not connected"), `ManualProcessor`, `HttpWorkerProcessor` (enabled only when `FILM_WORKER_URL` + secret exist). There is a versioned JSON schema document for the worker contract.

## 4) Screens / routes / components
- `/film` (coach-only, added to the Tools launcher as "Film Room"): job list with status pills and new-upload CTA.
- `/film/new`: wizard steps (Video → Game → Roster & colors → Direction → Consent → Start).
- `/film/$jobId`: status panel. When review is ready, it becomes the **review workspace**:
  - Video player on top; the CoachSide court stays visible beside/below it (per product rule).
  - Event timeline list with filters (pending / low confidence / shots / player). Tapping one seeks the video and highlights its court location.
  - Edit uses the same overlay bubble flow as the live tracker (location → player → stat, SKIP for context). The keyboard/tap "add missing event at current video time" also uses that flow.
  - Progress pill "124 of 180 reviewed", and "Finalize to stats" button.
- `/film/$jobId/report`: after finalizing, links into existing Review/Team Stats for the game, plus a film timeline with verified events (jump-to-clip).
- Components: `FilmUploader`, `FilmJobStatus`, `FilmTimeline`, `FilmEventEditor`, `ConsentCard`, `FilmDeleteDialog`, all built on the `Bubbles.tsx` primitives.
- A game review page gets a "Film" pill when the game has a job.

## 5) How AI events map into CoachSide
| Worker output | Promoted to |
|---|---|
| shot made/missed + location | `game_events` MADE/MISS, x/y normalized to CoachSide court, points from `isThree` |
| free throw | FT_MADE / FT_MISS |
| rebound (ours / theirs) | REBOUND with related_event_id → shot / OPP_REBOUND |
| assist, steal, block, turnover, foul | ASSIST, STEAL, BLOCK, TURNOVER, FOUL |
| opponent score / foul | OPP_SCORE / OPP_FOUL |
| lineup change | `substitutions` rows (lineup_after); `current_lineup` filled on each event |
| video timestamp, confidence, jersey guess | `context` JSON: {source:'film_ai', job_id, video_ts_ms, confidence, reviewed_by} |

- Coordinates: the worker reports court-normalized x/y with its attack-basket assumption. CoachSide flips it using the job's first-half direction so shot charts line up with live-tracked games.
- Minutes, plus/minus, box score and shot chart then come from existing `stats.ts` for free. The live tracker has no plus/minus yet, so it is added to `stats.ts` from substitutions and scoring events, which benefits live games too.
- Opponent/scouting: opponent shots are stored with a side flag in context. Opponent-level stats and scouting come in Stage 4.
- Finalizing is repeatable: re-finalizing replaces only events with that job_id, never live-tracked ones. If a game already has live stats, the coach picks "merge" or "film replaces live" per game.

## 6) Staged rollout
1. **Stage 1: infrastructure (now).** Bucket, tables, RLS, upload, wizard, job statuses, consent, deletion/retention, job list. Provider = none. Jobs honestly show "Queued: automatic analysis not yet available."
2. **Stage 2: review + manual tagging (now).** Review workspace, manual film tagging, finalize into `game_events`, plus/minus in stats.ts, and a Film timeline on game review. This delivers real value with zero AI.
3. **Stage 3: worker contract (now, dormant).** Signed webhook routes, provider interface, schema doc, and a test harness that posts a clearly labeled test fixture (admin-only in Launch QA, never shown as real analysis). It stays off until `FILM_WORKER_URL`/secret are set.
4. **Stage 4: external CV service (later, separate project).** Python/GPU worker implements claim → process → results. Confidence-based bulk accept, highlights clips, opponent scouting, then AI coaching insights (text summaries from verified stats only, via Lovable AI).
5. Billing: the feature is gated as a paid module through existing entitlements, with enforcement still off per current rules.

## Privacy and minors
- Consent card must be checked before upload: coach confirms they have the right to film/upload and that program/parent consent policies apply.
- Film is never visible to players or the public Locker Room in v1. There are only signed URLs (≤1h), no sharing links.
- Delete video anytime (verified stats can be kept or removed). Default retention is 180 days, with a daily cron purge using existing `cron.daily`.
- The worker only gets a time-limited URL plus jersey numbers, never player names. Face recognition is not used.

## Technical notes
- Large uploads: resumable upload (tus) directly to storage from the browser. The file size limit is set on the bucket. Link-only jobs are for manual tagging unless the worker can fetch them.
- The live-game screen and offline queue stay untouched. Film finalize runs on the server (online-only) and is clearly labeled.
- Record in AGENTS.md: "AI/film events stage in film_job_events and reach game_events only through coach finalize."

## Open assumptions (correct me if wrong)
- v1 is coach-only, with no player access to film.
- Manual film tagging counts as in scope, since it makes the review screen useful before AI exists.
- Plus/minus is added for all games, not just film games.
