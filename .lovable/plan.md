# Player invites, "Claimed" status, and what coaches can see players read

I only looked at the code and data here. Nothing was changed. The last section lists optional fixes, and they only happen if you approve them.

## 1. What makes a name show "Claimed" on the join page

- The join page gets its roster list from the database function `invite_roster(_token)`.
- A roster name shows **Claimed** only when that player has an **active `team_members` row that points to them** (`team_members.player_id = players.id` and `active = true`). It doesn't matter who the account belongs to.
- **Having signed in before is not enough.** Nothing links an account to a roster name until the player taps their name and joins. Joining runs `accept_team_invite(_token, _player_id)`, which saves `team_members(team_id, user_id, role='player', player_id, active=true)`.
- Other rules in that join step:
  - Each account has one row per team. If the player joins again, the system updates that row and keeps the old roster link if no new one is picked.
  - It refuses the join if a different account already holds that name ("already claimed").
  - The list shows only active players on the invite's team, and only while the invite link is on and not expired.
- Watch for this: the page greys out every claimed name, **including the player's own**. A player who already joined sees their name as Claimed and can't tap it.

## 2. Why a player who used CoachSide before might show as unclaimed

These are listed from most to least likely:
1. **They never finished joining.** They signed up or signed in but never picked their name and tapped Join. This is common with older flows, Google sign-in, or email confirmation. Their account exists, but it isn't linked to the roster.
2. **They used a different account,** for example Google one time and email another time. The second account isn't linked.
3. **The coach removed them** with "Remove …" in Locker Room access. Removing someone deletes or turns off their team membership, so their name becomes unclaimed.
4. **The roster name was replaced.** If the coach deleted that player and re-added them (or brought them back), it's a new roster entry. The old link points to the old entry.
5. **They are on a different team** (for example last season's team). Each team keeps its own roster and links.
6. **Parent link mixed up with player link.** The parent link opens the public team page and never claims a name.

What the current data shows: there are 20 active linked players. There are no turned-off links, no players without a roster name, no links to removed roster names, and no links across teams. So a player who shows as unclaimed right now almost certainly has **no link at all** (cause 1 or 2), not a broken one. To confirm for one person, look up their email in `team_directory(_team)`.

## 3. What coaches can see about players reading things

| Area | Saved in the database | Shown to coaches today |
|---|---|---|
| Team chat | `conversation_members.last_read_at`, updated by `markConversationRead` when a player opens a chat (Chat.tsx) | **No.** Only the player's own unread count uses it (PlayerHub). |
| Announcements | Table `announcement_receipts` (`viewed_at`, `acknowledged_at`). `markAnnouncement` and `fetchReceipts` exist in `src/lib/locker.ts` | **No.** Nothing in the app calls either one, so nothing is saved (0 rows). The "ask for acknowledgment" setting has no effect yet. |
| Plans (assignments) | `assignment_targets` (`status` = not_viewed / viewed / completed, `viewed_at`, `completed_at`) | **Yes, partly.** On each plan, coaches see "Player status" pills with each player's status and completion time (lockerroom.tsx). But the app only sets **completed** (Mark complete). Opening a plan isn't recorded, so players show "not viewed" until they finish. Only 1 row has a viewed time. |
| Schedule / playbook updates | Only per-user `notifications.read_at`, set when a player opens a notification | **No.** Owners see a total "opened" count in admin notification stats. Coaches see nothing per player. |
| Locker Room activity in general | `product_activity_events` does not record Locker Room views | Owner-only KPI page; no per-player detail |

Summary: the only per-player engagement coaches can actually see is **plan completion**.

## Optional fixes (only if approved)

1. Join page: show the player's own name as "You" and let them continue, instead of a greyed-out Claimed.
2. Coach roster: add a small "Linked / Not joined yet" label next to each player, so coaches can see who never finished joining.
3. Save announcement views and acknowledgments when a player opens an announcement, and show coaches "Seen 8/12 · Acknowledged 5/12."
4. Mark a plan as viewed when a player opens it, so the pills read not viewed / viewed / completed accurately.
5. Optional: show "last read" for team chat in each player's coach thread.

### Technical notes
- Key database functions: `invite_roster`, `accept_team_invite`, `team_directory`. Fixes 3 and 4 reuse the existing `markAnnouncement` and `setAssignmentStatus` helpers and the existing security rules. Fix 5 would need a coach-readable view of `last_read_at` that respects team access.
