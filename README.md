# Jaxtri Sprint 6F + 6G — Money Polish + WooCommerce Testing

This patch does what can be done on the Jaxtri/Cloudflare side while the store owner installs the WordPress plugin.

## What this adds

### Sprint 6F — Commission + payout polish

- Cleaner My Affiliate payout request flow
- Optional affiliate payout request note
- Payout timeline on affiliate side
- Better owner payout queue
- PayPal/reference transaction ID required before marking paid
- Optional proof link preview
- Admin note and affiliate note visibility
- Summary counts across requested/paid/rejected/cancelled payout requests
- Keeps rejected payout sales requestable again

### Sprint 6G — WooCommerce production testing, Jaxtri side only

- WooCommerce production check panel inside `owner-commissions.html`
- Checks if `JAXTRI_WC_WEBHOOK_SECRET` exists
- Checks if commission tables exist
- Checks if webhook event log table exists
- Sends a safe test webhook through the live endpoint
- Recent webhook event viewer
- Search/filter webhook logs

This does **not** require R2.

## Files included

```text
assets/session.js
assets/navigation-categories.css
owner-commissions.html
owner-payouts.html
my-affiliate.html
owner-users.html
functions/api/payout-requests.js
functions/api/admin/payout-requests.js
functions/api/admin/payout-requests/[id].js
functions/api/admin/webhook-events.js
functions/api/admin/webhook-test.js
functions/api/admin/affiliate-codes.js
functions/api/admin/users.js
database/sprint6g-webhook-events.sql
```

`owner-users.html`, `assets/session.js`, and `navigation-categories.css` are included so the recent sidebar/category + website commission/code controls stay intact.

## Required D1 migration

Run this new migration in Cloudflare D1 Console:

```text
database/sprint6g-webhook-events.sql
```

This creates:

```text
affiliate_webhook_events
```

It is safe to run more than once.

## Cloudflare secret

The WooCommerce test panel checks for:

```text
JAXTRI_WC_WEBHOOK_SECRET
```

This should match the secret entered in the WordPress plugin.

## Test after deploy

1. Open `owner-commissions.html`.
2. Scroll to **WooCommerce production check**.
3. Click **Check setup**.
4. If the D1 migration and secret are ready, click **Send test webhook**.
5. Refresh logs and confirm a processed test event appears.
6. Open `my-affiliate.html` and confirm payout request note/timeline works.
7. Open `owner-payouts.html`, request a payout, then mark paid only after entering a PayPal/reference ID.

## Commit message

```text
sprint 6f 6g money webhook polish
```
