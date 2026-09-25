# CoachSide Library, Navigation, Touch, and Playbook Folder Update

## Goal
Make plays and drills easy to discover, ensure nested screens always have an explicit way out, restore vertical scrolling through static court previews, and add secure team-specific Playbook folders without changing existing play ownership, sharing, or visibility.

## User experience

### Library and Drill discovery
- Keep Playbook as the primary content destination.
- Add an immediately visible centered `Plays / Drills` switch inside the signed-in CoachSide Library tab.
- Preserve the existing play feed, search, filters, recommendations, and Play of the Day behavior under Plays.
- Render the existing published drill feed, search, filters, cards, public detail links, and save-copy flow under Drills.
- Add clear `My Drills` and `CoachSide Drill Library` links at the top of Drill Maker and the My Drills screen.
- Preserve `/library`, `/library/:playId`, `/drills`, `/drills/new`, and `/drills/:drillId` deep links. Public `/library` will continue to expose both content types.

### Consistent Back / Exit controls
- Create one reusable top-of-screen Back/Exit control with a left-arrow icon, large mobile tap target, explicit destination, and safe parent/Home fallback rather than depending only on browser history.
- Add it to nested creation, editing, detail, report, settings, help, membership, achievements, and owner-only screens where no equivalent already exists.
- Use contextual destinations such as Playbook, Library, Tools, Locker Room, Team Stats, or Home.
- Preserve the existing presenter navigation and full-screen Board/Live Game exits, improving their fallback destination where needed instead of duplicating controls.

### Touch scrolling
- Make the shared court renderer explicitly distinguish static previews from interactive courts.
- Static previews/thumbnails will ignore pointer input and allow vertical pan gestures; their surrounding card/link remains tappable.
- Interactive Playmaker, Drill Maker, Board, and Live Game courts retain drawing, dragging, and shot-location input.
- Interactive courts will capture a pointer only for an active edit gesture and release it on pointer-up or pointer-cancel; no global change will disable editor behavior.
- Apply the static-preview behavior to Tools snapshots, Playbook/Library thumbnails, drill cards/details, reports, and other read-only court visuals.

### Team Playbook folders
- Add team-owned folders with name, optional description, creator, sort order, and timestamps.
- Use the existing play-to-team assignment as the single source of team access, adding one nullable primary folder per play/team assignment. Null means `Unfiled`.
- Add `All Plays`, `Unfiled`, and named-folder filters when a specific team is selected, plus a compact `New Folder` action.
- Add `Move to Folder` to each team play card. Moving only updates that team’s assignment; it never clones or changes the play, its owner, source lineage, category, or assignments to other teams.
- Add a folder detail view in the Playbook surface with rename and delete controls. Deleting a folder sets its assignments to Unfiled and never deletes plays.
- Keep existing category browsing as play metadata/filtering, separate from the new coach-created team folders.
- Folder management will be available only with a specific team selected; the all-teams view remains a combined read view.

## Security and data
- Create `team_playbook_folders` with explicit authenticated/service grants, row-level security, team foreign key, uniqueness per team name, and update timestamp handling.
- Add nullable `folder_id` to `play_team_assignments`, constrained so a folder can only be used for the same team. Use `ON DELETE SET NULL` so folder deletion safely unfiles plays.
- Team members, including players, may read folder organization for teams they can already view.
- Only authorized team coaches may create, rename, reorder, delete folders, or move assignments.
- Public users receive no private folder access.
- Existing play and assignment visibility policies remain authoritative, so filing cannot hide a shared play or grant new access.

## Technical details
- Extend Playbook search state with Library content type and selected team-folder identifiers while preserving current category/team links.
- Add focused data helpers and query invalidation for folder CRUD and assignment moves.
- Reuse the existing drill feed and copy function rather than creating a parallel library implementation.
- Add route-specific metadata to any new folder detail route; do not alter generated routing files.
- Keep all current Stripe, PWA, notifications, engines, entitlement, ownership, and admin protections untouched.

## Verification
- Apply the schema migration and verify folder grants, RLS, same-team assignment constraints, and delete-to-Unfiled behavior.
- Test coach folder creation (`vs East High`), one-by-one moves, rename/delete, and player read-only visibility.
- Test signed-in and public Plays/Drills discovery plus existing deep links.
- Test explicit exits from the requested nested screens on mobile-sized viewports.
- Test vertical swipes beginning on Tools and Library static court previews.
- Regression-test Playmaker, Drill Maker, Board, and Live Game court interactions.
- Run focused tests, TypeScript checks, build diagnostics, and mobile/iPad browser checks.

## Assumptions
- Version 1 uses one primary folder per play per team by storing `folder_id` on `play_team_assignments`; this is the simplest model and preserves multi-team play sharing.
- Existing category folders remain available as basketball classifications, while custom team folders provide opponent/situation organization.
