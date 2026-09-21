# CoachSide Notifications — real push + delivery system

Build a production notification system on top of what already exists (in-app notifications, preferences, the installed app). Nothing about live stats, Locker Room, Playbook, billing, Google Calendar or admin protection changes.

## What you'll get

**1. "Enable CoachSide Notifications" card**
Appears for signed-in coaches and players on the dashboard, the Locker Room and the profile page.
- Explains the benefit in one line, with one obvious button.
- The phone/browser permission box only opens when the person taps the button.
- On iPhone/iPad, if CoachSide isn't installed to the Home Screen yet, it shows the install steps instead of a button that can't work.
- Once on: a success state, the device name, a "Send test notification" button and a "Turn off on this device" button.
- Each person can have several devices turned on at once.

**2. Expanded notification choices**
Separate on/off switches for: push, email fallback, announcements/team messages, new team plays, assignments & challenges, schedule changes, game alerts, practice alerts, Play of the Day. Defaults favor useful alerts, not noise. No phone/SMS.

**3. Play of the Day alerts**
When the owner sets or changes Play of the Day, eligible coaches get one in-app alert plus a push if they opted in. Re-saving the same play sends nothing. Tapping it opens that play in the Library.

**4. Team event alerts**
New announcement, new play shared to the team, new assignment, and meaningful schedule changes (time/date/location/cancellation) alert only that team's members and open the right screen. Routine calendar reminders stay with the calendar; these are changes, not duplicates.

**5. Owner "Send Notification" center**
A new admin-only section inside My KPI. Owner picks the audience (all coaches, all users, one team, or one person by email), writes a title and message, optionally a link, picks channels (in-app / push / email), previews it, confirms, and sends. Every send is logged with sender, audience, channels, counts and time.

**6. Email honesty**
No email provider is configured in this project today. Email requests are written to a durable queue and the screens plainly say "Email delivery is not configured yet" — nothing will claim an email was sent. When a provider is added later, the queue drains through the same dispatcher.

**7. Notification metrics in My KPI**
Push-enabled people, pushes sent, push failures, notification opens, and email queued vs sent. Only real recorded numbers, no backfilled history.

## Technical plan

### Database (one migration)
- `push_subscriptions`: user_id, endpoint (unique), p256dh, auth, user_agent, device_label, created_at, updated_at, last_success_at, failure_count, active. RLS: owner-only select/insert/update/delete on own rows; service_role full. Grants per the public-schema rule.
- `notification_deliveries`: notification_id, user_id, channel (inapp|push|email), status (queued|sent|failed|skipped), error, created_at, sent_at. No client write access; authenticated may read own rows.
- `notification_email_queue`: user_id, to_email, subject, body, status, attempts, last_error, timestamps. Service-role only.
- `notification_broadcasts`: sent_by, audience_kind, audience_ref, title, body, link, channels, recipient_count, push_sent, push_failed, email_queued, created_at. Insert/select restricted to app admins (`is_app_admin()`).
- `notification_preferences`: add `push_enabled`, `schedule_change_notifications`, `play_of_the_day_notifications` (defaults on except where noisy); keep all existing columns.
- `notifications`: add `link` and `dedupe_key` (unique partial index on `(user_id, dedupe_key)`) so re-saving Play of the Day can't double-notify.
- `featured_play`: keep as-is; the Play-of-the-Day fan-out happens in the server function that sets it, not in a trigger, so the dispatcher can push and email too.

### Dispatcher (single entry point)
`src/lib/notify.server.ts` exports `dispatchNotification({ audience, type, title, body, link, prefColumn, dedupeKey, channels })`.
- Resolves audience → user ids (all coaches / all users / team members / explicit users), using the service-role client after the caller has been authorized.
- Loads each user's preferences and drops anyone opted out of that category.
- Inserts in-app rows (with dedupe key), sends Web Push to that user's active subscriptions, queues email rows when email is on.
- Records one `notification_deliveries` row per user/channel.
- Deactivates subscriptions returning 404/410 and increments `failure_count` on other errors.

### Web Push
- VAPID keypair generated server-side and stored as secrets: `VAPID_PRIVATE_KEY` (server only), `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`. The public key reaches the browser only through a server function — never a private key in browser code.
- Encryption/JWT signing via a pure-WebCrypto web-push library compatible with the Cloudflare Worker runtime (no Node-only `web-push` package).
- Server functions in `src/lib/notifications.functions.ts`: `getPushConfig`, `savePushSubscription`, `removePushSubscription`, `sendTestPush`, `listMyDevices`.

### Service worker
Keep the existing generated worker and its caching exactly as-is; add `workbox.importScripts: ["/push-sw.js"]` in `vite.config.ts` and a new `public/push-sw.js` that handles `push` (show notification with title/body/icon/data.url) and `notificationclick` (focus an open CoachSide window at that URL, otherwise open it). No new caching, no auth/API caching, installability unaffected.

### Client
- `src/lib/push.ts`: permission state, subscribe/unsubscribe, iOS-standalone detection (reuses `isStandalone`/`isIos` in `src/lib/pwa.ts`), device labeling.
- `src/components/EnablePushCard.tsx`: the UX above, built from the existing `Bubbles` primitives (centered heading/CTA, left-aligned copy, grouped panel).
- `NotificationPrefsPanel` gains the new toggles.
- On sign-out, `signOut()` removes this device's subscription row for the outgoing user before clearing the session, so a second account on the same device never inherits it.

### Admin sender
`src/lib/notifications.admin.functions.ts` — every function re-checks `is_app_admin()` with the caller's own identity before loading the privileged client (same pattern as `kpi.functions.ts`). `/kpi` gains a "Send Notification" section with audience picker, fields, preview and confirm. Normal coaches and players get a refusal from the server even by calling the endpoint directly.

### Verification
Typecheck + build; browser checks at mobile width for the enable card, prefs and admin sender; dedupe test for Play of the Day; team-scoping test that a team announcement reaches only that team; a non-admin call to the broadcast endpoint must be refused.

### Limitation stated up front
Real push receipt on a physical iPhone and Android device can only be confirmed by you on the published app — I'll verify subscription creation, payload encryption and the sender end-to-end against the live backend, and give you a test button in the app.
