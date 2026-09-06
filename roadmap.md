# CourtSide Coach — production pass roadmap

## Current interface refinement
- [x] Add the horizontal CoachSide wordmark to the top of authenticated pages
- [x] Center Rosters, Live Game, Playbook, Play Maker and Stats navigation
- [x] Move Profile, Settings and Sign Out into the account dropdown
- [x] Give every dashboard destination a distinct athletic accent

## In progress / ready
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
