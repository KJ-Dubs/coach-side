# CourtSide Coach — production pass roadmap

## Square membership checkout
- [x] Square is the primary processor for new checkouts, plan changes and cancel; live legacy Stripe subscriptions stay on Stripe
- [x] Webhook verifies signature, dedupes events, re-reads the subscription from Square and reconciles team_billing; redirects never unlock access
- [x] Owner diagnostics (Membership + Launch QA), generic message for coaches when setup is incomplete; 17 billing tests
- [x] Square production credentials and three plans configured
- [x] Billing enforcement turned on (owner decision, before a paid test); CoachSide AI Assistant gated to Complete server-side with in-app upgrade panel
- [x] CoachSide AI shown as a Coming Soon Complete benefit; launch switch off and fail-closed until OpenAI is funded and an admin turns it on
- [ ] Real paid checkout end-to-end — owner chose to go live first; run one purchase and confirm "Last webhook" in Launch QA

## ChatGPT / MCP connector (phase 1: teams, roster, schedule)
- [x] Managed OAuth server enabled (PKCE S256, client registration, refresh/offline_access); consent page + sign-in return
- [x] `/mcp` endpoint with 9 tools, per-connection permissions, instant revoke, rate limit, audit log
- [x] Settings "ChatGPT integration" card; Launch QA connector checks; 29 tests
- [ ] Signed-in end-to-end connect from a real ChatGPT custom app — needs publish + a coach account test


## Drill Maker ball passing
- [x] Unify active rendered/authoring ball ownership, explicit visible/setup assignment, and current-position receiver detection without changing layout
- [x] 12 drill regressions plus 32 related tests pass: independent transfers, next-step pass/dribble, free-ball rejection, replay, JSON reload, setup-only gaps, and future ball activation; automatic build OK
- [ ] Signed-in drag/pass/save/reopen walkthrough — blocked: no preview account matches requester; no saved drills changed, persisted transfers verified by JSON regression tests

## Older saved-play compatibility
- [x] Restore legacy bindings before editor validation/save; 12 regression tests and automatic build pass, preserving explicit links/geometry and genuine repair checks
- [ ] Signed-in older-play Next/save/reopen check — blocked: requester has no matching preview account; projected binding, validation and serialized reload verified in tests

## Live Game and bright team accents
- [x] Enforce game's explicit team on root/portals without borrowing global team colors during loading; theme tracking and timeout controls without changing layout or stat semantics
- [x] Preserve bright white/yellow, lift dark accents, maintain readable text and distinct defense; 42 tests and automatic build pass; actual tracking controls and portaled sheet checked at desktop/390px with white fills, dark text, yellow buttons and no overflow
- [ ] Signed-in game-to-game theme switching — blocked: no matching requester preview account; source/provider inspected and isolated controls verified without changing saved games

## Playmaker team accents
- [x] Extend safe primary/secondary accents to PlayCanvas and play MP4s without changing layout; keep ball/rims fixed orange, court neutral and defense distinct
- [x] 39 regression tests and automatic build pass; real PlayCanvas fixture verifies blue/gold, identical accents, red/white, defaults and 390px without overflow; actual H.264 MP4 decoded and visually checked for matching blue/gold routes, white defense and orange basketball
- [ ] Signed-in active-team switching on a saved play — blocked: requester has no matching preview account; verified live token switching in an isolated real-component fixture without modifying saved records

## Team accent theming
- [x] Add nullable hex-validated team colors and centralized safe accent overrides; preserve charcoal, semantic stat colors, court diagrams and exports
- [x] Add skippable post-creation branding with logo upload and Settings edit/reset; synchronize the existing current-team identifier and prioritize explicit page/player teams
- [x] 73 library tests and automatic typecheck/build pass; isolated real-control desktop/390px checks confirm switching, readable white/black accents, reset, unchanged court/semantic colors and no overflow
- [ ] Signed-in creation/save/reload and player account verification — blocked: no preview auth account matches requester; no existing team colors changed for testing. Pre-load accent caching deferred; theme reconciles after authorized team data loads.

## Play export countdown intro
- [x] Add optional 2.6-second play-only branded countdown in the shared MP4 timeline, preserving animation, branding and outro
- [x] Five real renderer MP4 fixtures validated with ffprobe/decoded frames: all formats, 3/2/1, Sequence 1 at frame 78, existing outro, disabled intro and drill suppression; 61 library tests pass; automatic build OK

