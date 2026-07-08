
# Jaxtri Production Logo + Launch Hardening Patch

This patch implements the new Jaxtri Labs Academy logo across the public site, protected dashboards, PWA app icons, browser favicon, and push notification icons.

## Files included

### Branding + app icons
- `assets/branding/logo-main.png`
- `assets/branding/logo-square.png`
- `assets/branding/icon-192.png`
- `assets/branding/icon-512.png`
- `assets/branding/icon-192-maskable.png`
- `assets/branding/icon-512-maskable.png`
- `assets/branding/apple-touch-icon.png`
- `assets/branding/favicon-32x32.png`
- `assets/branding/favicon-16x16.png`
- `assets/branding/favicon.ico`
- `assets/icon-192.png`
- `assets/icon-512.png`
- `favicon.ico`
- `favicon-32x32.png`
- `favicon-16x16.png`

### Branding CSS/JS
- `assets/logo-branding.css`
- `assets/logo-branding.js`
- `assets/production-mode.js`

### Updated production/PWA files
- `manifest.json`
- `service-worker.js`
- `assets/session.js`

### Updated public pages
- `index.html`
- `login.html`
- `apply.html`
- `application-submitted.html`
- `invite.html`

### Production launch checker
- `production-ready.html`
- `functions/api/admin/production-check.js`

### Database verification command list
- `database/production-db-verification.sql`

## What this patch does

- Adds the new logo to browser tabs, website header, sidebar, public pages, mobile homescreen app, and push notifications.
- Replaces the old letter-style sidebar mark with the new image logo.
- Updates the PWA manifest to use the new app icons.
- Updates the service worker cache so mobile users receive the new logo/icon files.
- Adds production language cleanup for protected pages.
- Adds an owner-only production launch checker at:
  `/production-ready.html`
- Adds a SQL verification file you can run in D1.

## Install

1. Copy all files from this patch into the repository root.
2. Replace files when prompted.
3. Commit and push:

```bash
git add .
git commit -m "production logo and launch readiness"
git push
```

4. Wait for Cloudflare deploy success.
5. Open:

```text
https://jaxtrilabsacademy.com/production-ready.html
```

## D1 verification

Open:

```text
Cloudflare → D1 → jaxtri_academy → Console
```

Then run commands from:

```text
database/production-db-verification.sql
```

## Mobile app icon note

Phones often cache old Home Screen icons. After deploy:
- Remove the old Home Screen app.
- Open Safari/Chrome.
- Visit `https://jaxtrilabsacademy.com`.
- Add to Home Screen again.

## No new migration

This patch does not create new database tables. It verifies existing production tables only.
