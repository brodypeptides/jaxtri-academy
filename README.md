# Jaxtri Academy — Sprint 3.1.1 Owner Invite Lockdown

This patch keeps Sprint 3.1 direct invites, but removes `Owner` from the Admin panel invite role selector.

## What changed

- Admin panel can create direct invites for `Affiliate` and `Manager`.
- `Owner` invites are blocked at the API level, even if someone tries to force the request manually.
- Existing owner invites still work if they were created intentionally in D1.
- Owner invite creation is now a D1 Console / command-line-only action.

## Why

Owner access is full command center access. Keeping Owner invites out of the web panel prevents accidental full-access invites.

## No database migration needed

This uses the same Sprint 3 `invites` table.

## How to create an Owner invite manually in D1

Go to Cloudflare → D1 → your database → Console.

Replace the email below, then run:

```sql
INSERT INTO invites (
  token,
  application_id,
  email,
  role,
  status,
  expires_at,
  created_by
)
VALUES (
  lower(hex(randomblob(24))),
  NULL,
  'OWNER_EMAIL_HERE',
  'owner',
  'active',
  datetime('now', '+14 days'),
  (SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1)
);
```

Then get the token:

```sql
SELECT token, email, role, status, expires_at
FROM invites
WHERE email = 'OWNER_EMAIL_HERE'
ORDER BY id DESC
LIMIT 1;
```

Your invite link is:

```text
https://YOUR-SITE.pages.dev/invite.html?token=PASTE_TOKEN_HERE
```

After the company owner accepts the invite, confirm them:

```sql
SELECT id, full_name, email, username, role, status, created_at
FROM users
WHERE email = 'OWNER_EMAIL_HERE';
```

## Install

Copy these files into the repo, replacing existing matching files:

- `owner-admin.html`
- `functions/api/admin/invites.js`
- `README.md`

Then commit and push:

```text
sprint 3.1.1 owner invite lockdown
```
