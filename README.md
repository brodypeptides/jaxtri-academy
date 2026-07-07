# Jaxtri Academy — Sprint 2.1 Recruitment Admin

This package keeps Sprint 1 auth working and extends Sprint 2 Recruitment.

## Added in Sprint 2.1

- Recruitment tabs: Pending, Approved, Rejected, Archived, All
- Archive application
- Restore archived application
- Owner-only permanent delete
- Dashboard pending + archived counts
- D1 migration for `archived_at`

## Copy/push

Copy the contents of this folder into your repo. Do not delete your existing `wrangler.toml` unless it keeps the same D1 database ID.

Then commit and push:

```text
sprint 2.1 recruitment admin
```

## Required D1 migration

Run this once in Cloudflare D1 before testing archive/restore:

```sql
ALTER TABLE applications ADD COLUMN archived_at TEXT;
```

This SQL is also included in:

```text
database/sprint2-1-recruitment-admin.sql
```

If Cloudflare says the column already exists, that is okay — it means you already ran it.

## Testing cleanup

To see test applications:

```sql
SELECT id, full_name, email, status, archived_at, created_at
FROM applications
ORDER BY id DESC;
```

To permanently delete a test application by ID:

```sql
DELETE FROM applications
WHERE id = 1;
```

For real applicants, archive is safer than delete.
