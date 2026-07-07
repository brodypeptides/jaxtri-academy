-- Sprint 4 through 4.4: roster, presence, direct messages, channels, unread badges, and link/image sharing.
-- Run this once in Cloudflare D1 before testing Sprint 4.

CREATE TABLE IF NOT EXISTS user_presence (
  user_id INTEGER PRIMARY KEY,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  body TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_pair_created ON direct_messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_read ON direct_messages(receiver_id, read_at);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  access_role TEXT NOT NULL DEFAULT 'all' CHECK (access_role IN ('all','staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_access_role ON channels(access_role);

CREATE TABLE IF NOT EXISTS channel_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_created ON channel_messages(channel_id, created_at);

CREATE TABLE IF NOT EXISTS channel_reads (
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(channel_id, user_id),
  FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO channels (name, slug, description, access_role, created_by)
VALUES
  ('General', 'general', 'Team-wide updates and affiliate discussion.', 'all', (SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1)),
  ('Leadership', 'leadership', 'Owner and manager coordination.', 'staff', (SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1));
