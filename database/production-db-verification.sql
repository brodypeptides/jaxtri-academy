-- Jaxtri Labs Academy Production Database Verification Commands
-- Run these in Cloudflare D1 → jaxtri_academy → Console.
-- These commands are read-only. They verify tables, columns, key counts, and launch blockers.

-- 1) Verify every production table exists.
WITH required_tables(name) AS (
  VALUES
  ('users'),
  ('sessions'),
  ('app_settings'),
  ('applications'),
  ('invites'),
  ('user_presence'),
  ('direct_messages'),
  ('channels'),
  ('channel_messages'),
  ('channel_reads'),
  ('feed_posts'),
  ('admin_audit_log'),
  ('affiliate_codes'),
  ('affiliate_sales'),
  ('affiliate_payout_profiles'),
  ('payout_requests'),
  ('payout_request_sales'),
  ('affiliate_webhook_events'),
  ('admin_user_notes'),
  ('user_onboarding_items'),
  ('app_notifications'),
  ('push_subscriptions')
)
SELECT
  required_tables.name AS required_table,
  CASE WHEN sqlite_master.name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM required_tables
LEFT JOIN sqlite_master
  ON sqlite_master.type = 'table'
 AND sqlite_master.name = required_tables.name
ORDER BY status DESC, required_table;

-- 2) Verify important production columns exist.
WITH required_columns(table_name, column_name) AS (
  VALUES
  ('users','id'),
  ('users','full_name'),
  ('users','email'),
  ('users','username'),
  ('users','password_hash'),
  ('users','role'),
  ('users','company_title'),
  ('users','status'),
  ('users','commission_percentage'),
  ('users','created_at'),
  ('users','updated_at'),
  ('affiliate_codes','user_id'),
  ('affiliate_codes','code'),
  ('affiliate_codes','status'),
  ('affiliate_sales','affiliate_user_id'),
  ('affiliate_sales','gross_amount'),
  ('affiliate_sales','commission_percentage'),
  ('affiliate_sales','commission_amount'),
  ('affiliate_sales','status'),
  ('affiliate_sales','source'),
  ('affiliate_sales','external_order_id'),
  ('affiliate_payout_profiles','user_id'),
  ('affiliate_payout_profiles','payout_method'),
  ('affiliate_payout_profiles','payout_email'),
  ('affiliate_payout_profiles','payout_notes'),
  ('payout_requests','affiliate_user_id'),
  ('payout_requests','amount_requested'),
  ('payout_requests','status'),
  ('payout_requests','payout_method'),
  ('payout_requests','payout_email'),
  ('payout_requests','request_note'),
  ('payout_requests','transaction_id'),
  ('payout_requests','proof_url'),
  ('affiliate_webhook_events','provider'),
  ('affiliate_webhook_events','external_order_id'),
  ('affiliate_webhook_events','affiliate_code'),
  ('affiliate_webhook_events','status'),
  ('affiliate_webhook_events','message'),
  ('affiliate_webhook_events','created_at'),
  ('push_subscriptions','user_id'),
  ('push_subscriptions','endpoint'),
  ('push_subscriptions','p256dh'),
  ('push_subscriptions','auth'),
  ('push_subscriptions','status'),
  ('app_notifications','title'),
  ('app_notifications','body'),
  ('app_notifications','status'),
  ('app_notifications','audience_type'),
  ('app_notifications','user_id'),
  ('admin_user_notes','target_user_id'),
  ('admin_user_notes','note'),
  ('admin_user_notes','created_by'),
  ('user_onboarding_items','user_id'),
  ('user_onboarding_items','item_key'),
  ('user_onboarding_items','status')
)
SELECT
  required_columns.table_name,
  required_columns.column_name,
  CASE WHEN table_info.name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM required_columns
LEFT JOIN pragma_table_info(required_columns.table_name) AS table_info
  ON table_info.name = required_columns.column_name
ORDER BY status DESC, required_columns.table_name, required_columns.column_name;

-- 3) Verify active owner account exists.
SELECT
  COUNT(*) AS active_owner_accounts
FROM users
WHERE role = 'owner'
  AND status = 'active';

