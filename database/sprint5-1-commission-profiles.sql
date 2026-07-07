-- Sprint 5.1 — Private commission percentages on user profiles
-- Run once in Cloudflare D1.
-- If D1 says duplicate column name, this migration has already been applied.

ALTER TABLE users ADD COLUMN commission_percentage REAL;

-- Optional examples:
-- UPDATE users SET commission_percentage = 15, updated_at = datetime('now') WHERE email = 'affiliate@example.com';
-- UPDATE users SET commission_percentage = NULL, updated_at = datetime('now') WHERE email = 'affiliate@example.com';
