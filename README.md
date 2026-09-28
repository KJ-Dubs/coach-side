# CourtSide Coach

Build a mobile-first basketball coaching web app, working title “CourtFlow Coach.” This is a real usable V1, not a mockup. Prioritize iPad/tablet landscape during games, but make it responsive for phones and desktop.

CORE PRODUCT GOAL
Create one coaching app with two major jobs:
1) live game stat entry that is extremely fast while the coach is watching the game;
2) a visual basketball play designer that creates frame-by-frame/slideshow plays and shareable player-facing playbooks.

NON-NEGOTIABLE LIVE GAME UX
The basketball court MUST remain visible at all times during live stat entry. Tapping a court location must NEVER navigate to another screen and must NEVER replace the court with a modal. All selections appear as compact adaptive overlay bubbles/popovers directly on top of the court.

Primary stat flow is location → player → stat:
1. Coach taps exact location on court. Save normalized x/y coordinates and show a small marker there.
2. Show on-court overlay bubbles for eligible player numbers. Prefer current five players on floor.
3. After player selection, replace player bubbles with stat bubbles.
4. After stat selection, trigger context-aware follow-ups only if needed.
5. When event is complete, overlays disappear and court instantly resets for next entry.

Do not make the user leave the court during this flow. Position overlays adaptively so they stay onscreen and avoid covering the selected court point/basket when possible.

CORE STATS
Support at minimum: MADE SHOT, MISSED SHOT, REBOUND, ASSIST, STEAL, TURNOVER, BLOCK, FOUL. Shot type should be inferred from court coordinates when possible (2 vs 3, rim/paint/midrange/corner/wing/top zones).

CONTEXT-AWARE FOLLOW-UPS
Examples:
- MISS → prompt “What happened next?” with current on-court teammates + OPP REBOUND + OUT OF BOUNDS + SKIP. If our player rebounded, allow a quick court tap for rebound location; permit SKIP so stat entry never gets stuck.
- MAKE → prompt ASSIST? with the other four players currently on court + UNASSISTED + SKIP.
- FOUL → prompt SHOOTING / OFFENSIVE / DEFENSIVE / LOOSE BALL / OTHER / SKIP.
- TURNOVER → prompt BAD PASS / TRAVEL / OFFENSIVE FOUL / LOST BALL / OTHER / SKIP; optional “Who forced it?” can be skipped.
- STEAL should be recordable as one event and should logically relate to a turnover without making the coach enter duplicate data.

SUBSTITUTIONS
Keep a persistent compact lineup strip on the live game screen showing the five active players. Bench is accessible as bubbles. Sub flow should be two taps: tap player OUT → tap player IN. Save timestamp/quarter/game clock and update the active five immediately. Do not navigate away from court. Current lineup must be attached to subsequent game events.

GAME CONTROLS
On the same live-game screen include bubble/card controls for:
- team/opponent score
- quarter
- game clock input/control
- current lineup
- undo last event (very prominent)
- recent event mini-log with edit/delete access
All of these must be compact enough not to crowd the court.

DATA MODEL
Use persistent database-backed models for Teams, Players, Seasons, Games, GameEvents, Substitutions, Lineups, Plays, PlayFrames, PlayActions, Coaches/Users, and ShareLinks. Each GameEvent should support game, quarter, clock, player, x, y, eventType, result, currentLineup, possession metadata where relevant, relatedEventId/context, createdAt.

OFFLINE / LOCAL-FIRST
Live game entry must be resilient in bad gym internet. Store unsynced events locally in IndexedDB or another robust browser-local queue, show a small synced/offline status bubble, and sync queued events to backend when connectivity returns. Do not lose entered stats if connection drops or page reloads.

GAME REVIEW
Build review screens for:
- box score
- team shot chart
- individual player shot chart
- field goal percentages by zone
- rebounds by location
- steals by location
- turnovers by location
- fouls by location
- minutes and substitution timeline
- lineup stint summary / basic +/- if enough score-event data exists
- editable game event timeline
Filters should include player, quarter, and game where applicable.

PLAY DESIGNER
Use the same visual basketball court language. Coach can:
- place 5 numbered player tokens
- mark the ball handler with a visible ring/circle
- draw PASS as dotted line with arrow
- draw MOVEMENT/CUT/DRIBBLE as solid arrow
- draw SCREEN as solid line with flat/bar end
- number actions with blue sequence identifiers
- assign the same sequence number to simultaneous actions
- create multiple frames/slides
- duplicate a frame then modify the next action
- flip the entire play/court orientation with one FLIP control
- explicitly choose which basket the offense attacks so plays are never accidentally upside down

PLAY SLIDESHOW
Players/coaches can view plays one frame at a time with Previous / Next / Play controls. Preserve starting positions and show each action clearly. Add an optional simple animation between frames if practical, but frame accuracy is more important than fancy animation.

PLAYBOOK SHARING
Create a player-facing playbook view grouped into categories such as Offense, BLOB, SLOB, Press Break. Individual plays can have share links that do not require player login when marked shareable. Include a QR-code option if practical. Shared view should be read-only and optimized for phones.

VISUAL DESIGN — NON-NEGOTIABLE
Dark mode by default. Near-black/charcoal background. Purple and orange are the principal accent colors for text bubbles, chips, outlines, selections, highlights, and action states. Use white/off-white text inside dark/purple/orange surfaces with strong contrast.

Absolutely NO free-floating text anywhere in the product. Every visible heading, label, number, instruction, stat, status, navigation item, filter, score, helper message, or feedback message must live inside a deliberate rounded bubble, pill, button, card, panel, or bordered surface. Do not place naked text directly on the page background. Apply this globally, not just on the live game page.

Use rounded touch-friendly controls, large hit areas, clear active states, and visual hierarchy. Avoid clutter. During live games, the court is the hero and overlays are transient.

ROSTER / SETUP
Allow team creation and roster setup with jersey number, name, active/inactive status, season, and optional position. Create a New Game flow that selects opponent, date, starting five, and game rules/period structure.

SEED DATA / DEMO
Seed a demo team called Aliso Niguel with a usable sample roster (#1, #3, #5, #11, #20, #24, #32, #33) and a sample game so the UI is testable immediately. Starting five can be #1, #3, #11, #20, #32.

TECHNICAL EXPECTATIONS
Use the standard Lovable TypeScript/Tailwind/shadcn stack. Make components clean and reusable. Use a database/backend suitable for persistent accounts and shared playbooks. Build real interactions, not placeholder buttons. Where a V1 feature is incomplete, prefer a smaller working behavior over dead controls.

PRIORITY ORDER
1. Live-game persistent court + overlay stat workflow
2. Substitution flow + undo/recent event log
3. Local-first/offline event queue
4. Game review/shot charts
5. Play designer
6. Play slideshow/share view
7. Team/roster/settings polish

Acceptance test for the most important flow: From the live game court, I can tap a left-wing location, tap #1, tap MISS, then choose #24 as rebounder, tap the rebound location, and I am immediately returned to the unchanged court ready for the next event. No full-screen modal and no navigation occurs during any of those steps.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://coach-side.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/15fd3eea-9054-4734-86e0-f46a6c6eaebe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
