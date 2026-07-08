# Jaxtri Academy — Sprint 6B WooCommerce Connector

This sprint starts the GoAffPro replacement path now that the store is confirmed to use WooCommerce.

## What this adds

- Jaxtri webhook endpoint for WooCommerce sales
- WordPress plugin for referral cookie tracking
- WordPress plugin settings screen
- WooCommerce order status syncing
- Refund/cancel/failed order handling
- Webhook event log table
- Connector instructions inside the Commission Center

## New Jaxtri endpoint

```text
/api/webhooks/woocommerce
```

The WordPress plugin sends server-to-server POST requests to this endpoint.

## Important security setup

In Cloudflare Pages, add an environment variable:

```text
JAXTRI_WC_WEBHOOK_SECRET=make-a-long-random-secret-here
```

Use the exact same secret inside the WordPress plugin settings.

## D1 migration

Run this in D1:

```text
database/sprint6b-woocommerce-connector.sql
```

If D1 does not accept file paths, run the SQL inside that file manually.

## WordPress plugin

The plugin is included here:

```text
wordpress/jaxtri-wordpress-connector-plugin.zip
```

Install it in WordPress:

```text
WordPress Admin → Plugins → Add New → Upload Plugin
```

Then configure it:

```text
WordPress Admin → Settings → Jaxtri Affiliate
```

Set:

```text
Academy webhook URL: https://YOUR-ACADEMY.pages.dev/api/webhooks/woocommerce
Webhook secret: same as Cloudflare JAXTRI_WC_WEBHOOK_SECRET
Referral parameter: ref
Cookie days: 30
```

## Affiliate links

Use links like:

```text
https://YOURSTORE.com/?ref=AFFILIATECODE
```

The plugin saves `AFFILIATECODE` in a browser cookie, attaches it to the WooCommerce order, and sends the sale to Jaxtri when the order becomes processing or completed.

## Order handling

- WooCommerce `processing` / `completed` → creates or updates a pending commission sale
- WooCommerce `cancelled` / `failed` / `refunded` → voids the sale if it has not already been marked paid
- Paid commissions are not automatically changed by webhooks to avoid silently altering already-paid records

## Test flow

1. In Jaxtri, create an affiliate code for a test affiliate.
2. In Cloudflare, set `JAXTRI_WC_WEBHOOK_SECRET`.
3. Install and configure the WordPress plugin.
4. Visit the store with `?ref=CODE`.
5. Place a WooCommerce test order.
6. Open Jaxtri → Commissions.
7. Confirm the sale appears as pending.
8. Cancel/refund the test order and confirm the sale voids.

## Commit message

```text
sprint 6b woocommerce connector
```
