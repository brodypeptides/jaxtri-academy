import { json, getUserFromRequest } from '../../lib/auth.js';

function clean(value) {
  return String(value ?? '').trim();
}

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .bind(name)
    .first();
  return Boolean(row);
}

async function requireSetup(env) {
  const missing = [];
  for (const table of ['payout_requests', 'payout_request_sales']) {
    if (!(await tableExists(env, table))) missing.push(table);
  }
  return missing;
}

export async function onRequestGet({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const missing = await requireSetup(env);
    if (missing.length) return json({ error: `Payout system is not set up yet. Missing: ${missing.join(', ')}`, setup_required: true }, 400);

    const url = new URL(request.url);
    const status = clean(url.searchParams.get('status')).toLowerCase();
    const q = clean(url.searchParams.get('q')).toLowerCase();

    let sql = `
      SELECT
        pr.*,
        u.full_name AS affiliate_name,
        u.email AS affiliate_email,
        u.username AS affiliate_username,
        u.role AS affiliate_role,
        reviewer.full_name AS reviewed_by_name,
        payer.full_name AS paid_by_name,
        COUNT(prs.sale_id) AS sale_count
      FROM payout_requests pr
      JOIN users u ON u.id = pr.affiliate_user_id
      LEFT JOIN users reviewer ON reviewer.id = pr.reviewed_by
      LEFT JOIN users payer ON payer.id = pr.paid_by
      LEFT JOIN payout_request_sales prs ON prs.payout_request_id = pr.id
    `;

    const where = [];
    const binds = [];

    if (status && status !== 'all') {
      where.push('pr.status = ?');
      binds.push(status);
    }

    if (q) {
      where.push(`(
        lower(u.full_name) LIKE ? OR lower(u.email) LIKE ? OR lower(u.username) LIKE ? OR
        lower(coalesce(pr.payout_email,'')) LIKE ? OR lower(coalesce(pr.transaction_id,'')) LIKE ?
      )`);
      const like = `%${q}%`;
      binds.push(like, like, like, like, like);
    }

    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` GROUP BY pr.id ORDER BY datetime(pr.requested_at) DESC, pr.id DESC LIMIT 250`;

    const result = await env.DB.prepare(sql).bind(...binds).all();
    const requests = result.results || [];

    const summary = { requested: 0, paid: 0, rejected: 0, cancelled: 0, requested_amount: 0, paid_amount: 0 };
    for (const row of requests) {
      summary[row.status] = Number(summary[row.status] || 0) + 1;
      if (row.status === 'requested') summary.requested_amount += Number(row.amount_requested || 0);
      if (row.status === 'paid') summary.paid_amount += Number(row.amount_requested || 0);
    }
    summary.requested_amount = Math.round(summary.requested_amount * 100) / 100;
    summary.paid_amount = Math.round(summary.paid_amount * 100) / 100;

    return json({ requests, summary, viewer: { role: actor.role, is_owner: actor.role === 'owner', is_manager: actor.role === 'manager' } });
  } catch (error) {
    return json({ error: error?.message || 'Could not load payout requests.' }, 500);
  }
}
