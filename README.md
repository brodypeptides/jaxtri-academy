# Jaxtri Academy — Sprint 5 Admin User Management

Sprint 5 adds a safer owner-only user management workspace.

## New page

- `owner-users.html`

## New API routes

- `GET /api/admin/users` — list/search users with role, status, presence, sessions, invite counts
- `PATCH /api/admin/users/:id` — update non-owner role/status/company title
- `POST /api/admin/users/:id/sessions` — sign a user out everywhere
- `POST /api/admin/users/:id/delete` — permanently delete a confirmed non-owner test user

## Security rules

- Only `owner` accounts can open/use user management.
- Owner accounts are protected from web-panel changes.
- Owner promotion/demotion/deletion stays D1 command-line only.
- The panel can change `affiliate` ↔ `manager` safely.
- The panel can set status to `active`, `pending`, or `suspended` for non-owner users.
- Deleting requires typing the user's email exactly.

## D1 migration

Run this once to enable admin audit logging:

```sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  target_user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);
```

The feature still works if you forget the audit table, but the audit history will not be saved until you run it.

## Test checklist

1. Log in as owner.
2. Go to `owner-users.html`.
3. Search users by name/email.
4. Change a test affiliate to manager.
5. Change them back to affiliate.
6. Suspend a test account.
7. Try logging into that suspended account.
8. Reactivate the test account.
9. Revoke sessions for a test user.
10. Delete only a disposable test user.

## Suggested commit message

```text
sprint 5 admin user management
```
