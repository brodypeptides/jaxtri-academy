-- Sprint 6G — WooCommerce webhook event viewer
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS affiliate_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'woocommerce',
  event TEXT,
  external_order_id TEXT,
  affiliate_code TEXT,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','ignored','error')),
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_affiliate_webhook_events_created
ON affiliate_webhook_events(created_at);

CREATE INDEX IF NOT EXISTS idx_affiliate_webhook_events_status
ON affiliate_webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_affiliate_webhook_events_order
ON affiliate_webhook_events(external_order_id);
