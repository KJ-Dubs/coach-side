# My KPI activity: findings and proposed cleanup

## Findings (investigation only, nothing changed)

### 1) Repeated "signed in" rows
- The only place that records it is `src/routes/auth.tsx`, in the `AuthPage` `useEffect`, which calls `trackActivity("signed_in")` (`src/lib/activity.ts`).
- It fires whenever the `/auth` page mounts and finds an existing session (`ready && session && !recovering`). That includes a real password or Google sign-in. It also includes any later visit to `/auth` while already signed in, for example the `/auth?next=...` bounce from a shared link, an OAuth return, or a PWA reopening on `/auth`.
- The effect depends on `[ready, session, navigate, recovering]`. `useAuth` updates `session` twice, once from `onAuthStateChange` (INITIAL_SESSION / SIGNED_IN) and once from `getSession()`. So one visit can log two rows.
- Real data: Lee Cahill has two `signed_in` rows at 2026-09-24 22:17:17.814322 and .814326, 4 microseconds apart. That is one login logged twice.
- Conclusion: "signed in" means "the sign-in page saw a session". It is not one row per authentication event. Nothing is deduplicated.

### 2) "trial started" for Lee Cahill / WPCB Awa
- Source: the database trigger `teams_start_trial`, which runs AFTER INSERT on `teams` and calls `public.start_team_trial()` (migration `20260924234757_...sql`).
- On the coach's first team, and only if neither the coach nor the org has claimed a trial before, it:
  - writes a `trial_claims` row
  - writes a `team_trials` row with 14 days and source `new_team`
  - logs the `trial_started` and `team_created` events
- Live row: team WPCB Awa, started 2026-09-25 09:14:53, ends 2026-10-09 09:14:53, source `new_team`. This is the 14-day CoachSide Complete trial.
- Charges: none. WPCB Awa has no `team_billing` row, no Stripe customer and no subscription. The trial needs no card. It only makes the entitlement check treat the team as Complete.
- Enforcement: controlled by `BILLING_ENFORCEMENT_ENABLED` (`src/lib/billing.server.ts` `enforcementEnabled()`). It is on only if that value is literally "true". It has never been enabled, so nothing is locked for anyone, with or without the trial.

### 3) Duplicate "team created" and "Unknown"
- `getKpi` in `src/lib/kpi.functions.ts` builds the feed from two sources:
  - a "Team created" row made from every `teams` row, attributed to the first staff member found in `team_members`
  - every raw `product_activity_events` row, displayed as "team created"
- Since the trigger went in, each new team appears twice, and the second copy also comes with "trial started".
- The derived row shows "Unknown" when a team has no head or assistant coach in `team_members`, such as orphaned or neutralized teams from the old join bug. It is not caused by missing events: there are 0 orphaned event rows.

## Proposed fixes (only if you approve)
1. Log `signed_in` only on a real `SIGNED_IN` auth event. Deduplicate it per user per browser session, or skip it if the last one was under about 30 minutes ago.
2. In the KPI feed, drop the derived "Team created" row for teams that already have a `team_created` event. Label raw events with friendly names, e.g. "Complete trial started (14 days)".
3. Show "No coach on team" instead of "Unknown" for staffless teams.
4. Optional: collapse existing same-second duplicate `signed_in` rows in the feed.

## Technical details
- Files: `src/routes/auth.tsx`, `src/lib/activity.ts`, `src/lib/kpi.functions.ts`. No database changes needed.
