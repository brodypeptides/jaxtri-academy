# Sprint 6D — Manual Payout Requests (No R2)

This version avoids Cloudflare R2 completely. It uses D1 only.

## What this adds

- `my-affiliate.html`
  - personal affiliate stats
  - active affiliate code
  - referral link copy
  - pending commission
  - approved/requestable commission
  - requested payout amount
  - total paid
  - payout profile settings
  - request payout button
  - payout request history

- `owner-payouts.html`
  - manager/owner payout queue
  - requested / paid / rejected filters
  - PayPal/reference ID field
  - proof link field
  - paid / reject controls

- APIs
  - `GET /api/payout-requests`
  - `PATCH /api/payout-requests`
  - `POST /api/payout-requests`
  - `GET /api/admin/payout-requests`
  - `PATCH /api/admin/payout-requests/:id`

## No R2 setup needed

Do not create an R2 bucket.
Do not add an R2 binding to `wrangler.toml`.
This patch only needs D1.

For payout proof, owners/managers can paste a PayPal transaction ID and/or a proof link. Later, if you decide you want direct screenshot uploads, we can add storage separately.

## D1 migration

Run this file in Cloudflare D1:

```text
database/sprint6d-manual-payouts-no-r2.sql
```

## Install

1. Copy this patch into the repo.
2. Do not change `wrangler.toml` for R2.
3. Run the D1 migration.
4. Commit and push.
5. Wait for Cloudflare Pages to redeploy.

## Test flow

Affiliate side:

1. Open `my-affiliate.html`.
2. Save payout method/email.
3. Confirm stats show code, pending, available, requested, paid.
4. If approved unpaid sales exist, click `Request payout`.

Owner/manager side:

1. Open `owner-payouts.html`.
2. See the requested payout.
3. Pay manually through PayPal/Cash App/etc.
4. Enter PayPal transaction/reference ID.
5. Optional: paste proof link.
6. Click `Mark paid`.

When a request is marked paid, the attached approved sales become `paid` in the commission ledger.

## Commit message

```text
sprint 6d manual payout requests no r2
```
