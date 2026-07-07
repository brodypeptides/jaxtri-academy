-- Sprint 2.1 Recruitment Admin migration
-- Run this ONCE in Cloudflare D1 before testing archive/restore.

ALTER TABLE applications ADD COLUMN archived_at TEXT;

-- Optional testing cleanup examples. Do NOT run unless you mean it.
-- SELECT id, full_name, email, status, archived_at, created_at FROM applications ORDER BY id DESC;
-- DELETE FROM applications WHERE id = 1;
-- DELETE FROM applications WHERE email = 'test@gmail.com';
