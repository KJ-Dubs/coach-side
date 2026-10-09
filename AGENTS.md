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
