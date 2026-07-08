# Jaxtri Cloudflare build fix — duplicate function cleanup

Your Cloudflare build failed because some function files were copied into the wrong folder.

Bad paths found by Cloudflare:

```text
functions/api/admin/admin/affiliate-codes.js
functions/api/admin/admin/payout-requests.js
functions/api/admin/admin/payout-requests/[id].js
functions/api/admin/admin/users.js
functions/api/admin/admin/webhook-events.js
functions/api/admin/admin/webhook-test.js
functions/api/admin/payout-requests.js with the wrong import
```

## What this patch does

- Restores the correct admin function files in `functions/api/admin/`.
- Restores the affiliate payout API in `functions/api/payout-requests.js`.
- Includes the latest payout-method field polish HTML.
- Includes a cleanup script to remove the bad nested folder: `functions/api/admin/admin`.

## How to install

1. Copy the contents of this patch folder into the root of your repo.
2. Replace files when prompted.
3. Run `cleanup-bad-function-duplicates.bat` from the repo root.
4. In GitHub Desktop, confirm `functions/api/admin/admin` is deleted.
5. Commit and push.

## Do not delete

Keep these correct files:

```text
functions/api/admin/affiliate-codes.js
functions/api/admin/users.js
functions/api/admin/webhook-events.js
functions/api/admin/webhook-test.js
functions/api/admin/payout-requests.js
functions/api/admin/payout-requests/[id].js
functions/api/payout-requests.js
functions/lib/auth.js
```

## Delete only this duplicate folder

```text
functions/api/admin/admin
```

## Commit message

```text
fix cloudflare function paths
```
