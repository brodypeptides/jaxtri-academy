-- Sprint 6A: Commission dashboard shell + manual sales tracking
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS affiliate_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_codes_user_id ON affiliate_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_code ON affiliate_codes(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_status ON affiliate_codes(status);

CREATE TABLE IF NOT EXISTS affiliate_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_user_id INTEGER NOT NULL,
  affiliate_code TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','wordpress','webhook','import')),
  external_order_id TEXT,
  customer_email TEXT,
  gross_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  commission_percentage REAL NOT NULL,
  commission_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','voided')),
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status_updated_by INTEGER,
  status_updated_at TEXT,
  FOREIGN KEY(affiliate_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(status_updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_sales_affiliate ON affiliate_sales(affiliate_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_status ON affiliate_sales(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_created_at ON affiliate_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_order_id ON affiliate_sales(external_order_id);
