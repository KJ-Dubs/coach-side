# CoachSide content & planning update

Five connected parts, built on the existing app. No rebuild; auth, RLS, billing, push, live stats, Locker Room, ownership/versioning and the current Library stay as they are.

## A) Play indexing and discovery

**Indexing questions before first save/publish**
A short stepped sheet (not a long form) asks: category, situation, defense faced, intended outcome, primary actions (multi-select), time pressure, optional notes/tags. Answers are stored with the play and stay editable later from the play's own screen.

**Suggested tags**
CoachSide reads the play's own drawing — shot endpoints, screens, handoffs, cuts toward the rim, passes into the post — and offers suggestions labelled "CoachSide suggests". The coach keeps or removes each one; anything the coach answered manually always wins.

**Cleaner Library cards**
Big court thumbnail, play name, one compact metadata line (category + situation/defense), at most four tags, heart count, creator, Run Play, Add to My Playbook when eligible, Play of the Day only for owners.

**Representative thumbnail**
Picks the sequence at/just before the shot; otherwise the busiest sequence; otherwise the last one. Zoom follows the new shared camera rule so involved players are never cut off.

**Search and filters**
Free text across name, tags, creator and category plus filters for category, situation, defense, outcome, action, time pressure, creator and Trending/Top/New/Featured. Phrases like "3 point play end of game" and "backdoor vs tight defense" match by breaking the phrase into known basketball terms — no AI needed.

**Recommended for You**
Built only from the coach's own hearts, saves, most-used categories/tags and coaches they follow, with a plain reason line ("Because you save BLOB + Rim Finish"). No private team data is used or shown.

## B) Playmaker orientation and zoom

Stored player positions never change; the view is only a camera. Switching to Right/Left/Top/Bottom/Full fits the camera around the players involved in the current sequence. If some still sit outside the view, a small line says "2 players are outside this view" with a one-tap **Fit Players**. Adding defense drops all five inside the current view. Right Half stays the default for new sessions. Thumbnails use the same camera logic.

## C) Drill Maker and Drill Library

A real drill model, separate from plays: name, category, skill focus, group size, court orientation, equipment, duration, reps, instructions, coaching points, scoring rules, difficulty/age, tags, diagram sequences, creator, publish state, hearts, timestamps.

Drill Maker reuses the court engine and adds cones, chairs, spots, lines, extra balls, text labels, player tokens and movement/pass/dribble/shot paths, with tools directly under the court, steps, preview, save and publish. A quick indexing step (skill, players, time, equipment, style, difficulty, intended result) runs before publishing.

Library gets **Plays** and **Drills** tabs, both publicly browsable, with skill/players/time/equipment/style/difficulty filters. Ships seeded with ~16 original starter drills (finishing, handling, passing, shooting, defense, transition, rebounding, free-throw pressure), each with instructions, coaching points, a sensible diagram and full metadata. Generic names only.

## D) Practice Planner

New plan: pick team, date, and either total length or start/end time. Add blocks from Recent, Favorites, Drills, Plays or Custom (water break, film, conditioning, scrimmage, free throws). Tapping a drill or play adds it instantly with a sensible default length (drill metadata; 5-10 min for a play install), tap the minutes to change. Drag to reorder, running total and time remaining always visible, one-tap suggestion to fill leftover time, save, and optionally share to the Locker Room. Compact block cards: name, type, minutes, edit, remove.

Dashboard shows the next practice plan; players see a shared plan read-only; the coach can tick items off during practice.

## E) Social CTAs

"Tag us in your CoachSide.live plays." appears on the public landing footer, Library, after a successful MP4 export, and on share success. Instagram/Facebook buttons render **only** when real URLs are set in one central config; until you provide them the buttons stay hidden. No invented handles.

## Security

Only creators edit their originals; anyone else gets Create My Version with attribution — same rule extended to drills. Published Library content is public; team Playbook, Locker Room and practice plans stay private to the team. Players get no publishing controls. Play of the Day stays owner-only and server-enforced. Practice plans, drills and drill hearts all get row-level policies matching the existing play model.

## Technical details

- Migrations: `plays` indexing columns (situation, defense_faced, outcome, actions[], time_pressure, tags[], suggested_tags[]); new `drills`, `drill_frames`, `drill_hearts`, `drill_team_assignments`; new `practice_plans`, `practice_plan_blocks`. Every new public table gets GRANTs, RLS and policies mirroring `plays`. Library RPCs extended/added (`library_feed` filters, `drill_feed`, `public_drill_frames`, `copy_drill_for_me`).
- Seed drills ship as literal INSERTs in the same migration, owned by a system/null creator and published.
- Shared camera utility in `src/components/court/Court.tsx` (`fitCamera(tokens, zoom)`) used by Playmaker, presenter and thumbnails.
- New routes: `/library` tabs, `/drills/new`, `/drills/$drillId`, `/practice`, `/practice/$planId`, all under existing auth/public conventions.
- Tag matching lives in a pure `src/lib/playIndex.ts` (synonym map + token scoring) so search and suggestions share one source of truth.
- Social URLs in `src/lib/social.ts` with empty placeholders and render guards.
- Order of work: migrations → indexing + Library discovery → camera fix → drills → planner → social. Typecheck and preview build checked after each part.
