# Sprint 9.1 — Optional Mobile App + Push Notifications

This sprint turns Jaxtri Academy into an optional PWA-style mobile app and adds opt-in push notifications.

## What this adds

- Optional Add to Home Screen banner
- Android/Chrome install prompt support
- iPhone install instructions: Safari → Share → Add to Home Screen
- Service worker for app mode and push handling
- Push subscription save/disable APIs
- Push notification test button
- Notifications page install + push control panel
- Device subscription table in D1
- VAPID key generator script

## Files

```text
assets/session.js
assets/pwa-install.css
assets/pwa-install.js
manifest.json
service-worker.js
notifications.html
functions/lib/webpush.js
functions/api/push/public-key.js
functions/api/push/subscription.js
functions/api/push/test.js
database/sprint9-1-pwa-push.sql
scripts/generate-vapid-keys.mjs
```

## Required D1 migration

Run this in Cloudflare D1:

```text
database/sprint9-1-pwa-push.sql
```

It creates:

```text
push_subscriptions
notification_preferences
```

## Required Cloudflare environment variables

Generate keys locally from your repo root after applying this patch:

```bash
node scripts/generate-vapid-keys.mjs
```

Add the printed values in Cloudflare Pages:

```text
Workers & Pages → jaxtri-academy → Settings → Environment variables
```

Add:

```text
WEB_PUSH_PUBLIC_KEY=<generated value>
WEB_PUSH_PRIVATE_KEY=<generated value>
WEB_PUSH_SUBJECT=mailto:support@jaxtrilabsacademy.com
```

Use the same values for Production. Preview can be left blank if you only care about live production push.

## Important behavior

- Install is optional.
- Push notifications are off by default.
- Users must tap Enable notifications.
- iPhone users must install the site to Home Screen first, then open the installed app and enable notifications.
- This version sends a generic push notification that opens `notifications.html`.
- Detailed notification payloads can be added in the production-hardening sprint.

## Testing

1. Apply patch.
2. Run the D1 migration.
3. Add the Cloudflare environment variables.
4. Deploy successfully.
5. Open:

```text
https://jaxtrilabsacademy.com/notifications.html
```

6. Click **Enable notifications**.
7. Click **Send test**.
8. You should get an app-style notification that opens the notifications page.

## Commit message

```text
sprint 9.1 pwa install push notifications
```
