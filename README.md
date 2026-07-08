# Jaxtri Sprint 7 — Affiliate Profile Hub

This sprint adds a dedicated profile page for each owner/manager/affiliate profile.

## What this adds

- New `owner-user-profile.html` page
- New API route: `/api/admin/users/:id/profile`
- Full profile view for each user:
  - role/status/title
  - affiliate code
  - commission percentage
  - payout method/handle
  - recent commission records
  - payout request history
  - applications and invites connected to the email
  - feed submissions
  - WooCommerce webhook events for that affiliate code
  - recent admin audit activity
- Adds an **Open full profile** button into each card on `owner-users.html` through `assets/session.js`
- Managers can view profiles; only owners still edit sensitive user/commission settings.

## Files included

```text
owner-user-profile.html
assets/session.js
functions/api/admin/users/[id]/profile.js
```

## D1

No new migration required.

This uses tables you already have if present:

```text
users
affiliate_codes
affiliate_sales
payout_requests
payout_request_sales
affiliate_payout_profiles
applications
invites
feed_posts
admin_audit_log
affiliate_webhook_events
sessions
user_presence
```

If some optional tables are missing, the profile page still loads and simply hides/empties that section.

## Install

Copy the files into the repo root and replace existing files when asked.

Then commit:

```text
sprint 7 affiliate profile hub
```

## Test

1. Open `owner-users.html`.
2. Click **Open full profile** on a user card.
3. Confirm `owner-user-profile.html?id=USER_ID` loads.
4. Check a profile with code `brody` and confirm commissions/webhook events appear when records exist.
