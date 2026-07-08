-- Sprint 7.1 + 7.2 + 8 + 9 — Profile notes, onboarding checklist, notifications, and mobile app prep
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS admin_user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_user_id INTEGER NOT NULL,
  author_id INTEGER,
  note TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('general','onboarding','commission','payout','risk','success')),
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  archived_at TEXT,
  FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_target
ON admin_user_notes(target_user_id, archived_at, created_at);

CREATE TABLE IF NOT EXISTS user_onboarding_items (
  user_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','skipped','blocked')),
  note TEXT,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, item_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_items_status
ON user_onboarding_items(status);

CREATE TABLE IF NOT EXISTS app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience_type TEXT NOT NULL DEFAULT 'staff' CHECK (audience_type IN ('all','staff','user')),
  user_id INTEGER,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','archived')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT,
  archived_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_audience
ON app_notifications(audience_type, user_id, status, created_at);
