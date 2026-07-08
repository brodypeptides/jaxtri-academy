import { json, getUserFromRequest } from '../lib/auth.js';

function money(value) { const n = Number(value || 0); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
function isStaff(user) { return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager'); }

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first();
  return Boolean(row);
}

async function safeFirst(env, sql, binds = [], tableName = null) {
  try {
    if (tableName && !(await tableExists(env, tableName))) return null;
    return await env.DB.prepare(sql).bind(...binds).first();
  } catch {
    return null;
  }
}

async function safeAll(env, sql, binds = [], tableName = null) {
  try {
    if (tableName && !(await tableExists(env, tableName))) return [];
    const result = await env.DB.prepare(sql).bind(...binds).all();
    return result.results || [];
  } catch {
    return [];
  }
}

function action(id, severity, title, body, href, category = 'General') {
  return { id, severity, title, body, href, category, source: 'live' };
}

async function staffActions(env) {
  const items = [];
  const pendingApplications = await safeFirst(env, "SELECT COUNT(*) AS count FROM applications WHERE status = 'pending' AND archived_at IS NULL", [], 'applications');
  if (Number(pendingApplications?.count || 0) > 0) items.push(action('pending-applications', 'high', 'Applications need review', `${pendingApplications.count} application${Number(pendingApplications.count) === 1 ? '' : 's'} waiting.`, 'owner-recruitment.html', 'People'));

  const payoutRequests = await safeFirst(env, "SELECT COUNT(*) AS count, COALESCE(SUM(amount_requested),0) AS amount FROM payout_requests WHERE status = 'requested'", [], 'payout_requests');
  if (Number(payoutRequests?.count || 0) > 0) items.push(action('payout-requests', 'high', 'Payout requests waiting', `${payoutRequests.count} request${Number(payoutRequests.count) === 1 ? '' : 's'} totaling $${money(payoutRequests.amount).toFixed(2)}.`, 'owner-payouts.html', 'Money'));

  const feedReview = await safeFirst(env, "SELECT COUNT(*) AS count FROM feed_posts WHERE status = 'pending'", [], 'feed_posts');
  if (Number(feedReview?.count || 0) > 0) items.push(action('feed-review', 'medium', 'Feed posts need review', `${feedReview.count} post${Number(feedReview.count) === 1 ? '' : 's'} pending approval.`, 'owner-feed-review.html', 'Community'));

  const pendingCommissions = await safeFirst(env, "SELECT COUNT(*) AS count, COALESCE(SUM(commission_amount),0) AS amount FROM affiliate_sales WHERE status = 'pending'", [], 'affiliate_sales');
  if (Number(pendingCommissions?.count || 0) > 0) items.push(action('pending-commissions', 'medium', 'Pending commissions', `${pendingCommissions.count} commission record${Number(pendingCommissions.count) === 1 ? '' : 's'} totaling $${money(pendingCommissions.amount).toFixed(2)} need review.`, 'owner-commissions.html', 'Money'));

  const webhookErrors = await safeFirst(env, "SELECT COUNT(*) AS count FROM affiliate_webhook_events WHERE status = 'error'", [], 'affiliate_webhook_events');
  if (Number(webhookErrors?.count || 0) > 0) items.push(action('webhook-errors', 'high', 'WooCommerce webhook errors', `${webhookErrors.count} webhook error${Number(webhookErrors.count) === 1 ? '' : 's'} found.`, 'owner-commissions.html', 'WooCommerce'));

  return items;
}

async function affiliateActions(env, user) {
  const items = [];
  const code = await safeFirst(env, "SELECT code FROM affiliate_codes WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [user.id], 'affiliate_codes');
  if (!code?.code) items.push(action('missing-code', 'medium', 'No affiliate code assigned yet', 'Ask leadership to assign your referral/coupon code.', 'my-affiliate.html', 'Earn'));

  const payoutProfile = await safeFirst(env, "SELECT payout_email, payout_notes FROM affiliate_payout_profiles WHERE user_id = ? LIMIT 1", [user.id], 'affiliate_payout_profiles');
  if (!payoutProfile?.payout_email && !payoutProfile?.payout_notes) items.push(action('missing-payout-profile', 'medium', 'Payout profile incomplete', 'Add your payout details before requesting payout.', 'my-affiliate.html', 'Money'));

  const approvedAvailable = await safeFirst(env, `
    SELECT COUNT(*) AS count, COALESCE(SUM(s.commission_amount),0) AS amount
    FROM affiliate_sales s
    LEFT JOIN payout_request_sales prs ON prs.sale_id = s.id
    LEFT JOIN payout_requests pr ON pr.id = prs.payout_request_id AND pr.status IN ('requested','paid')
    WHERE s.affiliate_user_id = ? AND s.status = 'approved' AND pr.id IS NULL
  `, [user.id], 'affiliate_sales');
  if (Number(approvedAvailable?.count || 0) > 0) items.push(action('available-payout', 'high', 'Commission ready to request', `${approvedAvailable.count} approved sale${Number(approvedAvailable.count) === 1 ? '' : 's'} totaling $${money(approvedAvailable.amount).toFixed(2)}.`, 'my-affiliate.html', 'Money'));

  const requested = await safeFirst(env, "SELECT COUNT(*) AS count, COALESCE(SUM(amount_requested),0) AS amount FROM payout_requests WHERE affiliate_user_id = ? AND status = 'requested'", [user.id], 'payout_requests');
  if (Number(requested?.count || 0) > 0) items.push(action('requested-payout', 'medium', 'Payout request in review', `${requested.count} request${Number(requested.count) === 1 ? '' : 's'} totaling $${money(requested.amount).toFixed(2)} awaiting payment.`, 'my-affiliate.html', 'Money'));

  const pendingSales = await safeFirst(env, "SELECT COUNT(*) AS count, COALESCE(SUM(commission_amount),0) AS amount FROM affiliate_sales WHERE affiliate_user_id = ? AND status = 'pending'", [user.id], 'affiliate_sales');
  if (Number(pendingSales?.count || 0) > 0) items.push(action('pending-sales', 'low', 'Commissions under review', `${pendingSales.count} pending sale${Number(pendingSales.count) === 1 ? '' : 's'} totaling $${money(pendingSales.amount).toFixed(2)}.`, 'my-affiliate.html', 'Earn'));

  const unreadDm = await safeFirst(env, "SELECT COUNT(*) AS count FROM direct_messages WHERE receiver_id = ? AND read_at IS NULL", [user.id], 'direct_messages');
  if (Number(unreadDm?.count || 0) > 0) items.push(action('unread-dm', 'medium', 'Unread team messages', `${unreadDm.count} direct message${Number(unreadDm.count) === 1 ? '' : 's'} unread.`, 'team.html', 'Team'));

  return items;
}

async function storedNotifications(env, user) {
  if (!(await tableExists(env, 'app_notifications'))) return [];
  const binds = [];
  let where = "status = 'unread' AND (audience_type = 'all'";
  if (isStaff(user)) where += " OR audience_type = 'staff'";
  where += " OR (audience_type = 'user' AND user_id = ?))";
  binds.push(user.id);

  const rows = await safeAll(env, `
    SELECT id, title, body, link_url AS href, audience_type, created_at, 'stored' AS source
    FROM app_notifications
    WHERE ${where}
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 50
  `, binds, 'app_notifications');

  return rows.map((row) => ({ ...row, severity: 'low', category: row.audience_type === 'staff' ? 'Staff' : 'Personal' }));
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const [liveItems, storedItems] = await Promise.all([
      isStaff(user) ? staffActions(env) : affiliateActions(env, user),
      storedNotifications(env, user),
    ]);

    const notifications = [...liveItems, ...storedItems];
    return json({ notifications, viewer: { role: user.role, is_staff: isStaff(user) }, counts: { total: notifications.length, high: notifications.filter((x) => x.severity === 'high').length } });
  } catch (error) {
    return json({ error: error?.message || 'Could not load notifications.' }, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);
    if (!(await tableExists(env, 'app_notifications'))) return json({ error: 'Notification table missing.' }, 400);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);
    const id = Number(body.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid notification ID.' }, 400);

    await env.DB.prepare(`
      UPDATE app_notifications
      SET status = 'read', read_at = datetime('now')
      WHERE id = ? AND (audience_type IN ('all','staff') OR user_id = ?)
    `).bind(id, user.id).run();

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not update notification.' }, 500);
  }
}
