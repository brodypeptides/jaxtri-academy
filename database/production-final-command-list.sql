-- Jaxtri production DB command list
-- Run these in Cloudflare D1 -> jaxtri_academy -> Console.
-- These SELECT commands are read-only unless marked CLEANUP.

-- 1) Verify all required tables exist.
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
    'affiliate_webhook_events','admin_user_notes','user_onboarding_items','app_notifications','push_subscriptions'
  )
ORDER BY name;

-- 2) Count missing required tables. Should return 0.
WITH required(name) AS (
  VALUES
  ('users'),('sessions'),('app_settings'),
  ('applications'),('invites'),
  ('user_presence'),('direct_messages'),('channels'),('channel_messages'),('channel_reads'),
  ('feed_posts'),('admin_audit_log'),
  ('affiliate_codes'),('affiliate_sales'),
  ('affiliate_payout_profiles'),('payout_requests'),('payout_request_sales'),
  ('affiliate_webhook_events'),('admin_user_notes'),('user_onboarding_items'),('app_notifications'),('push_subscriptions')
)
SELECT required.name AS missing_table
FROM required
LEFT JOIN sqlite_master sm ON sm.type='table' AND sm.name=required.name
WHERE sm.name IS NULL;

-- 3) Verify active owner accounts.
SELECT id, full_name, email, role, status, company_title
FROM users
WHERE role='owner'
ORDER BY id ASC;

-- 4) Verify active profiles missing affiliate codes.
SELECT u.id, u.full_name, u.email, u.role, u.status
FROM users u
LEFT JOIN affiliate_codes ac ON ac.user_id = u.id AND ac.status='active'
WHERE u.status='active'
  AND u.role IN ('owner','manager','affiliate')
  AND ac.id IS NULL
ORDER BY u.role, u.email;

-- 5) Verify active profiles missing commission percentages.
SELECT id, full_name, email, role, status, commission_percentage
FROM users
WHERE status='active'
  AND role IN ('owner','manager','affiliate')
  AND (commission_percentage IS NULL OR commission_percentage = '')
ORDER BY role, email;

-- 6) Verify payout tables.
SELECT status, COUNT(*) AS requests, COALESCE(SUM(amount_requested),0) AS total_requested
FROM payout_requests
GROUP BY status
ORDER BY status;

-- 7) Verify commission ledger status counts.
SELECT status, COUNT(*) AS sales, COALESCE(SUM(commission_amount),0) AS total_commission
FROM affiliate_sales
GROUP BY status
ORDER BY status;

-- 8) Verify WooCommerce webhook logs by status.
SELECT status, COUNT(*) AS event_count
FROM affiliate_webhook_events
GROUP BY status
ORDER BY status;

-- 9) Verify push subscription table exists and count active devices.
SELECT status, COUNT(*) AS device_count
FROM push_subscriptions
GROUP BY status
ORDER BY status;

-- 10) Preview old verification/demo webhook events before cleanup.
SELECT id, event, external_order_id, affiliate_code, status, message, created_at
FROM affiliate_webhook_events
WHERE lower(COALESCE(event,'')) LIKE '%test%'
   OR lower(COALESCE(message,'')) LIKE '%test%'
   OR lower(COALESCE(external_order_id,'')) LIKE '%test%'
ORDER BY id DESC;

-- OPTIONAL CLEANUP: delete old verification/demo webhook events after previewing them above.
-- DELETE FROM affiliate_webhook_events
-- WHERE lower(COALESCE(event,'')) LIKE '%test%'
--    OR lower(COALESCE(message,'')) LIKE '%test%'
--    OR lower(COALESCE(external_order_id,'')) LIKE '%test%';

-- 11) Preview old demo/manual sales before cleanup. Review carefully before deleting anything.
SELECT id, affiliate_user_id, source, external_order_id, customer_email, gross_amount, commission_amount, status, notes, created_at
FROM affiliate_sales
WHERE lower(COALESCE(external_order_id,'')) LIKE '%test%'
   OR lower(COALESCE(notes,'')) LIKE '%test%'
   OR lower(COALESCE(customer_email,'')) LIKE '%test%'
ORDER BY id DESC;

-- OPTIONAL CLEANUP: delete obvious demo/manual sales only after previewing above.
-- DELETE FROM affiliate_sales
-- WHERE lower(COALESCE(external_order_id,'')) LIKE '%test%'
--    OR lower(COALESCE(notes,'')) LIKE '%test%'
--    OR lower(COALESCE(customer_email,'')) LIKE '%test%';
