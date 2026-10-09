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

- Play and drill MP4 exports share `src/lib/playVideo.ts`; branding positions derive from the fitted court bounds in logical export pixels, shared by both encoders, so composition and animation cannot drift across formats or fallback resolutions.

Film Room: film jobs stage AI/manual events in film_job_events; only coach-reviewed events reach game_events via finalize_film_job. Never auto-promote.

- Locker Room team organization uses canonical play assignments plus many-to-many folder memberships; folders never own or clone plays.
- Player private messaging uses one team/player coaching-staff thread whose active coach membership is synchronized from team membership.
- Presenter Back uses router history after normal navigation and source/search fallbacks only for direct links, preserving list scroll and filters.
- All scores/points derive from `eventPoints` in src/lib/stats.ts (location-based, far basket mirrored); opponent stats are team-level OPP_* events — never sum raw `points`.
- Playmaker's current-sequence controls sit below the court in one viewport-bounded group; preview retains the selected sequence's exact end sample and Next advances through projected engine state, so repeat previews and continuity never edit play geometry.
- Playmaker authoring palette visibility is independent of supported saved action types; hiding tools must not remove legacy deserialization, rendering, possession or export support.
- AppShell compact spacing is opt-in for court-first editors; preserve default spacing on all other pages and size Playmaker courts through their native responsive aspect ratio, not CSS transforms.
- Play index uses array columns (concepts/defenses/outcomes) read via normalizeIndex in src/lib/playIndex.ts; legacy scalar situation is never overwritten so old metadata and search survive.
- Playmaker initial defense placement uses a guarded pure half-court shell helper; camera-aware display positions are converted back to logical full-court coordinates, and existing defenders are never reseeded, preserving legacy geometry.
- Post-game corrections edit game_events only (PostGameEditor); games.team_score/opp_score are re-snapshotted from scoreFromEvents after each change, never edited directly, so stats and score cannot drift.
