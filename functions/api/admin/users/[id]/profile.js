import { json, getUserFromRequest } from '../../../../lib/auth.js';

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

function clean(value) {
  return String(value ?? '').trim();
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function minutesSince(value) {
  if (!value) return Infinity;
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  const time = date.getTime();
  if (!Number.isFinite(time)) return Infinity;
  return (Date.now() - time) / 60000;
}

function presenceState(lastSeenAt) {
  const minutes = minutesSince(lastSeenAt);
  if (minutes <= 2) return 'online';
  if (minutes <= 15) return 'away';
  return 'offline';
}

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .bind(name)
    .first();
  return Boolean(row);
}

async function columnExists(env, table, column) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (result.results || []).some((row) => row.name === column);
  } catch {
    return false;
  }
}

async function getProfileUser(env, id) {
  const hasCommission = await columnExists(env, 'users', 'commission_percentage');
  const hasCodes = await tableExists(env, 'affiliate_codes');
  const commissionSelect = hasCommission ? ', u.commission_percentage' : ', NULL AS commission_percentage';
  const codeSelect = hasCodes ? ', ac.id AS affiliate_code_id, ac.code AS affiliate_code, ac.status AS affiliate_code_status' : ', NULL AS affiliate_code_id, NULL AS affiliate_code, NULL AS affiliate_code_status';
  const codeJoin = hasCodes ? `
    LEFT JOIN affiliate_codes ac ON ac.id = (
      SELECT id
      FROM affiliate_codes
      WHERE user_id = u.id AND status = 'active'
      ORDER BY id DESC
      LIMIT 1
    )
  ` : '';

  const user = await env.DB.prepare(`
    SELECT u.id, u.full_name, u.email, u.username, u.role, u.company_title, u.status, u.created_at, u.updated_at${commissionSelect}${codeSelect}
    FROM users u
    ${codeJoin}
    WHERE u.id = ?
    LIMIT 1
  `).bind(id).first();

  if (!user) return null;

  if (await tableExists(env, 'user_presence')) {
    const presence = await env.DB.prepare('SELECT last_seen_at FROM user_presence WHERE user_id = ? LIMIT 1').bind(id).first();
    user.last_seen_at = presence?.last_seen_at || null;
    user.presence = presenceState(user.last_seen_at);
  } else {
    user.last_seen_at = null;
    user.presence = 'offline';
  }

  if (await tableExists(env, 'sessions')) {
    const sessionRow = await env.DB.prepare('SELECT COUNT(*) AS active_sessions FROM sessions WHERE user_id = ? AND expires_at > datetime(\'now\')').bind(id).first();
    user.active_sessions = Number(sessionRow?.active_sessions || 0);
  } else {
    user.active_sessions = 0;
  }

  return user;
}

function summarizeSales(sales) {
  const stats = {
    count: sales.length,
    pending: 0,
    approved: 0,
    paid: 0,
    voided: 0,
    pending_amount: 0,
    approved_amount: 0,
    paid_amount: 0,
    voided_amount: 0,
    gross_total: 0,
    commission_total: 0,
  };
  for (const sale of sales) {
    const status = clean(sale.status || 'pending').toLowerCase();
    const commission = money(sale.commission_amount || 0);
    const gross = money(sale.gross_amount || 0);
    stats[status] = Number(stats[status] || 0) + 1;
    stats[`${status}_amount`] = money(Number(stats[`${status}_amount`] || 0) + commission);
    if (status !== 'voided') {
      stats.gross_total = money(stats.gross_total + gross);
      stats.commission_total = money(stats.commission_total + commission);
    }
  }
  return stats;
}

function summarizePayouts(payouts) {
  const stats = { count: payouts.length, requested: 0, paid: 0, rejected: 0, cancelled: 0, requested_amount: 0, paid_amount: 0, rejected_amount: 0, cancelled_amount: 0 };
  for (const payout of payouts) {
    const status = clean(payout.status || 'requested').toLowerCase();
    const amount = money(payout.amount_requested || 0);
    stats[status] = Number(stats[status] || 0) + 1;
    stats[`${status}_amount`] = money(Number(stats[`${status}_amount`] || 0) + amount);
  }
  return stats;
}

async function getSales(env, userId) {
  if (!(await tableExists(env, 'affiliate_sales'))) return [];
  const result = await env.DB.prepare(`
    SELECT id, affiliate_code, source, external_order_id, customer_email, gross_amount, currency,
           commission_percentage, commission_amount, status, notes, created_at, updated_at, status_updated_at
    FROM affiliate_sales
    WHERE affiliate_user_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 100
  `).bind(userId).all();
  return result.results || [];
}

