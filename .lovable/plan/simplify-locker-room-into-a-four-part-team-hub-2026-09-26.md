# Simplify Locker Room into a four-part team hub

## Goal
Refactor the existing authenticated Locker Room into one landing page with exactly four primary destinations: **Team Chat, Schedule, Playbook, and Plans**. Reuse the current chat, calendar, assignments, attachments, notifications, and canonical play-sharing systems; preserve all historical records and keep the public parent link limited to stats and schedule.

## User experience

### Locker Room landing
- Keep the team selector and coach-only invite/access control above four large summary cards.
- Team Chat shows unread or latest-message context; Schedule shows the next event; Playbook shows play/recent-share context; Plans shows open and next-due work.
- Use URL-backed area/item state so notifications and attachments open the correct area, folder, plan, event, or conversation directly.
- Every nested view gets a consistent Back to Locker Room control.

### Team Chat
- Coach sub-tabs: **Team Chat | Messages**. Player sub-tabs: **Team Chat | Message Coaches**.
- Reuse the team conversation and staff conversation. Coach Messages provides player threads plus staff chat; players receive one private coaching-staff thread and no player directory.
- Add a secure player/coaching-staff conversation type, one per player/team. Keep its members synchronized with the player, head coach, and active assistant coaches as team membership changes.
- Add coach-controlled pin/unpin state to team-chat messages. Show pinned messages first or in a compact pinned section.
- Preserve old announcements and render them as a labeled legacy pinned/important section; do not copy or delete historical records.
- Replace the always-open attachment picker with a bottom-left **+** button and compact chooser for Play, Playbook Folder, Drill, Practice Plan, Event, Plan/Task, and Resource/Link.
- Render every attachment as a rich, tappable card with the correct team-scoped destination.

### Schedule
- Add **Upcoming | Calendar** sub-tabs, using the existing `team_events` records and Google-imported rows.
- Reuse the current event cards and event form, including type, opponent/title, dates, times, arrival, location, notes, visibility, and reminders.
- Extract the current month calendar and event form into shared Locker Room/calendar components rather than creating a second system.
- Improve calendar days with high-contrast purple/orange markers or short event labels and a selected-day event list.
- Coaches get one prominent centered **+ Add Event**, edit/delete for native events, and compact Google Calendar settings. Google events remain read-only.
- Players get the same schedule views without management controls.
- Keep event notifications and preferences, but deep-link them into the Locker Room Schedule area.

### Playbook
- Add **All Plays | Folders** sub-tabs using canonical `plays` plus `play_team_assignments`; adopting a play never clones or mutates the source.
- Reuse team Playbook folder CRUD, add ordering controls where practical, and show creator/Library attribution for adopted plays.
- Upgrade folders from the current one-folder-per-team-assignment field to a many-to-many membership table, backfilling every existing folder relationship.
- Coaches can create, rename, delete, reorder, and add/remove play references. Players can browse folders and run plays read-only.
- Deleting a folder deletes only its membership links. Removing a play from a folder does not revoke team access. Explicit removal from the Playbook removes only that team assignment.
- Preserve owner-only editing and the existing **Edit as My Version** derivative flow.

### Plans
- Reframe the existing assignments system as Plans; keep all existing assignment records and completion history.
- Coach form: title, instructions, optional due date/time, whole team or selected players, and multiple rich attachments.
- Add attachment support for plays, folders, drills, events/games, practice plans, plans/tasks, and safe URLs/resources while retaining legacy `linked_type` / `linked_id` reads.
- Players see relevant active plans, open attachments, mark complete, and retain completed history.
- Coaches see roster-wide status, including Not viewed for players without a status row, plus completion timestamps.
- Keep Practice Planner separate; a practice plan appears here only when explicitly attached.

## Data and security changes
- Add a `player_coaches` conversation type and player identity on conversations, with a unique player/team thread.
- Add a security-definer function to ensure that thread and a membership-sync trigger for active player/head-coach/assistant-coach changes. Tighten conversation read/post checks to active team membership and explicit participants.
- Add message pin fields plus a narrow coach-authorized pin function so coaches can pin without gaining permission to edit another sender’s message.
- Expand allowed attachment types and add an `assignment_attachments` table for multiple Plan attachments. Include explicit grants, RLS, same-team validation, and service-role access in the migration.
- Add `play_folder_memberships` with unique `(folder_id, play_id)`, same-team integrity, explicit grants, and RLS: team members read; team coaches manage. Backfill the existing `play_team_assignments.folder_id` links and switch app reads/writes to the join table.
- Preserve strict existing team/play/event RLS. Players cannot manage events, folders, team play assignments, or plans; parents/public users receive no chat, Playbook, or Plans access.
- Keep old announcements, resources, legacy direct conversations, and assignment links readable; remove only their separate top-level navigation.

## Notifications
- Send one deduplicated notification per relevant recipient for new team-chat/direct coaching messages, new or updated Plans, shared play/folder review, and event creation/change/cancellation.
- Respect existing notification preferences and push availability.
- Target selected Plan players instead of notifying unrelated teammates; exclude the sender; use item-specific Locker Room deep links.
- Keep database-triggered in-app notifications and server push/email delivery coordinated so one action does not create duplicate alerts.

## Implementation structure
- Split the current oversized Locker Room page into focused landing, chat, schedule, playbook, and plans components while retaining `/lockerroom` as the authenticated entry.
- Share the current calendar form/month view and attachment-card logic between existing screens and Locker Room.
- Extend the existing Locker Room data helpers instead of introducing parallel services.
- Record the new folder-membership and coaching-thread architecture in `AGENTS.md`; update the roadmap for this refactor.

## Verification
- Apply and inspect the migration, then verify RLS with coach, player, parent, and unrelated-coach access paths.
- Exercise coach Team Chat/Messages, player Team Chat/Message Coaches, assistant membership changes, pinning, and every attachment type.
- Verify high-contrast Upcoming/Calendar views, native event CRUD, Google read-only events, and player read-only behavior.
- Verify one play can belong to Dana Hills and ATO simultaneously without cloning, folder deletion is non-destructive, and players can run assigned plays.
- Verify whole-team and selected-player Plans, folder attachments, completion reporting, retained history, and notification deep links/deduplication.
- Confirm the public parent route remains stats + schedule only.
- Run focused tests, type checking, preview build, and Playwright checks at phone, iPad portrait, iPad landscape, and desktop widths.

## Assumptions
- “Head coach and active assistants” means active team membership rows with those roles; inactive/removed staff are removed from player coaching threads.
- Historical announcements/resources remain accessible contextually in Team Chat or attachment pickers, but cannot reappear as primary navigation.
