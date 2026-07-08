-- Jaxtri production final database repair.
-- Run in Cloudflare D1 -> jaxtri_academy -> Console.

CREATE TABLE IF NOT EXISTS admin_user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_user_id INTEGER NOT NULL,
  author_id INTEGER,
  note TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('general','onboarding','commission','payout','risk','success')),
  is_pinned INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_target ON admin_user_notes(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_notes_created ON admin_user_notes(created_at);

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

CREATE INDEX IF NOT EXISTS idx_user_onboarding_items_status ON user_onboarding_items(status);

CREATE TABLE IF NOT EXISTS app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  audience_type TEXT NOT NULL DEFAULT 'user' CHECK (audience_type IN ('user','staff','all')),
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','archived')),
  read_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user ON app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_audience ON app_notifications(audience_type);
CREATE INDEX IF NOT EXISTS idx_app_notifications_status ON app_notifications(status);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  device_label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_status ON push_subscriptions(status);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER PRIMARY KEY,
  push_enabled INTEGER NOT NULL DEFAULT 0,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_push ON notification_preferences(push_enabled);
