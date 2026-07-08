-- Jaxtri production DB verification command list.
-- Run these in Cloudflare D1 -> jaxtri_academy -> Console.

-- 1) Confirm required tables exist.
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name IN (
    'users','sessions','app_settings',
    'applications','invites',
    'user_presence','direct_messages','channels','channel_messages','channel_reads',
    'feed_posts','admin_audit_log',
    'affiliate_codes','affiliate_sales',
    'affiliate_payout_profiles','payout_requests','payout_request_sales',
    'affiliate_webhook_events','admin_user_notes','user_onboarding_items','app_notifications','push_subscriptions','notification_preferences'
  )
ORDER BY name;

-- 2) Missing table report. Should return zero rows.
WITH required(name) AS (
  VALUES
  ('users'),('sessions'),('app_settings'),
  ('applications'),('invites'),
  ('user_presence'),('direct_messages'),('channels'),('channel_messages'),('channel_reads'),
  ('feed_posts'),('admin_audit_log'),
  ('affiliate_codes'),('affiliate_sales'),
  ('affiliate_payout_profiles'),('payout_requests'),('payout_request_sales'),
  ('affiliate_webhook_events'),('admin_user_notes'),('user_onboarding_items'),('app_notifications'),('push_subscriptions'),('notification_preferences')
)
SELECT required.name AS missing_table
FROM required
LEFT JOIN sqlite_master sm ON sm.type='table' AND sm.name=required.name
WHERE sm.name IS NULL;

-- 3) Confirm push subscription columns required by the app.
PRAGMA table_info(push_subscriptions);

-- 4) Confirm active owner accounts.
SELECT id, full_name, email, role, status, company_title
FROM users
WHERE role='owner'
ORDER BY id ASC;

-- 5) Active profiles missing affiliate codes.
SELECT u.id, u.full_name, u.email, u.role, u.status
FROM users u
LEFT JOIN affiliate_codes ac ON ac.user_id = u.id AND ac.status='active'
WHERE u.status='active'
  AND u.role IN ('owner','manager','affiliate')
  AND ac.id IS NULL
ORDER BY u.role, u.email;

-- 6) Active profiles missing commission percentages.
SELECT id, full_name, email, role, status, commission_percentage
FROM users
WHERE status='active'
  AND role IN ('owner','manager','affiliate')
  AND (commission_percentage IS NULL OR commission_percentage = '')
ORDER BY role, email;

-- 7) Payout request summary.
SELECT status, COUNT(*) AS requests, COALESCE(SUM(amount_requested),0) AS total_requested
FROM payout_requests
GROUP BY status
ORDER BY status;

-- 8) Commission ledger summary.
SELECT status, COUNT(*) AS sales, COALESCE(SUM(commission_amount),0) AS total_commission
FROM affiliate_sales
GROUP BY status
ORDER BY status;

-- 9) WooCommerce webhook log summary.
SELECT status, COUNT(*) AS event_count
FROM affiliate_webhook_events
GROUP BY status
ORDER BY status;

-- 10) Push subscription device summary.
SELECT status, COUNT(*) AS device_count
FROM push_subscriptions
GROUP BY status
ORDER BY status;

-- 11) Any webhook errors that should be reviewed before launch.
SELECT id, event, external_order_id, affiliate_code, status, message, created_at
FROM affiliate_webhook_events
WHERE status='error'
ORDER BY id DESC;
