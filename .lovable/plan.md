# CoachSide Retention + Monetization Funnel

Build it in 7 parts, in this order, so each part stands on its own: server data model, tips, trial, achievements, Play of the Day, Help, entitlement UX, then Launch QA. Billing enforcement stays OFF throughout.

## Decisions to confirm
1. **Stripe replaces Square.** Project memory says "Square, never Stripe." This plan switches the payment provider to Stripe and updates that memory. The existing Square webhook stays in place but inactive, and nothing is deleted.
2. **How Stripe gets connected.** Lovable has built-in Stripe payments with no keys to manage (Pro plan required, set up from the editor chat). This plan builds provider-neutral subscription columns plus an admin price-ID mapping. Those work with either the built-in option or your own Stripe account. No checkout goes live until real price IDs exist.
3. **When the trial starts:** when a coach creates their first team. Abuse protection: one trial per coach account and per organization, recorded permanently, so it survives deleting a team.
4. **Current pilot teams** get a complimentary grant through a one-click admin backfill in Launch QA. It is not automatic.
5. **Play of the Day and the nurture messages** run from one daily scheduled job, not frequent polling.

## A) CoachSide Tips
- One central tips list with 16+ tips.
- A short tips screen shows before Dashboard, Playmaker, Drill Maker and Playbook.
- It shows at most once per destination per browser session, for about 1.8s, or longer while the page is still loading.
- Skip appears after 1s. It never shows on Live Game or player routes.
- Design: centered CS mark, an animated ring, a "CoachSide Tip" pill and the tip inside a card, with a fade out.

## B) 14-day Complete trial
- New `team_trials` record per team: start, end, source. Plus `trial_claims` keyed by user and org to stop repeat trials.
- The trial counts as all three modules inside the existing team entitlement check.
- A small status pill reads "CoachSide Complete Trial • N days left", with a "Keep Complete for $15/month" button.
- Contextual messages at 7, 3 and 1 days left, and when the trial expires.
- After expiry: Free Core stays and no data is ever deleted. Locks apply only once enforcement is ON.

## C) Achievements
- New `achievement_definitions` list, covering every milestone in the brief, grouped by category, with levels.
- New `user_achievements` table.
- A database function recalculates progress from real rows: plays, publishes, library saves, hearts, follows, roster, joins, posts, assignments, events, games, shot events, drills, practice plans, push subscriptions, profile handle.
- Real activity events also count: shares, MP4 exports, stat exports, board use in a game, PWA install, Play of the Day views.
- Each unlock creates an in-app notification linking to the achievements page. Push only for major milestones.
- Home progress card: count, progress bar and the next achievement. A full `/achievements` page with locked and unlocked medals.
- My KPI: % of coaches reaching the key activation milestones, plus the most and least completed achievements.

## D) Automated Play of the Day
- New `play_of_the_day` table with one row per date and a source (manual / auto / scheduled).
- Daily selection:
  - A manual pick wins.
  - Otherwise use a weighted score: recent hearts, recent engagement, category variety.
  - Skip plays featured in the last 30 days, and only use valid published plays that have frames.
- Notifications are deduped by date: in-app, plus push for opted-in coaches. Email only if a provider is configured and the coach opted in.
- The link opens the play directly.
- Admin: today, the past 30 days, manual override and scheduling future days.

## E) Help / FAQ
- New `/help` page with a search box and all 16 sections.
- Each section covers what the feature does, when to use it, basketball use cases, quick steps and troubleshooting.
- Contact is support@coachside.live only.
- A secondary Home card: "Need help maximizing your CoachSide account?"

## F) Stripe-ready entitlements
- New team billing columns: stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, current_period_end, cancel_at_period_end, last_webhook_event_id / webhook state.
- Admin-only `billing_price_map` for Playbook+, GameDay+, Team Hub+, the three two-module combinations and Complete. It starts empty and shows "missing" until filled.
- A signed Stripe webhook route. It is idempotent and does nothing until a signing secret exists.
- Server config for support and sender addresses. Email shows as "configured" only when a real provider check passes.
- One reusable `PaidAction` wrapper shows the benefit, the module price and Complete as upgrade choices. It is applied to: add Library play, publish, MP4, Live Game location tracking, shot charts, assignments/resources, Google Calendar and parent sharing.
- The membership upsell disappears for Complete and trial teams.

## G) Launch QA (admin-only, protected on the server like My KPI)
1. **Config status:** enforcement, Stripe mode, webhook, email, push, addresses, price-map completeness.
2. **Persona simulator** covering every state in the brief. It is a view-only override kept in the admin's own browser session. It changes only what the admin sees and never writes to billing.
3. **Feature matrix:** Allowed / Locked / Trial for the selected persona.
4. **Stripe test checklist.** Each check shows pass/fail from real webhook and subscription rows, or "waiting on configuration".
5. **Notification tests:** in-app, push and email, each reporting the real result.
6. **Trial test:** a test-only trial context with a time-travel slider, showing the countdown, the 7/3/1 messages and the expiry lock.
7. **Achievement mapping** and the admin's own event log. Read-only.
8. **Funnel events:** landing_view through feature_paywall_viewed, recorded in the existing activity events and shown in My KPI.

## Onboarding nurture
- New `nurture_messages` table: day, default message, fallback rules.
- New `nurture_deliveries` table: unique per team, day and user.
- The daily job sends each due message. If the coach already did that task, it suggests their next unfinished achievement instead.
- In-app plus push when opted in. Email only when configured. A new "Onboarding tips" setting in notification preferences acts as the unsubscribe.

## Technical details
- Database changes: the new tables and billing columns above, with grants and security rules. The admin-only tables are readable only by admins through a server check. The progress and Play of the Day selection functions run with elevated rights, and plain accounts cannot run them directly.
- Server functions in `src/lib/*.functions.ts`. Scheduled route `/api/public/cron/daily`, protected by the existing scheduled-job check. One daily schedule.
- New pages: `/achievements`, `/help`, `/launch-qa` (admin gate reused from My KPI).
- The existing single entitlement check and "unlocked while enforcement is off" behavior stay the entry point for all gating.
- Verify with a typecheck and build, then browser checks of tips, the simulator, help search and the progress card.

## Waiting on you
- Real Stripe keys or built-in Stripe setup, plus price IDs.
- An email delivery provider.
