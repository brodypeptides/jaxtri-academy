import { json, getUserFromRequest } from '../../lib/auth.js';

const REQUIRED_TABLES = [
  'users',
  'sessions',
  'app_settings',
  'applications',
  'invites',
  'user_presence',
  'direct_messages',
  'channels',
  'channel_messages',
  'channel_reads',
  'feed_posts',
  'admin_audit_log',
  'affiliate_codes',
  'affiliate_sales',
  'affiliate_payout_profiles',
  'payout_requests',
  'payout_request_sales',
  'affiliate_webhook_events',
  'admin_user_notes',
  'user_onboarding_items',
  'app_notifications',
  'push_subscriptions',
];

const REQUIRED_COLUMNS = {
  users: ['id', 'full_name', 'email', 'username', 'password_hash', 'role', 'company_title', 'status', 'commission_percentage', 'created_at', 'updated_at'],
  affiliate_sales: ['affiliate_user_id', 'gross_amount', 'commission_percentage', 'commission_amount', 'status', 'source', 'external_order_id'],
  affiliate_codes: ['user_id', 'code', 'status'],
  payout_requests: ['affiliate_user_id', 'amount_requested', 'status', 'payout_method', 'payout_email', 'request_note', 'transaction_id', 'proof_url'],
  affiliate_payout_profiles: ['user_id', 'payout_method', 'payout_email', 'payout_notes'],
  affiliate_webhook_events: ['provider', 'external_order_id', 'affiliate_code', 'status', 'message', 'created_at'],
  push_subscriptions: ['user_id', 'endpoint', 'p256dh', 'auth', 'status'],
};

function isOwner(user) {
  return user && user.status === 'active' && user.role === 'owner';
}

async function tableExists(env, name) {
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first();
    return Boolean(row);
  } catch {
    return false;
  }
}

async function columnExists(env, table, column) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (result.results || []).some((row) => row.name === column);
  } catch {
    return false;
  }
}

async function safeFirst(env, sql, binds = [], tableName = null) {
  try {
    if (tableName && !(await tableExists(env, tableName))) return null;
    return await env.DB.prepare(sql).bind(...binds).first();
  } catch {
    return null;
  }
}

function check(status, title, message, detail = '') {
  return { status, title, message, detail };
}

function dbItem(item, ok, message = '') {
  return { item, status: ok ? 'ok' : 'error', message };
}

function envOk(env, key) {
  return Boolean(String(env[key] || '').trim());
}

