# Sprint 6D — R2 Upload Foundation + Manual Payout Requests

This sprint adds the foundation for proof screenshot uploads and manual affiliate payout requests.

## What this adds

- `my-affiliate.html`
  - personal affiliate section
  - personal commission stats
  - affiliate code + referral link copy
  - payout method/email settings
  - request payout button
  - payout request history

- `owner-payouts.html`
  - manager/owner payout queue
  - requested / paid / rejected filters
  - PayPal transaction/reference ID field
  - payout proof URL field
  - R2 proof screenshot upload
  - confirm paid / reject controls

- R2 upload APIs
  - `POST /api/uploads/proof`
  - `GET /api/uploads/:id`

- Manual payout APIs
  - `GET /api/payout-requests`
  - `PATCH /api/payout-requests`
  - `POST /api/payout-requests`
  - `GET /api/admin/payout-requests`
  - `PATCH /api/admin/payout-requests/:id`

## Important: R2 is not the database

D1 stores the payout records and upload metadata.

R2 stores actual files, such as payout proof screenshots.

## Cloudflare setup

Create an R2 bucket in Cloudflare named:

```text
jaxtri-uploads
```

Then add this binding to your existing `wrangler.toml`.

Do not replace your existing D1 block. Just add this below it:

```toml
[[r2_buckets]]
binding = "UPLOADS_BUCKET"
bucket_name = "jaxtri-uploads"
```

Your existing D1 binding should stay as-is:

```toml
[[d1_databases]]
binding = "DB"
database_name = "jaxtri_academy"
database_id = "c7ecbbaa-09bc-4c0f-ae7f-878cdac27f60"
```

## D1 migration

Run this file in Cloudflare D1:

```text
database/sprint6d-r2-manual-payouts.sql
```

## Install

1. Copy this patch into the repo.
2. Add the R2 bucket binding to `wrangler.toml` without replacing your D1 settings.
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
5. Optional: upload screenshot proof using the file upload.
6. Click `Mark paid`.

When a request is marked paid, the attached approved sales become `paid` in the commissions ledger.

## Commit message

```text
sprint 6d r2 manual payout requests
```
