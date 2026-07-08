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

export async function onRequestGet({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const ready = await tableExists(env, 'affiliate_webhook_events');
    if (!ready) {
      return json({
        error: 'Webhook event table is missing. Run database/sprint6g-webhook-events.sql in D1 first.',
        setup_required: true,
        events: [],
        summary: {},
      }, 400);
    }

    const url = new URL(request.url);
    const status = clean(url.searchParams.get('status')).toLowerCase();
    const q = clean(url.searchParams.get('q')).toLowerCase();

    let sql = `
      SELECT id, provider, event, external_order_id, affiliate_code, status, message, payload, created_at
      FROM affiliate_webhook_events
    `;
    const where = [];
    const binds = [];

    if (status && status !== 'all') {
      where.push('status = ?');
      binds.push(status);
    }

    if (q) {
      where.push(`(
        lower(coalesce(provider,'')) LIKE ? OR lower(coalesce(event,'')) LIKE ? OR
        lower(coalesce(external_order_id,'')) LIKE ? OR lower(coalesce(affiliate_code,'')) LIKE ? OR
        lower(coalesce(message,'')) LIKE ?
      )`);
      const like = `%${q}%`;
      binds.push(like, like, like, like, like);
    }

    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ' ORDER BY datetime(created_at) DESC, id DESC LIMIT 150';

    const result = await env.DB.prepare(sql).bind(...binds).all();
    const events = result.results || [];

    const summaryRows = await env.DB.prepare(`
      SELECT status, COUNT(*) AS count
      FROM affiliate_webhook_events
      GROUP BY status
    `).all();
    const summary = { total: 0, received: 0, processed: 0, ignored: 0, error: 0 };
    for (const row of summaryRows.results || []) {
      summary[row.status] = Number(row.count || 0);
      summary.total += Number(row.count || 0);
    }

    return json({ events, summary, viewer: { role: actor.role } });
  } catch (error) {
    return json({ error: error?.message || 'Could not load webhook events.' }, 500);
  }
}
