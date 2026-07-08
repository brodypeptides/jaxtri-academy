CREATE TABLE IF NOT EXISTS affiliate_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  event TEXT,
  external_order_id TEXT,
  affiliate_code TEXT,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','ignored','error')),
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_affiliate_webhook_provider_created ON affiliate_webhook_events(provider, created_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_webhook_order ON affiliate_webhook_events(external_order_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_webhook_status ON affiliate_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_wordpress_order ON affiliate_sales(source, external_order_id);