## Compact My Playbook discovery
- [x] Merge Play Types, search and sort into one compact area with grouped multi-select filters and concise active summary
- [x] Preserve category links and multi-type URL state, team/folder scope, real-date sorting; quick create only prefills when exactly one type is selected
- [x] 48 tests pass; unsaved filter controls verified at desktop and 320/390px with no horizontal overflow; automatic typecheck/build OK
- [ ] Signed-in team/folder and old-link/back verification — blocked: requester has no matching preview auth account; no saved data changed

## Sequential Playmaker OPTIONS
- [x] Dynamic numbered option button between Next and picker; immediate sibling creation and naming; unsaved browser checks at 320/360/390/768/1280px, 44px targets, no overflow, correct 1A/1B and 3A/3B/3C families; six regression tests and automatic build OK
- [x] Shared anchored timeline for editing, automatic playback and presenter/export compatibility
- [x] Compact Add Play Option and selected-option overflow; preserve court size and saved data
- [x] 42 tests; A/B/C resets, main continuation, JSON reload, legacy data; unsaved browser example 1–4/4A/4B/4C/5 at desktop, tablet and 360/390px; automatic build/typecheck OK
- [ ] Signed-in Save Play/reload verification — blocked: no active preview session or account matching the requester; no test plays written to the backend

## Player Locker Room simplification
- [x] Player summaries, compact navigation and hidden administrative clutter
- [x] Read-only schedule, folder-first thumbnails, personal To Do / Completed Plans
- [x] Team/item links, coach/public preservation; 12 tests and automatic build/typecheck pass; isolated Home checked at phone/tablet/desktop widths
- [ ] Signed-in coach/player end-to-end verification — blocked: no active preview session or matching account available

## Initial defense placement correction
- [x] Seed a visible half-court shell for the active camera; Full follows current offensive concentration
- [x] Guard existing defenders and preserve logical coordinates, camera behavior, legacy plays and animation
- [x] Verify 16 placement cases and 16 related regressions; automatic typecheck/build passes (saved-play browser flow not tested)

## Playmaker court size correction
- [x] Remove viewport-height court width caps and reduce Playmaker-only shell spacing
- [x] Keep compact Play/Undo/Next/count directly under the full-width court
- [x] Verify 360/390/430px phones and iPad widths: 97–98% width, no overflow, accurate drag, preview/replay and sequence controls using unsaved browser fixture; 16 regressions and preview build pass

## Targeted authoring cleanup
- [x] Hide Curl Cut and Handoff authoring buttons without changing legacy actions
- [x] Make the main Board X/O control toggle its visible symbol without changing persistence
- [x] Verify legacy curl movement/handoff possession and unchanged input; Board placement, drag, undo/redo and session persistence; phone layout and Playmaker controls using unsaved browser fixtures; 16 regression tests and preview build pass

## Site-wide visual system cleanup
- [x] Add shared centered header, grouped information, checklist, and CTA primitives
- [x] Apply the hierarchy across coach, player, and public screens without behavior changes
- [x] Verify representative mobile and desktop layouts, type safety, and preview build
- [x] Align the Playmaker setup and guidance with the grouped visual system

## Current interface refinement
- [x] Apply a consistent page, section, entity, stat, body and metadata hierarchy
- [x] Add the horizontal CoachSide wordmark to the top of authenticated pages
- [x] Center Rosters, Live Game, Playbook, Play Maker and Stats navigation
- [x] Move Profile, Settings and Sign Out into the account dropdown
- [x] Give every dashboard destination a distinct athletic accent

