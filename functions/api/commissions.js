import { json, getUserFromRequest } from '../lib/auth.js';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .bind(name)
    .first();
  return Boolean(row);
}

function summarize(sales) {
  const totals = { pending: 0, approved: 0, paid: 0, voided: 0 };
  const counts = { pending: 0, approved: 0, paid: 0, voided: 0 };
  for (const sale of sales) {
    const status = sale.status || 'pending';
    counts[status] = Number(counts[status] || 0) + 1;
    totals[status] = money(Number(totals[status] || 0) + Number(sale.commission_amount || 0));
  }
  return {
    total_sales: sales.length,
    pending_commission: totals.pending,
    approved_commission: totals.approved,
    paid_commission: totals.paid,
    voided_commission: totals.voided,
    counts,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    if (!(await tableExists(env, 'affiliate_sales'))) {
      return json({ error: 'Commission dashboard is not set up yet.', setup_required: true }, 400);
    }

    const salesResult = await env.DB.prepare(`
      SELECT
        id,
        affiliate_code,
        source,
        external_order_id,
        gross_amount,
        currency,
        commission_percentage,
        commission_amount,
        status,
        created_at,
        updated_at,
        status_updated_at
      FROM affiliate_sales
      WHERE affiliate_user_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 100
    `).bind(user.id).all();

    const sales = salesResult.results || [];
    const code = (await tableExists(env, 'affiliate_codes'))
      ? await env.DB.prepare("SELECT code, status FROM affiliate_codes WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").bind(user.id).first()
      : null;

    return json({ sales, code, stats: summarize(sales), user });
  } catch (error) {
    return json({ error: error?.message || 'Could not load commissions.' }, 500);
  }
}
