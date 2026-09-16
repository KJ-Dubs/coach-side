# My KPI — owner-only analytics dashboard

An admin-only page that shows whether coaches are signing up, using CoachSide, creating plays, running games, and paying. Only CoachSide owners (existing `app_admins` list) can see the link or the data.

## Access

- New page at `/kpi` titled "My KPI", inside the signed-in area.
- Every number is fetched through one server call that first checks the existing owner check (`is_app_admin`) using the caller's own signed-in identity. Non-owners get a plain "Owners only" refusal — no partial numbers, no user data.
- The page itself also redirects non-owners back to the dashboard, so guessing the address shows nothing.
- An owner-only "My KPI" entry appears in the account menu (and a small owner panel in Settings). Coaches, assistants, players and parents never see it.
- No new admin system, no new public tables, public pages untouched.

## Sections

1. **Top KPI cards** with a Today / 7 days / 30 days / All time selector: coach accounts, new coaches, active coaches, teams, plays, published plays, games started, games completed, paid + complimentary teams, and monthly recurring revenue. Coach accounts count people who hold a coaching role on a team or program, excluding player-only accounts.
2. **Membership snapshot**: team counts per tier (Free Core, each single module, two-module, Complete), complimentary grants, plus past-due/canceled if present. Revenue uses the existing $6 / $12 / $15 rules and counts only genuinely active paid subscriptions — complimentary never counts. While Square is not live, revenue reads "$0 — billing not live yet".
3. **Coach activity feed**: recent real actions rebuilt from existing timestamps (play created, play published, game started, game completed, team created, roster added, heart given, calendar connected, membership/access-code change) merged into one time-ordered list with coach name and team.
4. **Recent coaches table**: name, email, signup date, last activity, teams, plays, games, tier, and a status of New / Active recently / Inactive from a stated rule (activity within 30 days). Sortable by newest / most active / inactive.
5. **Content KPIs**: published plays, plays created in period, hearts in period, most-hearted plays, current Play of the Day, follow relationships, top public creators (named creators only, never anonymous publishers).
6. **Game usage**: games started/completed in period, unique teams running Live Game, average games per active team, stat events recorded.
7. **Trends**: simple bar sparklines (signups, plays, games, active coaches by day/week) drawn with plain elements — no new chart library.

Anything not reconstructable from current data shows "Not tracked yet" rather than a guessed number.

## Forward-looking tracking

Add a small private `product_activity_events` table (user, event type, optional team/entity, timestamp, tiny non-sensitive detail) written by a lightweight helper for events the current tables cannot reconstruct — such as sign-ins and adding a Library play to a playbook. Owner-only reads, no client reads, no message content, no player personal data, no session replay or keystroke capture.

## Technical details

- One `src/lib/kpi.functions.ts` server function per section group, each guarded by `requireSupabaseAuth` + `is_app_admin` before any query; privileged reads load the service-role client inside the handler after that check.
- Page at `src/routes/_authenticated/kpi.tsx` using TanStack Query; UI built from the existing `SectionHeader` / `InfoPanel` / `StatTile` / `PrimaryCTA` primitives, dark theme with purple and orange emphasis, centered titles and filter controls, left-aligned detail rows, desktop-first tables that stack on mobile.
- Migration adds `product_activity_events` with row-level security, owner-only select, no anon grants.
- QA: type check, production build, owner vs normal-coach access check, and mobile plus desktop screenshots.
