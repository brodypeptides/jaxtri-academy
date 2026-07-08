-- Sprint 6D — Manual Payout Requests (No R2)
-- Run this in Cloudflare D1 before using the payout request screens.
-- This version does NOT require Cloudflare R2 or any wrangler.toml changes.

CREATE TABLE IF NOT EXISTS affiliate_payout_profiles (
  user_id INTEGER PRIMARY KEY,
  payout_method TEXT NOT NULL DEFAULT 'PayPal',
  payout_email TEXT,
  payout_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_user_id INTEGER NOT NULL,
  amount_requested REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','paid','rejected','cancelled')),
  payout_method TEXT NOT NULL DEFAULT 'PayPal',
  payout_email TEXT,
  request_note TEXT,
  admin_note TEXT,
  transaction_id TEXT,
  proof_url TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by INTEGER,
  reviewed_at TEXT,
  paid_by INTEGER,
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(affiliate_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(paid_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_affiliate ON payout_requests(affiliate_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_requested ON payout_requests(requested_at);

CREATE TABLE IF NOT EXISTS payout_request_sales (
  payout_request_id INTEGER NOT NULL,
  sale_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(payout_request_id, sale_id),
  FOREIGN KEY(payout_request_id) REFERENCES payout_requests(id) ON DELETE CASCADE,
  FOREIGN KEY(sale_id) REFERENCES affiliate_sales(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payout_request_sales_sale ON payout_request_sales(sale_id);