## In progress / ready
- [x] Simplify Playmaker pass creation with automatic receiver inference and post-draw override
- [x] Compact coach nav, add Tools showcase, and consolidate Playbook/Library discovery
- [x] Reduce Team Stats tabs to Overview / Games / Players / Team
- [x] Replace Tools card previews with representative value-focused miniatures
- [x] Rebuild Drill Maker around court-first Playmaker-style drawing, steps, equipment, and preview
- [x] Correct Drill Maker positioning, undo/redo, wrapped tools, dribble visuals, and Board X/O markers
- [x] Add explicit Board full/left/right camera views and a quick screen symbol tool
- [x] Make Drill Maker Extra Balls independently assignable, passable, dribblable, and step-safe
- [ ] DB: additive migration (games.home_away/overtime_minutes, team settings columns, org_members roles, coach_invites, tightened RLS, invite RPCs, logo bucket)
- [ ] Sign-in barrier (`/`, `/auth`) + `_authenticated` gate + global offline flusher
- [ ] Home dashboard (`/dashboard`) with 9 cards
- [ ] AppShell navigation reorganised (Home, Start Game, Playbook, Stats, Rosters, History, Settings/Profile)
- [ ] Start a Game step flow (`/games/new`) with Home/Away + OT length
- [ ] End Game -> confirm -> finalize -> review; review shows Final/W-L
- [ ] Game History (`/games`) with season summary + In Progress section
- [ ] Rosters directory (`/roster`) with derived games/points/minutes
- [ ] Player Stats (`/stats/players`) + Team Stats (`/stats/team`) from game_events
- [ ] Playbook directory categories + Create Plays flow (`/plays/new`), migrate Press Defense -> Presses
- [ ] Settings (`/settings`) incl. team logo, defaults, invites
- [ ] Profile (`/profile`)
- [ ] Invite acceptance (`/invite/$token`)
- [ ] Rebrand text to CourtSide Coach; bubble-wrap root not-found/error screens
- [ ] Build/typecheck + Playwright verification

## Four-part Locker Room refactor
- [x] Add secure player-to-coaching-staff threads and message pinning
- [x] Add many-to-many Playbook folders and rich Plan attachments
- [x] Replace Locker Room tabs with Team Chat, Schedule, Playbook, and Plans
- [x] Add targeted/deep-linked notifications and preserve legacy content
- [x] Verify coach, player, parent, responsive, typecheck, and build behavior

## Locker Room
- [x] Team logo beside the dashboard welcome
- [x] Shareable Locker Room link (stats, playbook, schedule) with Google Calendar feed

## Later ideas
- Season-over-season comparisons once teams carry multiple seasons
- Opponent scouting notes per game

## Team Calendar
- [x] Native /calendar (agenda/week/month, filters, event types, reminders, share link)
- [x] Dashboard schedule card + nav item
- [x] Calendar defaults in Settings
- [x] Scheduled game -> Start Game prefill + review linkback
- [ ] Google Calendar two-way sync (needs Google OAuth client setup)

## Locker Room & messaging (done)
- Player/parent accounts, reusable invite links with rotate/revoke, roster claiming
- Announcements with audiences, pinning, acknowledgment receipts
- Team chat, staff chat, coach↔player direct messages, reactions, edit/delete, unread
- Assignments with player status, resources, plays/schedule tabs
- Attachment model ready for game video/clips later (no video UI yet)

## Playbook navigation UX
- [x] One-tap "Run Play" on every playbook card and Locker Room play tile
- [x] Presenter Prev/Next play within the current category/team context, Exit back to source
- [x] Restore authenticated My Playbook court thumbnails and exact history-aware presenter return

## Playmaker mobile workflow and court views
- [x] Put Tools and next-sequence creation directly below the court
- [x] Add Right, Left, Top, Bottom, and Full camera views without changing play geometry
- [x] Seed all five defenders inside the active view and verify the mobile workflow

## MP4 export mobile fix
- [x] Move export progress and preview into a dedicated normal-flow presenter section
- [x] Use a direct user-click download with stable object URL and CoachSide MP4 filename
- [x] Validate MIME type and MP4 file signature before enabling download
- [x] Verify 320–430px layout, genuine MP4 output, TypeScript, and production build
- [x] Add title-safe play/drill composition and a baked-in CoachSide logo outro

## Membership / billing foundation (built, enforcement OFF)
- [x] team_billing, complimentary_grants, access_codes, access_code_redemptions + RLS
- [x] team_modules / my_team_entitlement resolvers
- [x] /membership page: team switcher, module picker ($6/$12/$15), access code, owner diagnostics
- [x] Server-only Square boundary + signed webhook at /api/public/square/webhook
- [ ] BLOCKED on user: Square secrets (SQUARE_ACCESS_TOKEN, SQUARE_ENVIRONMENT, SQUARE_LOCATION_ID,
      SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_PLAN_VARIATION_SINGLE/DUO/COMPLETE) + catalog plan variations