async function getPayouts(env, userId) {
  if (!(await tableExists(env, 'payout_requests'))) return [];
  const hasLinks = await tableExists(env, 'payout_request_sales');
  const join = hasLinks ? 'LEFT JOIN payout_request_sales prs ON prs.payout_request_id = pr.id' : '';
  const countSelect = hasLinks ? 'COUNT(prs.sale_id) AS sale_count' : '0 AS sale_count';
  const result = await env.DB.prepare(`
    SELECT pr.id, pr.amount_requested, pr.currency, pr.status, pr.payout_method, pr.payout_email,
           pr.request_note, pr.admin_note, pr.transaction_id, pr.proof_url, pr.requested_at,
           pr.reviewed_at, pr.paid_at, pr.updated_at, ${countSelect}
    FROM payout_requests pr
    ${join}
    WHERE pr.affiliate_user_id = ?
    GROUP BY pr.id
    ORDER BY datetime(pr.requested_at) DESC, pr.id DESC
    LIMIT 50
  `).bind(userId).all();
  return result.results || [];
}

async function getPayoutProfile(env, userId) {
  if (!(await tableExists(env, 'affiliate_payout_profiles'))) return null;
  return await env.DB.prepare(`
    SELECT user_id, payout_method, payout_email, updated_at
    FROM affiliate_payout_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();
}

async function getFeedPosts(env, userId) {
  if (!(await tableExists(env, 'feed_posts'))) return [];
  const result = await env.DB.prepare(`
    SELECT id, title, status, review_note, published_at, created_at, updated_at
    FROM feed_posts
    WHERE author_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 30
  `).bind(userId).all();
  return result.results || [];
}

async function getApplications(env, email) {
  if (!(await tableExists(env, 'applications'))) return [];
  const result = await env.DB.prepare(`
    SELECT id, full_name, email, status, review_note, reviewed_at, created_at, updated_at
    FROM applications
    WHERE lower(email) = lower(?)
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 10
  `).bind(email).all();
  return result.results || [];
}

async function getInvites(env, email) {
  if (!(await tableExists(env, 'invites'))) return [];
  const result = await env.DB.prepare(`
    SELECT id, email, role, status, expires_at, used_at, created_at
    FROM invites
    WHERE lower(email) = lower(?)
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 20
  `).bind(email).all();
  return result.results || [];
}

async function getAudit(env, userId) {
  if (!(await tableExists(env, 'admin_audit_log'))) return [];
  const result = await env.DB.prepare(`
    SELECT a.id, a.actor_id, a.target_user_id, a.action, a.details, a.created_at,
           actor.full_name AS actor_name, target.full_name AS target_name
    FROM admin_audit_log a
    LEFT JOIN users actor ON actor.id = a.actor_id
    LEFT JOIN users target ON target.id = a.target_user_id
    WHERE a.target_user_id = ? OR a.actor_id = ?
    ORDER BY datetime(a.created_at) DESC, a.id DESC
    LIMIT 40
  `).bind(userId, userId).all();
  return result.results || [];
}

async function getWebhookEvents(env, code) {
  if (!code || !(await tableExists(env, 'affiliate_webhook_events'))) return [];
  const result = await env.DB.prepare(`
    SELECT id, provider, event, external_order_id, affiliate_code, status, message, created_at
    FROM affiliate_webhook_events
    WHERE lower(coalesce(affiliate_code,'')) = lower(?)
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 30
  `).bind(code).all();
  return result.results || [];
}

export async function onRequestGet({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);

    const user = await getProfileUser(env, id);
    if (!user) return json({ error: 'User not found.' }, 404);

    const [sales, payouts, payout_profile, feed_posts, applications, invites, audit, webhook_events] = await Promise.all([
      getSales(env, id),
      getPayouts(env, id),
      getPayoutProfile(env, id),
      getFeedPosts(env, id),
      getApplications(env, user.email),
      getInvites(env, user.email),
      getAudit(env, id),
      getWebhookEvents(env, user.affiliate_code),
    ]);

    const feed_stats = {
      total: feed_posts.length,
      pending: feed_posts.filter((post) => post.status === 'pending').length,
      published: feed_posts.filter((post) => post.status === 'published').length,
      rejected: feed_posts.filter((post) => post.status === 'rejected').length,
      archived: feed_posts.filter((post) => post.status === 'archived').length,
    };

    return json({
      user,
      sales,
      sales_stats: summarizeSales(sales),
      payouts,
      payout_stats: summarizePayouts(payouts),
      payout_profile,
      feed_posts,
      feed_stats,
      applications,
      invites,
      audit,
      webhook_events,
      viewer: { role: actor.role, is_owner: actor.role === 'owner', is_manager: actor.role === 'manager' },
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load user profile.' }, 500);
  }
}
