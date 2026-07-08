# Jaxtri Production Final Patch

This patch makes the site look and behave more production-ready:

- Keeps the new Jaxtri logo and app icons in place.
- Removes visible Sprint/version labels from app pages.
- Replaces visible testing language with production/verification language.
- Refreshes the service worker cache so browsers and mobile installs pick up the final assets.
- Updates the production readiness checker so optional push subscriptions do not block launch.
- Adds the missing production database migration for profile notes, onboarding, stored notifications, and push subscriptions.
- Adds a full D1 verification command list.

## 1. Apply patch

Copy this ZIP into your repo root and replace files.

Commit message:

```bash
git add .
git commit -m "production final cleanup"
git push
```

## 2. Run required D1 migration

In Cloudflare:

`D1 -> jaxtri_academy -> Console`

Run:

```text
database/production-final-missing-tables.sql
```

This creates:

- `admin_user_notes`
- `user_onboarding_items`
- `app_notifications`
- `push_subscriptions`

## 3. Run verification commands

After the migration, run:

```text
database/production-final-command-list.sql
```

The important missing-table query should return zero rows.

## 4. Push notification env vars

The production checker will keep showing push key review until these are added in Cloudflare Pages:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

Generate them with:

```bash
node scripts/generate-vapid-keys.mjs
```

## 5. Recheck launch page

Open:

```text
https://jaxtrilabsacademy.com/production-ready.html
```

The database table issue should clear after running the migration.