-- 4) Verify user role/status distribution.
SELECT role, status, COUNT(*) AS count
FROM users
GROUP BY role, status
ORDER BY role, status;

-- 5) Find active profiles missing affiliate codes.
SELECT
  u.id,
  u.full_name,
  u.email,
  u.role,
  u.status
FROM users u
LEFT JOIN affiliate_codes ac
  ON ac.user_id = u.id
 AND ac.status = 'active'
WHERE u.status = 'active'
  AND u.role IN ('owner','manager','affiliate')
  AND ac.id IS NULL
ORDER BY u.role, u.email;

-- 6) Find active profiles missing commission percentage.
SELECT
  id,
  full_name,
  email,
  role,
  status,
  commission_percentage
FROM users
WHERE status = 'active'
  AND role IN ('owner','manager','affiliate')
  AND (commission_percentage IS NULL OR commission_percentage = '')
ORDER BY role, email;

-- 7) Verify affiliate code uniqueness and active code status.
SELECT
  lower(code) AS code_key,
  COUNT(*) AS count
FROM affiliate_codes
GROUP BY lower(code)
HAVING COUNT(*) > 1;

SELECT
  ac.code,
  ac.status,
  u.full_name,
  u.email,
  u.role,
  u.commission_percentage
FROM affiliate_codes ac
JOIN users u ON u.id = ac.user_id
ORDER BY ac.status, ac.code;

-- 8) Verify commission ledger totals by status.
SELECT
  status,
  COUNT(*) AS records,
  ROUND(COALESCE(SUM(gross_amount), 0), 2) AS gross_total,
  ROUND(COALESCE(SUM(commission_amount), 0), 2) AS commission_total
FROM affiliate_sales
GROUP BY status
ORDER BY status;

-- 9) Find possible duplicate WooCommerce/manual order IDs.
SELECT
  source,
  external_order_id,
  COUNT(*) AS count
FROM affiliate_sales
WHERE external_order_id IS NOT NULL
  AND trim(external_order_id) <> ''
GROUP BY source, external_order_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 10) Verify payout queue.
SELECT
  status,
  COUNT(*) AS requests,
  ROUND(COALESCE(SUM(amount_requested), 0), 2) AS amount
FROM payout_requests
GROUP BY status
ORDER BY status;

-- 11) Check payout profiles that may contain bank transfer details.
SELECT
  p.user_id,
  u.full_name,
  u.email,
  p.payout_method,
  CASE
    WHEN lower(COALESCE(p.payout_notes,'')) LIKE '%routing%' THEN 'contains routing text'
    WHEN lower(COALESCE(p.payout_notes,'')) LIKE '%account%' THEN 'contains account text'
    ELSE 'review'
  END AS review_reason
FROM affiliate_payout_profiles p
JOIN users u ON u.id = p.user_id
WHERE lower(COALESCE(p.payout_method,'')) LIKE '%bank%'
   OR lower(COALESCE(p.payout_notes,'')) LIKE '%routing%'
   OR lower(COALESCE(p.payout_notes,'')) LIKE '%account%';

-- 12) Verify WooCommerce webhook health.
SELECT
  status,
  COUNT(*) AS events
FROM affiliate_webhook_events
GROUP BY status
ORDER BY status;

SELECT
  id,
  provider,
  event,
  external_order_id,
  affiliate_code,
  status,
  message,
  created_at
FROM affiliate_webhook_events
WHERE status = 'error'
ORDER BY datetime(created_at) DESC
LIMIT 25;

-- 13) Verify unread notifications.
SELECT
  audience_type,
  status,
  COUNT(*) AS count
FROM app_notifications
GROUP BY audience_type, status
ORDER BY audience_type, status;

-- 14) Verify active push subscriptions.
SELECT
  status,
  COUNT(*) AS count
FROM push_subscriptions
GROUP BY status
ORDER BY status;

-- 15) Verify onboarding checklist progress.
SELECT
  status,
  COUNT(*) AS count
FROM user_onboarding_items
GROUP BY status
ORDER BY status;

-- 16) Verify recent admin audit activity.
SELECT
  action,
  COUNT(*) AS count
FROM admin_audit_log
GROUP BY action
ORDER BY count DESC
LIMIT 25;
