# CourtSide Coach — production pass roadmap

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

## Playmaker mobile workflow and court views
- [x] Put Tools and next-sequence creation directly below the court
- [x] Add Right, Left, Top, Bottom, and Full camera views without changing play geometry
- [x] Seed all five defenders inside the active view and verify the mobile workflow

## MP4 export mobile fix
- [x] Move export progress and preview into a dedicated normal-flow presenter section
- [x] Use a direct user-click download with stable object URL and CoachSide MP4 filename
- [x] Validate MIME type and MP4 file signature before enabling download
- [x] Verify 320–430px layout, genuine MP4 output, TypeScript, and production build

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
