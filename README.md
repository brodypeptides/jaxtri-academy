# Jaxtri Desktop Alerts Visibility Fix

This is a small follow-up patch for Mega Sprint 7.1–9.

## What it fixes

The notification system existed, but desktop users had to know to open `notifications.html` or find it in the sidebar. This patch adds a visible desktop **Alerts** button with a live count next to Logout.

It also adds a badge count to the mobile Alerts tab.

## Files changed

```text
assets/session.js
assets/mobile-app.css
```

## Database

No new D1 migration.

This uses the existing `/api/notifications` endpoint and the existing Sprint 7–9 tables.

## Test

After deploy, open any internal page on desktop:

```text
owner-dashboard.html
owner-users.html
owner-commissions.html
academy-dashboard.html
```

You should see:

```text
Alerts 0
```

next to Logout. If there are active notifications, it shows the count. High-priority alerts get red styling.

Commit message:

```text
desktop alerts visibility fix
```
