# Why "Dog" can't be added to a second team

## Finding (confirmed against live data)

The database rule is working correctly. The app is sending it a team the coach doesn't coach.

- "Dog" is owned by the Test Tem coach (team_id = Test Tem, a different program) and is published to the Library.
- The Aliso Niguel coach already has Dog on Aliso Niguel Sophomores (assignment made 2026-09-17), and is now adding it to Aliso Niguel (varsity).
- On the play card, the pre-checked "Available to" list is built from `teamsByPlay` in `plays.index.tsx`. That list **includes the play's legacy `plays.team_id`**, which is Test Tem, the owner's private team.
- When the coach clicks Save team access, `setPlayTeams` (`src/lib/data.ts`) compares that list against `fetchTeamsForPlay`. Under RLS, `fetchTeamsForPlay` returns only assignments the coach can see (Sophomores), not Test Tem.
- So the diff treats Test Tem as "new" and inserts `{play: Dog, team: Test Tem}` along with the varsity row, all in one client-side insert.
- The INSERT policy `assignments insert` is `is_team_coach(team_id) AND (play_visible(play_id) OR play_published(play_id))`. `play_published` passes, but `is_team_coach(Test Tem)` returns false, so the whole batch is rejected with the RLS error. The varsity row would have passed on its own.

A second hidden bug: after inserting, `setPlayTeams` calls `updatePlay(..., { team_id })` on the original play. Plays are owner-only, so a non-owner would hit that next.

## Answers to your questions

- **Policy causing the failure:** `play_team_assignments` "assignments insert", specifically the `is_team_coach(team_id)` check on the foreign Test Tem row.
- **Related to the earlier is_team_coach org fix?** No. `is_team_coach` correctly passes for every team in the coach's own org, and all live coaches get their authority through `org_members`. This is a client bug that mixes up the legacy `team_id` with real assignments.
- **Can a library play be linked to a second team without cloning?** Yes. That's the intended model: the policy allows any coach of the target team to link a published play. The original is never modified.
- **Client-side under RLS?** Yes, it's a direct browser insert. That's acceptable because RLS is the correct authority. No server function is needed.
- **Intended rule:** a coach may link a play to team T only if they coach T and the play is visible to them or published. They may only unlink teams they coach. Only the owner changes the play itself.

## Safest minimal fix (frontend only, no policy change)

1. In `setPlayTeams`, keep only additions and removals for teams the user actually coaches: intersect with the coach's own team list. Never touch other teams.
2. Only call `updatePlay` to sync the legacy `team_id` when the user owns the play. Skip it for non-owners.
3. In the play card, build the picker's pre-checked state only from the coach's own teams. That way foreign teams like Test Tem never appear or get submitted.
4. Verify: as the Aliso coach, add Dog to Aliso Niguel. The row inserts, the Sophomores link stays, and Test Tem's link and the original play are untouched. As the owner, team edits still work.

No RLS or database change is recommended. Loosening the policy would let coaches attach plays to other programs' teams.
