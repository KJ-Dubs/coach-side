# CoachSide navigation and Playmaker simplification

## Scope
Update the existing coach experience without changing permissions, saved-play ownership, billing, live-game behavior, or public/deep-link routes.

## Build

### 1. Automatic pass reception
- Remove the post-draw “Who receives this pass?” step entirely.
- When a pass is drawn, score every eligible offensive player against the absolute pass endpoint using their same-sequence movement path, projected end position, and compatible arrival timing.
- Automatically bind the best plausible player by immutable player ID; prefer a cutter whose route reaches the endpoint over the nearest stationary player.
- If no player is within the safe reach/timing threshold, save the pass as a visual open-space option and leave possession unchanged.
- Keep the drawn endpoint fixed. Animate a valid pass and cutter so they meet naturally without teleporting or changing identity when paths cross.
- Add a compact selected-pass inspector after creation where the coach may keep the inferred receiver, choose another player, or mark the pass as open space.
- Preserve option branches and ensure the editor, presenter, and MP4 export all consume the same deterministic result.

### 2. Compact coach navigation
- Reduce the coach navigation to five primary destinations: Playbook, Locker Room, Live Game, Team Stats, and Tools.
- Remove Library and Calendar from primary navigation while retaining their routes and existing deep links.
- Keep player-only navigation unchanged and do not expose Tools to public or player-only users.
- Keep Playmaker immediately available from Playbook and the new Tools page rather than as a permanent top-level item.

### 3. Playbook and Team Stats cleanup
- Keep the existing Playbook tabs and make “My Playbook” and “CoachSide Library” the clear top-level choices, with prominent create/open-Playmaker access.
- Limit the shared stats tabs to Overview, Games, Players, and Team, centered responsively.
- Remove the Roster and Shot Charts tabs only; retain contextual shot charts in player/team/game views.
- Keep `/roster` working for compatibility. Make Players the canonical entry by retaining its add-player/team management actions and linking to the existing full roster management screen.

### 4. Coach-only Tools page
- Add `/tools` under the authenticated coach area with route-specific metadata.
- Build a responsive visual launcher for Timeout Board, Practice Planner, Drill Maker, Playmaker, Playbook, Live Game, and Team Stats.
- Use real in-app visuals: existing stats screenshots plus lightweight previews composed from existing court/tool UI for tools without screenshots—no stock imagery.
- Make every tool card fully clickable, with a large name, left-aligned one-line description, clear visual preview, and centered action treatment.

## Technical details
- Add no database migration; pass metadata remains backward-compatible in existing play action JSON.
- Add a pure deterministic receiver-inference helper to the shared play animation module and focused acceptance tests for moving cutters, stationary receivers, ambiguity, crossings, and open-space possession safety.
- Preserve existing route files for `/library`, `/calendar`, and `/roster`; only primary discovery changes.
- Verify type safety, preview build health, Playmaker behavior, and responsive 390px mobile plus iPad/desktop layouts.
