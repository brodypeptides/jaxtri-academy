import { json, getUserFromRequest } from '../lib/auth.js';

function clean(value) {
  return String(value ?? '').trim();
}

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

async function requireSetup(env) {
  const missing = [];
  for (const table of ['affiliate_sales', 'affiliate_codes', 'affiliate_payout_profiles', 'payout_requests', 'payout_request_sales']) {
    if (!(await tableExists(env, table))) missing.push(table);
  }
  return missing;
}

async function getFullUser(env, id) {
  return await env.DB.prepare(`
    SELECT id, full_name, email, username, role, status, commission_percentage
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
}

async function getProfile(env, user) {
  const profile = await env.DB.prepare(`
    SELECT user_id, payout_method, payout_email, payout_notes, updated_at
    FROM affiliate_payout_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(user.id).first();

  return profile || {
    user_id: user.id,
    payout_method: 'PayPal',
    payout_email: user.email || '',
    payout_notes: '',
    updated_at: null,
  };
}

async function getActiveCode(env, userId) {
  return await env.DB.prepare(`
    SELECT code, status
    FROM affiliate_codes
    WHERE user_id = ? AND status = 'active'
    ORDER BY id DESC
    LIMIT 1
  `).bind(userId).first();
}

async function getSales(env, userId) {
  const result = await env.DB.prepare(`
    SELECT
      s.id,
      s.affiliate_code,
      s.source,
      s.external_order_id,
      s.customer_email,
      s.gross_amount,
      s.currency,
      s.commission_percentage,
      s.commission_amount,
      s.status,
      s.notes,
      s.created_at,
      s.updated_at,
      s.status_updated_at,
      pr.id AS payout_request_id,
      pr.status AS payout_request_status
    FROM affiliate_sales s
    LEFT JOIN payout_request_sales prs ON prs.sale_id = s.id
    LEFT JOIN payout_requests pr ON pr.id = prs.payout_request_id AND pr.status IN ('requested','paid')
    WHERE s.affiliate_user_id = ?
    ORDER BY datetime(s.created_at) DESC, s.id DESC
    LIMIT 150
  `).bind(userId).all();
  return result.results || [];
}

async function getRequests(env, userId) {
  const result = await env.DB.prepare(`
    SELECT
      pr.*,
      COUNT(prs.sale_id) AS sale_count
    FROM payout_requests pr
    LEFT JOIN payout_request_sales prs ON prs.payout_request_id = pr.id
    WHERE pr.affiliate_user_id = ?
    GROUP BY pr.id
    ORDER BY datetime(pr.requested_at) DESC, pr.id DESC
    LIMIT 100
  `).bind(userId).all();
  return result.results || [];
}

function summarize(sales, requests) {
  const totals = {
    pending_commission: 0,
    approved_commission: 0,
    approved_available_commission: 0,
    requested_commission: 0,
    paid_commission: 0,
    voided_commission: 0,
    total_commission: 0,
  };

  const counts = { pending: 0, approved: 0, paid: 0, voided: 0, available: 0 };
  const requestableSales = [];

  for (const sale of sales) {
    const status = sale.status || 'pending';
    const amount = money(sale.commission_amount || 0);
    counts[status] = Number(counts[status] || 0) + 1;

    if (status === 'pending') totals.pending_commission = money(totals.pending_commission + amount);
    if (status === 'approved') totals.approved_commission = money(totals.approved_commission + amount);
    if (status === 'paid') totals.paid_commission = money(totals.paid_commission + amount);
    if (status === 'voided') totals.voided_commission = money(totals.voided_commission + amount);
    if (status !== 'voided') totals.total_commission = money(totals.total_commission + amount);

    const locked = ['requested', 'paid'].includes(clean(sale.payout_request_status).toLowerCase());
    if (status === 'approved' && !locked) {
      requestableSales.push(sale);
      counts.available += 1;
      totals.approved_available_commission = money(totals.approved_available_commission + amount);
    }
  }

  const requestCounts = { requested: 0, paid: 0, rejected: 0, cancelled: 0 };
  for (const request of requests) {
    const requestStatus = clean(request.status).toLowerCase() || 'requested';
    requestCounts[requestStatus] = Number(requestCounts[requestStatus] || 0) + 1;
    if (requestStatus === 'requested') totals.requested_commission = money(totals.requested_commission + Number(request.amount_requested || 0));
  }

  return {
    ...totals,
    unpaid_commission: money(totals.pending_commission + totals.approved_commission),
    total_sales: sales.length,
    counts,
    request_counts: requestCounts,
    requestable_sale_count: requestableSales.length,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const authUser = await getUserFromRequest(env, request);
    if (!authUser || authUser.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const missing = await requireSetup(env);
    if (missing.length) {
      return json({ error: `Payout system is not set up yet. Missing: ${missing.join(', ')}`, setup_required: true }, 400);
    }

    const user = await getFullUser(env, authUser.id);
    const [profile, code, sales, requests] = await Promise.all([
      getProfile(env, user),
      getActiveCode(env, user.id),
      getSales(env, user.id),
      getRequests(env, user.id),
    ]);

    const stats = summarize(sales, requests);
    const requestable_sales = sales.filter((sale) => sale.status === 'approved' && !['requested', 'paid'].includes(clean(sale.payout_request_status).toLowerCase()));

    return json({ user, profile, code, sales, requests, requestable_sales, stats });
  } catch (error) {
    return json({ error: error?.message || 'Could not load affiliate payout data.' }, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const missing = await requireSetup(env);
    if (missing.length) return json({ error: `Payout system is not set up yet. Missing: ${missing.join(', ')}` }, 400);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const payoutMethod = clean(body.payout_method || 'PayPal').slice(0, 60) || 'PayPal';
    const payoutEmail = clean(body.payout_email).toLowerCase().slice(0, 180) || null;
    const payoutNotes = clean(body.payout_notes).slice(0, 800) || null;

    await env.DB.prepare(`
      INSERT INTO affiliate_payout_profiles (user_id, payout_method, payout_email, payout_notes, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        payout_method = excluded.payout_method,
        payout_email = excluded.payout_email,
        payout_notes = excluded.payout_notes,
        updated_at = datetime('now')
    `).bind(user.id, payoutMethod, payoutEmail, payoutNotes).run();

    return json({ ok: true, profile: await getProfile(env, user) });
  } catch (error) {
    return json({ error: error?.message || 'Could not save payout profile.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const authUser = await getUserFromRequest(env, request);
    if (!authUser || authUser.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const missing = await requireSetup(env);
    if (missing.length) return json({ error: `Payout system is not set up yet. Missing: ${missing.join(', ')}` }, 400);

    const body = await request.json().catch(() => ({}));
    const fullUser = await getFullUser(env, authUser.id);
    const currentProfile = await getProfile(env, fullUser);

    const payoutMethod = clean(body.payout_method || currentProfile.payout_method || 'PayPal').slice(0, 60) || 'PayPal';
    const payoutEmail = clean(body.payout_email || currentProfile.payout_email).toLowerCase().slice(0, 180) || null;
    const requestNote = clean(body.request_note).slice(0, 800) || null;

    if (!payoutEmail) return json({ error: 'Add your payout email before requesting payout.' }, 400);

    const sales = await getSales(env, authUser.id);
    const requestable = sales.filter((sale) => sale.status === 'approved' && !['requested', 'paid'].includes(clean(sale.payout_request_status).toLowerCase()));

    if (!requestable.length) return json({ error: 'No approved unpaid commissions are available to request yet.' }, 400);

    const amount = money(requestable.reduce((sum, sale) => sum + Number(sale.commission_amount || 0), 0));
    const currency = clean(requestable[0]?.currency || 'USD').toUpperCase().slice(0, 8) || 'USD';

    const result = await env.DB.prepare(`
      INSERT INTO payout_requests
        (affiliate_user_id, amount_requested, currency, status, payout_method, payout_email, request_note)
      VALUES
        (?, ?, ?, 'requested', ?, ?, ?)
    `).bind(authUser.id, amount, currency, payoutMethod, payoutEmail, requestNote).run();

    const requestId = result.meta?.last_row_id;
    for (const sale of requestable) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO payout_request_sales (payout_request_id, sale_id)
        VALUES (?, ?)
      `).bind(requestId, sale.id).run();
    }

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'request_payout', ?)
      `).bind(authUser.id, authUser.id, JSON.stringify({ payout_request_id: requestId, amount, sale_ids: requestable.map((s) => s.id) })).run();
    } catch {}

    return json({ ok: true, payout_request_id: requestId, amount_requested: amount, sale_count: requestable.length });
  } catch (error) {
    return json({ error: error?.message || 'Could not request payout.' }, 500);
  }
}
