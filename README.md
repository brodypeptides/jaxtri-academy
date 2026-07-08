# Jaxtri Mega Sprint 7.1 + 7.2 + 8 + 9

This bundle combines the next four roadmap items in one Cloudflare-safe patch.

## What this adds

### Sprint 7.1 — Profile actions + admin notes
- Full affiliate/user profile hub at `owner-user-profile.html?id=USER_ID`
- Quick set commission
- Quick set affiliate code
- Quick save role/status/title for non-owner profiles
- Suspend/reactivate helper
- Sign out sessions
- Private admin notes with note types and pinned flag

### Sprint 7.2 — Affiliate onboarding checklist
- Computed onboarding checklist per affiliate/user
- Manual checklist override controls
- Tracks: approved application, invite sent, account created, code assigned, commission set, payout profile completed, first sale, first payout, and training started/manual review

### Sprint 8 — Notifications
- New `notifications.html`
- New `/api/notifications` endpoint
- Staff action items for applications, payout requests, feed review, pending commissions, and webhook errors
- Affiliate action items for missing code, payout profile, available commission, requested payouts, pending commissions, and unread DMs
- Supports stored app notifications from D1

### Sprint 9 — Mobile/app polish
- `manifest.json`
- `service-worker.js`
- `assets/mobile-app.css`
- mobile bottom nav injected by `assets/session.js`
- installable PWA basics

## Files included

```text
owner-users.html
owner-user-profile.html
notifications.html
assets/session.js
assets/mobile-app.css
manifest.json
service-worker.js
functions/api/admin/users/[id]/profile.js
functions/api/admin/users/[id]/notes.js
functions/api/notifications.js
database/sprint7-8-9-profile-notifications-mobile.sql
```

## Required D1 migration

Run this file in Cloudflare D1:

```text
database/sprint7-8-9-profile-notifications-mobile.sql
```

It creates:

```text
admin_user_notes
user_onboarding_items
app_notifications
```

Safe to run more than once.

## Test after deploy

1. Open `owner-users.html`.
2. Click **Open full profile** on a user.
3. Confirm profile loads at `owner-user-profile.html?id=USER_ID`.
4. Add an admin note.
5. Toggle an onboarding checklist item.
6. Open `notifications.html`.
7. Test mobile width and confirm bottom nav appears.

## Commit message

```text
mega sprint 7 8 9 profile notifications mobile
```
