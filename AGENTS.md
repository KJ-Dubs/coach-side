<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Play and drill MP4 exports share `src/lib/playVideo.ts`; branding positions derive from the fitted court bounds in logical export pixels, shared by both encoders, so composition and animation cannot drift across formats or fallback resolutions; both encoders share intro frames gated by content kind/options.
- Team accents override root tokens via AppShell from the current team (explicit page teams never fall back; Live Game uses the game's team). Public/admin opt out. PlayCanvas and play MP4s share play accent tokens; basketball/rims, defense and court keep semantic tokens; exports snapshot tokens once for both encoders.

Film Room: film jobs stage AI/manual events in film_job_events; only coach-reviewed events reach game_events via finalize_film_job. Never auto-promote.

- Locker Room team organization uses canonical play assignments plus many-to-many folder memberships; folders never own or clone plays.
- Player private messaging uses one team/player coaching-staff thread whose active coach membership is synchronized from team membership.
- Player Locker Room summaries and personal completion views share existing assignment audience checks and RLS-authorized records; navigation carries team/item context to the existing read-only surfaces so coach and player data paths cannot diverge.
- Presenter Back uses router history after normal navigation and source/search fallbacks only for direct links, preserving list scroll and filters.
- PlayPresenter's default camera comes from pure `autoPlayZoom` (`src/lib/playCamera.ts`) over the whole play as displayed (flip applied); manual zoom is a per-play override reset on play change, so every presenter surface shares one camera rule and play data is never touched.
- All scores/points derive from `eventPoints` in src/lib/stats.ts (location-based, far basket mirrored); opponent stats are team-level OPP_* events — never sum raw `points`.
- Playmaker controls remain viewport-bounded below court; preview retains the exact end sample and Next uses projected state without editing geometry. Resolve legacy links at editor load so validation and explicit saves match playback; loading never writes plays.
- Playmaker authoring palette visibility is independent of supported saved action types; hiding tools must not remove legacy deserialization, rendering, possession or export support.
- AppShell compact spacing is opt-in for court-first editors; preserve default spacing on all other pages and size Playmaker courts through their native responsive aspect ratio, not CSS transforms.
- Play index uses array columns (concepts/defenses/outcomes) read via normalizeIndex in src/lib/playIndex.ts; legacy scalar situation is never overwritten so old metadata and search survive.
- My Playbook discovery uses a shared grouped filter registry in `playbookFilters.ts`, with OR within each group and AND across groups; category URL state remains compatible and scope counts are computed before discovery filters so UI and matching cannot diverge.
- Playmaker initial defense placement uses a guarded pure half-court shell helper; camera-aware display positions are converted back to logical full-court coordinates, and existing defenders are never reseeded, preserving legacy geometry.
- Post-game corrections edit game_events only (PostGameEditor); games.team_score/opp_score are re-snapshotted from scoreFromEvents after each change, never edited directly, so stats and score cannot drift.
- Public game reports read live through the token-scoped `public_game_report` RPC (tokens in coach-only `game_share_links`, managed by `set_game_share`), never snapshots or public RLS on game_events, so post-game edits show on refresh and rotation revokes instantly.
- Live Game tracking/rules live in games.stat_tracking_config / rules_config (NULL = full tracker, defaults via src/lib/gameConfig.ts); scoreboard tile corrections always add/remove game_events, never overwrite stored scores.
- Mid-game tracking toggles append to games.tracking_history (never rewritten); report coverage, partial badges and season per-game rates all derive from computeCoverage in src/lib/gameConfig.ts, and coach corrections live in tracking_coverage_override without touching game_events, so untracked stats never read as zeros.
- Playmaker OPTIONS edit through `playOptions.ts` (creation stages one empty branch at the base-family anchor; naming updates it) and play via `playSequence.ts`, interleaving alternatives from the main-path anchor without contaminating siblings, continuation, legacy branch API or saved data.
- Membership billing: Square (`billing.server.ts`) for new/changed plans; live legacy Stripe subs stay on Stripe via `billingProviderFor`. Only the Square webhook grants access, reconciled by pure `squareBilling.ts`, so redirects never unlock features.
- GameDay+ stat categories are `PAID_TRACKING_KEYS` in gameConfig.ts, mirrored by the `games_tracking_entitlement` trigger, which switches them off (never rejects) for teams without the module so offline-queued writes cannot stick; the trigger reads `billing_runtime`, synced from the enforcement secret by `getBillingConfig`, so the kill switch reaches the database.
- Onboarding uses coach_onboarding (no row = new); events_sent dedupes funnel events.
- Public landing pricing renders entitlements.ts constants, and landing CTAs preserve intent via `/auth?next=`; anonymous CTA events must be allow-listed in the anon_funnel_events insert policy, so marketing never drifts from billing.

- Drill Maker shares active ball state for rendering/authoring; normalize explicit visible/setup ownership, never free-ball proximity, so independent transfers persist.
- Native AI Assistant uses the internal executor in `src/lib/coachside/`; no public MCP connector. See `src/lib/ai/AGENTS.md`.
- Subdirectories may have their own `AGENTS.md`; read it before changing files there.
- Team membership removal is soft (`team_members.active=false`); `accept_team_invite` is idempotent and refuses to reactivate removed rows, and a self-update trigger blocks members from reactivating or switching roster identity, so only coach Restore brings access back. Join/coach status share pure rules in `playerAccess.ts`.
- Session startup goes through `resumeSession` (`src/lib/sessionResume.ts`): retry refresh with the stored refresh token and keep the stored session on network failure; only definitive auth rejections redirect to `/auth`.
- Public Library play SEO (title, description, keywords, JSON-LD, visible "Indexed as" panel) derives only from the coach's saved play index via pure `src/lib/playSeo.ts`, loaded server-side through the anon `library_feed` RPC; `/sitemap.xml` is a router-derived server route (every route declares `staticData.sitemap`) that adds published plays, so search text and sitemap never drift from Library data.
