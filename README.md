# Jaxtri Production Hard Cleanup

This patch removes remaining visible version/build language from production pages and switches verification actions to production wording.

## Files added/replaced

- `assets/production-mode.js` — simplified production mode helper, no text-rewrite bandaid.
- `functions/api/admin/webhook-verification.js` — production-named WooCommerce verification endpoint.
- `functions/api/push/verification.js` — production-named push verification endpoint.
- `database/production-final-missing-tables.sql` — current production DB repair script.
- `database/production-final-command-list.sql` — current production verification commands.
- `tools/apply-production-hard-cleanup.ps1` — Windows-safe text cleanup script.
- `apply-production-hard-cleanup.bat` — double-click/run helper.
- `cleanup-production-old-routes.bat` — removes old hidden route files.

## Install steps

1. Copy everything in this folder into the root of your `jaxtri-academy` repo.
2. Replace files when asked.
3. Double-click `apply-production-hard-cleanup.bat` from the repo root.
4. Review changes in GitHub Desktop.
5. Commit message: `production hard cleanup`
6. Push.
7. Wait for Cloudflare deploy success.

## Database

You already fixed `push_subscriptions` and `notification_preferences`, but the clean production SQL is included in:

`database/production-final-missing-tables.sql`

Use `database/production-final-command-list.sql` to verify everything in D1.

## After deploy

Open:

- `https://jaxtrilabsacademy.com/owner-commissions.html`
- `https://jaxtrilabsacademy.com/notifications.html`
- `https://jaxtrilabsacademy.com/production-ready.html`

Confirm there is no visible version/build wording and the production checker is green except optional app subscriptions.
