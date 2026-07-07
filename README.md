# Jaxtri Academy — Sprint 3 Invites

Sprint 3 completes the first end-to-end onboarding loop:

1. Visitor applies.
2. Owner/manager reviews in Recruitment.
3. Approved application gets an Academy invite link.
4. Applicant opens invite link.
5. Applicant creates password + username.
6. Affiliate account is created.
7. Affiliate is automatically logged into the Academy.

## Copy instructions

Copy the contents of this folder into the root of your repo. Do not delete or replace `wrangler.toml` unless it keeps your correct D1 database ID.

## Database migration

Run this once in Cloudflare D1 before testing invites:

```sql
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  application_id INTEGER,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'affiliate' CHECK (role IN ('owner','manager','affiliate')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','revoked')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY(used_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_application_id ON invites(application_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
```

The same SQL is also saved in:

```text
database/sprint3-invites.sql
```

## Testing Sprint 3

1. Log in as owner.
2. Go to Recruitment.
3. Approve an application.
4. Click `Create invite`.
5. Copy/open the generated invite link.
6. Create an affiliate account.
7. Confirm the affiliate lands on `academy-dashboard.html`.
8. Log out and log back in with the new affiliate account.

## Notes

- Invite links expire after 14 days.
- Used invites are marked `used` and cannot be reused.
- Existing active invite links are reused if you click `Create invite` again before they expire.
- The invite system creates affiliate accounts only. Owner/manager direct invites can be added later.
