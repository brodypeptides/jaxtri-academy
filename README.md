# Jaxtri Academy — Sprint 2 Full Fixed Package

This package restores the Sprint 1 auth files and adds Sprint 2 Recruitment.

## Important files included

- `functions/lib/auth.js`
- `functions/api/login.js`
- `functions/api/logout.js`
- `functions/api/me.js`
- `functions/api/setup.js`
- `functions/api/setup-status.js`
- `functions/api/applications.js`
- `functions/api/admin/applications.js`
- `functions/api/admin/applications/[id]/approve.js`
- `functions/api/admin/applications/[id]/reject.js`
- `apply.html`
- `application-submitted.html`
- `owner-dashboard.html`
- `owner-recruitment.html`

## D1

Run `database/sprint2-recruitment.sql` if your `applications` table is not already created.

## Deploy

Copy this package into the repo without deleting `wrangler.toml`, commit, push, and let Cloudflare deploy.