- [ ] Turn on BILLING_ENFORCEMENT_ENABLED only after checkout is verified
- [ ] Wire UpgradePrompt into gated actions (Add Library play, court stat tracking, Calendar sync)

## Library indexing, Drills, Practice Planner, social (this pass)
- [x] Play index fields + PlayIndexSheet on create and edit, saved with the play
- [x] Library search/filter/recommendations + Plays / Drills tabs on /library
- [x] Drill model, 16 seeded starter drills, Drill Maker and drill detail pages
- [x] Practice Planner: /practice list + /practice/$planId timed block builder with Locker Room sharing
- [x] Non-destructive camera fit: "off this view" warning + Fit players in Playmaker
- [ ] BLOCKED on user: real Instagram / Facebook URLs before social buttons show

## Stripe test-mode QA (Sep 25)
- [ ] Stripe adapter: hosted Checkout (subscription, one price per team), customer mapping, portal
- [ ] Map 7 test price IDs (env/config + lookup_key fallback)
- [ ] Webhook: checkout.session.completed, subscription created/updated/deleted, invoice.paid/payment_failed, trial_will_end
- [ ] Single-subscription upgrade/downgrade with proration
- [ ] Launch QA Stripe status; enforcement stays OFF
## UX cleanup and playbook organization
- [x] Add visible Plays / Drills discovery in Playbook Library and Drill Maker
- [x] Add consistent source-aware Back / Exit navigation across nested app screens
- [x] Make static court previews pass through touch scrolling without weakening interactive courts
- [x] Add team Playbook folders with coach-only management and read-only team visibility
- [x] Verify mobile/iPad navigation, scrolling, permissions, and build

## CoachSide Tips reliability
- [x] Make eligible tips StrictMode-safe with readiness dismissal and a 3-second safety timeout
- [x] Verify fast, slow, repeat, back-navigation, and route-cleanup behavior

## Dashboard notification cleanup
- [x] Combine install and push setup into one compact, state-aware card
- [x] Simplify dashboard Help copy while preserving the Help destination

