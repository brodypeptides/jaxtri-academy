# Jaxtri Academy — Sprint 3.1 Direct Admin Invites

Sprint 3.1 adds Level 1 email invites:

1. Owner/manager opens `owner-admin.html`.
2. Admin enters an email address.
3. Admin chooses a role.
4. The app creates an invite link.
5. Admin can copy the link or open an email draft.
6. The invited person opens `invite.html`, creates their account, and is logged in.

No paid email service is required yet. The `Open email draft` button uses a normal `mailto:` link so you can send the invite manually from your email app.

## What changed

New backend files:

```text
functions/api/admin/invites.js
functions/api/admin/invites/[id]/revoke.js
```

Updated files:

```text
owner-admin.html
owner-dashboard.html
functions/api/invites/[token].js
```

New helper/reference file:

```text
database/sprint3-1-direct-invites.sql
```

## Copy instructions

Copy the contents of this folder into the root of your repo. Keep your existing `wrangler.toml` with your correct D1 database ID.

## Database

If Sprint 3 already works, you do **not** need a new migration. Sprint 3.1 uses the existing `invites` table.

If you have not run Sprint 3's invite table migration yet, run:

```text
database/sprint3-invites.sql
```

## Permissions

- Owner can create affiliate, manager, and owner invites.
- Manager can create affiliate invites only.
- Used invite links cannot be revoked.
- Active invite links can be revoked before the invited person creates an account.
- Existing users cannot receive duplicate invites. Update their role/status in D1 instead.

## Testing Sprint 3.1

1. Log in as owner.
2. Go to Admin.
3. Enter a test email.
4. Choose `Affiliate` first.
5. Click `Create invite`.
6. Copy/open the invite link.
7. Create the account.
8. Confirm the new account logs into the Academy.
9. Repeat with a manager invite when ready.

## Company owner invite

For the company owner, use the `Owner` role only when the app is polished and you are ready to grant full command center access.

A safer option is to invite them as `Manager`, let them test, then promote them to `Owner` in D1 when ready.
