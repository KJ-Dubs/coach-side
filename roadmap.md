# CourtSide Coach — production pass roadmap

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