## Film Room: AI game-film stat analysis (Stages 1-3, no CV model)
- [ ] Private `game-film` storage bucket + RLS policies
- [ ] Migration: film_jobs, film_job_events, film_job_substitutions, film_job_logs + finalize_film_job RPC
- [ ] film.functions.ts: create job, signed upload/playback URLs, review/accept/edit/reject, finalize, delete, cancel
- [ ] Provider interface + dormant signed worker API routes (/api/public/film/*)
- [ ] Routes: /film, /film/new wizard, /film/$jobId status + review workspace + manual tagging
- [ ] Tools launcher Film Room card; game review Film pill
- [ ] stats.ts plus/minus
- [ ] AGENTS.md rule; typecheck/build; verify flows

## Film Room (staged rollout)
- [x] Private game-film storage + film job/event/sub/log tables with coach-only RLS
- [x] Film provider interface (none | HTTP worker) + HMAC-signed worker API routes
- [x] Film Room screens: list, new-job wizard, review workspace with manual tagging
- [x] Finalize reviewed events into real game stats (review-first, never auto)
- [ ] Real CV worker service (separate Python/GPU) — interface ready, not connected
- [x] Fix play team-access save (RLS error adding library play to own team)
- [x] Canonical cross-coach play sharing: Locker Room reads adopted plays, recipient UI

## Live Game layout cleanup
- [x] Compact sticky scoreboard and preserve court-first tracking
- [x] Add progressive player/free-throw disclosure and grouped opponent controls
- [x] Verify scoring tests, type safety, build, and phone/iPad interactions
- [x] Remove visible clock controls, compact court prompts, and add reliable prompt dismissal
- [x] Verify the no-scroll-focused phone layout and unchanged scoring behavior
- [x] Restore rebound-location court taps and keep every compact prompt within court bounds

## Game Report mobile stability
- [x] Move report actions below the centered title and eliminate document-level horizontal drift
- [x] Constrain report panels, filters, map, timelines, and box-score overflow on phone and iPad widths

## Creator discovery
- [x] Move Create Play from the Playbook header into My Playbook controls
- [x] Add Plays / Drills / Coaches Library navigation and a safe public coach directory
- [x] Add My Coach Profile, self-profile behavior, author links, and origin-aware profile Back
- [x] Point Follow a Coach achievement and tips to the Coaches directory
- [x] Verify privacy constraints, follow safeguards, type safety, tests, and preview build

## Downloaded social video composition
- [x] Update shared play/drill MP4 painter with safe top logo, sideline title and persistent bottom CTA
- [x] Preserve outro, animation, orientation and shared encoder composition
- [x] Verify downloaded short/long-title and drill H.264 MP4 frames, aspect ratios and outro; 16 targeted tests pass

## Playmaker under-court controls
- [x] Move current-sequence Play, Undo, Next Sequence and count directly below the court
- [x] Preserve repeat preview, deterministic continuity, full Replay and Reset; remove lower duplicates
- [x] Verify 320/390px phone and iPad layouts, repeat preview, advance, undo and empty states using an unsaved browser fixture; preview build OK and 16 regression tests pass

## Configurable Live Game tracking & editable tiles
- [x] Per-game tracking toggles, foul limit, bonus rule, timeouts (+ optional team defaults) on Start a Game
- [x] Live Game hides disabled controls; score-only mode skips Who? prompts
- [x] Editable score/period/foul tiles with event-backed reconciliation and team-only SCORE adjustments
- [x] End-game scoreboard check, foul-out notice, bonus labels, timeout tracker

## Native CoachSide AI Assistant (Phase 1)
- [x] Coach-only floating AI button + chat panel with team context, new chat/reset, suggested prompts, photo/PDF attach
- [x] Server-only OpenAI streaming endpoint with session, coach, feature-switch, size, rate and step limits
- [x] Shared executor for MCP + assistant; staged previews with Confirm/Review/Cancel for schedule, roster, team edits
- [x] Conversations, staged actions, usage logging tables; Launch QA AI diagnostics + on/off switch
- [x] Home card opens the assistant; old external ChatGPT connector UI, public /mcp route and consent screen removed
- [ ] Live end-to-end chat test — blocked until OPENAI_API_KEY is added in Project Settings → Secrets

## Landing page product separation + GameDay+ stat paywall
- [x] Landing rebuilt around Play Maker + Playbook, Locker Room and GameDay Stats with direct Free vs Paid columns; one "More tools included free" section; pricing comparison with AI as a Complete bonus (when AI access is active)
- [x] Start a Game / Live Tracking Settings: Score only is free (no lineup needed); GameDay+ stat toggles show a lock and inline upgrade prompt; database trigger switches paid categories off for teams without GameDay+ (honours the kill switch)
- [ ] Signed-in check as a free coach on Start a Game — blocked: no preview account matches the requester
- [ ] Team Hub+ items (team chat, plans) and Playbook+ folders are marketed as paid but are not locked in the app yet — needs an owner decision

## Owner usage drilldowns (My KPI)
- [x] Activity rows carry game/play/team/coach ids; game rows open Game Usage Inspector, other rows and coach names open Coach Usage
- [x] Read-only Game Usage Inspector: config, rules, coverage/history, usage summary with Not tracked, diagnostics, shot chart, player stats, score progression, subs, timeline, live auto-refresh
- [x] Read-only Coach Usage: teams/tier, counts only (no message contents), recent games with Inspect, recent activity
- [x] Server functions require sign-in + is_app_admin before admin reads; signed-out URLs redirect to sign-in; 10 new rule tests, 210 total pass
- [ ] Signed-in owner walkthrough of both pages — blocked: preview can't sign in as the owner account without approval

## Install activation
- [x] Onboarding install step right after interests (native prompt on Chrome/Android, big Share → Add to Home Screen steps on iPhone/iPad), never blocking
- [x] "Later" snoozes ~24h shared across surfaces; legacy permanent dismissal cleared; prompts stop once installed
- [x] Home install banner at top, inline header badge on normal coach pages (not Play Maker/Live Game), stronger landing CTA
- [x] Installed-app notification handoff on onboarding step and Home; funnel events + daily return signal; owner KPI Activation funnel; 11 tests
- [ ] Signed-in check of the onboarding step, Home banner and KPI funnel — blocked: no preview account matches the requester