export async function onRequestGet({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isOwner(actor)) return json({ error: 'Owner access required.' }, 403);

    const checks = [];
    const database = [];

    for (const table of REQUIRED_TABLES) {
      const exists = await tableExists(env, table);
      database.push(dbItem(`table:${table}`, exists, exists ? 'Exists' : 'Missing migration/table'));
    }

    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      for (const column of columns) {
        const exists = await columnExists(env, table, column);
        database.push(dbItem(`column:${table}.${column}`, exists, exists ? 'Exists' : 'Missing column'));
      }
    }

    const missingTables = database.filter((row) => row.item.startsWith('table:') && row.status !== 'ok');
    const missingColumns = database.filter((row) => row.item.startsWith('column:') && row.status !== 'ok');

    checks.push(
      missingTables.length
        ? check('error', 'Database tables', `${missingTables.length} required table${missingTables.length === 1 ? '' : 's'} missing.`, missingTables.map((x) => x.item.replace('table:', '')).join(', '))
        : check('ok', 'Database tables', 'All core production tables exist.')
    );

    checks.push(
      missingColumns.length
        ? check('error', 'Database columns', `${missingColumns.length} required column${missingColumns.length === 1 ? '' : 's'} missing.`, missingColumns.slice(0, 8).map((x) => x.item.replace('column:', '')).join(', '))
        : check('ok', 'Database columns', 'All core production columns exist.')
    );

    const ownerCount = await safeFirst(env, "SELECT COUNT(*) AS count FROM users WHERE role = 'owner' AND status = 'active'", [], 'users');
    checks.push(
      Number(ownerCount?.count || 0) >= 1
        ? check('ok', 'Owner account', `${ownerCount.count} active owner account${Number(ownerCount.count) === 1 ? '' : 's'} found.`)
        : check('error', 'Owner account', 'No active owner account found.')
    );

    const wcSecretReady = envOk(env, 'JAXTRI_WC_WEBHOOK_SECRET');
    checks.push(
      wcSecretReady
        ? check('ok', 'WooCommerce secret', 'JAXTRI_WC_WEBHOOK_SECRET is set.')
        : check('error', 'WooCommerce secret', 'Add JAXTRI_WC_WEBHOOK_SECRET in Cloudflare Pages environment variables.')
    );

    const pushMissing = ['WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'WEB_PUSH_SUBJECT'].filter((key) => !envOk(env, key));
    checks.push(
      pushMissing.length
        ? check('warn', 'Push notification keys', `Missing ${pushMissing.length} push environment variable${pushMissing.length === 1 ? '' : 's'}.`, pushMissing.join(', '))
        : check('ok', 'Push notification keys', 'Web push environment variables are set.')
    );

    const host = new URL(request.url).hostname;
    checks.push(
      host.includes('jaxtrilabsacademy.com')
        ? check('ok', 'Production domain', `Running on ${host}.`)
        : check('warn', 'Production domain', `Current host is ${host}. Use jaxtrilabsacademy.com for production verification.`)
    );

    const pendingApps = await safeFirst(env, "SELECT COUNT(*) AS count FROM applications WHERE status = 'pending' AND archived_at IS NULL", [], 'applications');
    checks.push(
      Number(pendingApps?.count || 0) > 0
        ? check('warn', 'Pending applications', `${pendingApps.count} application${Number(pendingApps.count) === 1 ? '' : 's'} waiting for review.`)
        : check('ok', 'Pending applications', 'No pending applications are blocking launch.')
    );

    const requestedPayouts = await safeFirst(env, "SELECT COUNT(*) AS count FROM payout_requests WHERE status = 'requested'", [], 'payout_requests');
    checks.push(
      Number(requestedPayouts?.count || 0) > 0
        ? check('warn', 'Payout queue', `${requestedPayouts.count} payout request${Number(requestedPayouts.count) === 1 ? '' : 's'} waiting.`)
        : check('ok', 'Payout queue', 'No requested payouts are waiting.')
    );

    const webhookErrors = await safeFirst(env, "SELECT COUNT(*) AS count FROM affiliate_webhook_events WHERE status = 'error'", [], 'affiliate_webhook_events');
    checks.push(
      Number(webhookErrors?.count || 0) > 0
        ? check('error', 'Webhook errors', `${webhookErrors.count} WooCommerce webhook error${Number(webhookErrors.count) === 1 ? '' : 's'} found.`)
        : check('ok', 'Webhook errors', 'No WooCommerce webhook errors found.')
    );

    const missingCodes = await safeFirst(env, `
      SELECT COUNT(*) AS count
      FROM users u
      LEFT JOIN affiliate_codes ac ON ac.user_id = u.id AND ac.status = 'active'
      WHERE u.status = 'active' AND u.role IN ('owner','manager','affiliate') AND ac.id IS NULL
    `, [], 'users');

    checks.push(
      Number(missingCodes?.count || 0) > 0
        ? check('warn', 'Affiliate codes', `${missingCodes.count} active profile${Number(missingCodes.count) === 1 ? '' : 's'} missing an active affiliate code.`)
        : check('ok', 'Affiliate codes', 'Active profiles have affiliate codes.')
    );

    const missingCommission = await safeFirst(env, `
      SELECT COUNT(*) AS count
      FROM users
      WHERE status = 'active'
        AND role IN ('owner','manager','affiliate')
        AND (commission_percentage IS NULL OR commission_percentage = '')
    `, [], 'users');

    checks.push(
      Number(missingCommission?.count || 0) > 0
        ? check('warn', 'Commission rates', `${missingCommission.count} active profile${Number(missingCommission.count) === 1 ? '' : 's'} missing a commission percentage.`)
        : check('ok', 'Commission rates', 'Active profiles have commission rates.')
    );

    const storedBankDetails = await safeFirst(env, `
      SELECT COUNT(*) AS count
      FROM affiliate_payout_profiles
      WHERE lower(COALESCE(payout_method,'')) LIKE '%bank%'
         OR lower(COALESCE(payout_notes,'')) LIKE '%routing%'
         OR lower(COALESCE(payout_notes,'')) LIKE '%account #%'
    `, [], 'affiliate_payout_profiles');

    checks.push(
      Number(storedBankDetails?.count || 0) > 0
        ? check('warn', 'Bank payout details', `${storedBankDetails.count} payout profile${Number(storedBankDetails.count) === 1 ? '' : 's'} may contain bank details. Review who can access payout pages before launch.`)
        : check('ok', 'Bank payout details', 'No bank detail warning found in payout profiles.')
    );

    const pushSubs = await safeFirst(env, "SELECT COUNT(*) AS count FROM push_subscriptions WHERE status = 'active'", [], 'push_subscriptions');
    checks.push(
      Number(pushSubs?.count || 0) > 0
        ? check('ok', 'Push subscriptions', `${pushSubs.count} active push subscription${Number(pushSubs.count) === 1 ? '' : 's'} saved.`)
        : check('warn', 'Push subscriptions', 'No active push subscriptions yet. Users can enable notifications after launch.')
    );

    return json({ ok: true, checks, database });
  } catch (error) {
    return json({ error: error?.message || 'Could not run production checks.' }, 500);
  }
}
