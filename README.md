# Sprint 6B.2 — WooCommerce Webhook Health Check

This patch updates:

- `functions/api/webhooks/woocommerce.js`

## What it fixes

Opening `/api/webhooks/woocommerce` in a browser now returns a clean JSON health-check instead of falling back to the public homepage.

The real WooCommerce connector still uses `POST` requests with the `x-jaxtri-secret` header. This patch does not change sale tracking logic, coupon tracking, or commission calculations.

## Install

1. Copy this patch into the repo.
2. Commit and push.
3. Wait for Cloudflare Pages to redeploy.
4. Visit:

```text
https://YOUR-SITE.pages.dev/api/webhooks/woocommerce
```

Expected response:

```json
{
  "ok": true,
  "endpoint": "Jaxtri WooCommerce webhook",
  "status": "active",
  "method": "POST required"
}
```

## Commit message

```text
sprint 6b.2 webhook healthcheck
```
