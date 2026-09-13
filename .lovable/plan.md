# CoachSide production-readiness audit + paid-tier architecture

No code was changed. Findings first, then the recommended way to add paid tiers.

## 1. Database, sign-in, files, live updates

Connected and working. The backend holds 34 tables, every one with row-level security switched on and policies attached, and it has real data: 14 accounts, 2 teams, 23 players, 7 games, 216 recorded game events, 30 plays.

- Sign-in: email/password plus Google, with "remember this device", session restore, and an offline-tolerant gate on coach pages.
- Files: one private team-logos bucket, read through short-lived signed links. This is the only file storage in use.
- Live updates: the app does **not** use push/live database subscriptions anywhere. The parent link refreshes every 15 seconds by polling instead. That is a deliberate, workable choice, not a bug.
- Offline: live game events queue on the device and sync when signal returns.

## 2. AI / GPT

None. There is no OpenAI or GPT code anywhere in the project. An AI key exists in the project's stored secrets but nothing reads it. Nothing to remove; nothing to rely on.

## 3. Square / payments

None. No Square code, no payment screens, no pricing, no purchase webhooks, no Square credentials stored. This is a greenfield addition (section 8).

## 4. Google Calendar

Code is complete for one-way import (Google -> CoachSide): sign-in with Google, encrypted token storage, calendar picking, event import into the team schedule, read-only imported events, and disconnect. The one saved connection row belongs to the seeded demo team and has no Google account attached, so **no real coach connection has been completed and verified end to end**. Outside-the-app setup in the Google console (exact callback address, allowed origin, Calendar API enabled, test users) is the remaining gate.

## 5. Installable app (PWA)

Ready. Valid app manifest, 192/512/maskable/Apple icons, a conservative offline cache for static files only (never data, sign-in, or shared-link traffic), install prompts for Android/desktop, and Add-to-Home-Screen instructions for iPhone/iPad. It only activates on the published site, not in preview.

## 6. Accounts, roles, sharing

- Coach accounts get a program and full access. Player accounts come only from a coach's join link and are limited to the Locker Room.
- Roles are resolved from the database on every load, never from the device; coach authority always beats a stale player record.
- Parent link: a read-only token page showing stats and schedule only, with a live in-progress game card.
- Player join link + on-screen QR code on the dashboard, with a "replace link" that revokes the old one.
- A player must pick their name from the roster to claim a spot, and claims can't be taken twice.

## 7. Blockers before public launch

1. Google Calendar has never been completed by a real coach; finish one live connection before advertising it.
2. 33 database warnings: helper functions that signed-in (6 of them, anyone) users can call directly. Most are intentional internal helpers, but they should be reviewed and locked down once.
3. Seeded demo data (demo team, placeholder calendar connection) is still in the live database and should be cleaned or clearly separated.
4. No paywall exists, so every feature is currently free to anyone who signs up.
5. No usage limits or abuse protection on public token links beyond the token itself.
6. Email deliverability (confirmation / invite emails) has not been verified on the custom domain.

## 8. Recommended architecture for Free / $5 / $10 / $15 tiers

Principle: the browser never decides what someone paid for. Square handles money, the backend stores the truth, and the app only reads it.

**Data**
- `plans` — the four tiers, their limits, and their Square catalog/price identifiers. Readable by all signed-in users.
- `subscriptions` — one row per program: tier, status, current period end, Square customer/subscription id. Writable only by the server; readable only by that program's coaches.
- `access_codes` — code, tier granted, max uses, uses so far, expiry, active flag. **Never readable by the browser at all.**
- `access_code_redemptions` — who redeemed what and when, one per program.
- `billing_events` — raw webhook log for replay and dispute resolution.

**Buying**
1. A head coach picks a tier; a server call creates a Square-hosted checkout link tied to their program and returns only the URL.
2. Square hosts the payment page. No card data ever touches CoachSide.
3. Square redirects back to a thank-you screen that simply says "confirming" and polls entitlement.

**Webhooks (the source of truth)**
- One public endpoint under the existing `/api/public/...` pattern that verifies Square's signature before reading the body, records the raw event, then updates `subscriptions`.
- Handle created / updated / paused / canceled / payment failed. Treat events as replayable so duplicates are harmless.
- Keep a scheduled reconciliation that re-reads Square for any subscription not heard from recently, so a missed webhook can't silently grant or revoke access.

**100%-off access codes**
- Redemption is a single server-side, privileged database function: it checks the code exists, is active, unexpired, and under its use cap, then writes a `subscriptions` row with source `access_code` and the granted tier, and increments usage atomically.
- The browser only ever sends the typed code and receives success/failure. Codes are never listed, never downloaded, never embedded in the app, and there is no client-readable table of them.
- Rate-limit redemption attempts per account to block guessing.

**Enforcing tiers**
- One backend helper answers "what tier does this program have right now" from `subscriptions`, defaulting to Free.
- Feature limits are enforced in database policies and server calls (for example: number of teams, saved plays, stored games, report exports). The interface may also hide locked features, but hiding is presentation only — the backend still refuses.
- Downgrades never delete data; they make extra items read-only.

**Secrets**
- Square access token and webhook signature key live in the project's server-side secrets only. The client uses nothing but the hosted checkout URL the server hands it.

## Suggested order of work

1. Lock down the flagged database helper functions and clear seeded demo data.
2. Complete and verify one real Google Calendar connection.
3. Add plans/subscriptions/entitlement reads with everyone on Free (no paywall yet).
4. Add Square checkout + verified webhook + reconciliation.
5. Add access codes and redemption.
6. Turn on enforcement tier by tier.
