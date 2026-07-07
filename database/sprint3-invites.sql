-- Sprint 3: invite-based affiliate account activation
-- Run once after Sprint 2.1 is deployed.

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
