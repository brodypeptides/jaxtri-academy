-- Jaxtri Platform base D1 schema
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','affiliate')),
  company_title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  discord_username TEXT,
  tiktok TEXT,
  instagram TEXT,
  youtube TEXT,
  experience TEXT,
  why_join TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(reviewed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);

-- Sprint 3 invite-based onboarding
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
