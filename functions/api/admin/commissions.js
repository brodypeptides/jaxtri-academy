import { json, getUserFromRequest } from '../../lib/auth.js';

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

function isOwner(user) {
  return user && user.status === 'active' && user.role === 'owner';
}

function clean(value) {
  return String(value || '').trim();
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

async function columnExists(env, table, column) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (result.results || []).some((row) => row.name === column);
  } catch {
    return false;
  }
}

function summarize(sales) {
  const statusTotals = { pending: 0, approved: 0, paid: 0, voided: 0 };
  const statusCounts = { pending: 0, approved: 0, paid: 0, voided: 0 };
  let gross = 0;
  let commission = 0;
  for (const sale of sales) {
    const status = sale.status || 'pending';
    statusCounts[status] = Number(statusCounts[status] || 0) + 1;
    statusTotals[status] = money(Number(statusTotals[status] || 0) + Number(sale.commission_amount || 0));
    if (status !== 'voided') {
      gross = money(gross + Number(sale.gross_amount || 0));
      commission = money(commission + Number(sale.commission_amount || 0));
    }
  }
  return {
    total_sales: sales.length,
    gross_total: gross,
    commission_total: commission,
    pending_commission: statusTotals.pending,
    approved_commission: statusTotals.approved,
    paid_commission: statusTotals.paid,
    voided_commission: statusTotals.voided,
    counts: statusCounts,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const ready = await tableExists(env, 'affiliate_sales');
    if (!ready) {
      return json({
        error: 'Sprint 6A commission tables are missing. Run database/sprint6a-commission-dashboard.sql in D1 first.',
        setup_required: true,
      }, 400);
    }

    const url = new URL(request.url);
    const status = clean(url.searchParams.get('status')).toLowerCase();
    const affiliateId = Number(url.searchParams.get('affiliate_user_id') || 0);
    const q = clean(url.searchParams.get('q')).toLowerCase();

    let sql = `
      SELECT
        s.id,
        s.affiliate_user_id,
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
        u.full_name AS affiliate_name,
        u.email AS affiliate_email,
        u.username AS affiliate_username,
        u.role AS affiliate_role
      FROM affiliate_sales s
      JOIN users u ON u.id = s.affiliate_user_id
    `;
    const where = [];
    const binds = [];
    if (status && status !== 'all') {
      where.push('s.status = ?');
      binds.push(status);
    }
    if (Number.isFinite(affiliateId) && affiliateId > 0) {
      where.push('s.affiliate_user_id = ?');
      binds.push(affiliateId);
    }
    if (q) {
      where.push(`(
        lower(u.full_name) LIKE ? OR lower(u.email) LIKE ? OR lower(u.username) LIKE ? OR
        lower(coalesce(s.external_order_id,'')) LIKE ? OR lower(coalesce(s.customer_email,'')) LIKE ? OR lower(coalesce(s.affiliate_code,'')) LIKE ?
      )`);
      const like = `%${q}%`;
      binds.push(like, like, like, like, like, like);
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ' ORDER BY datetime(s.created_at) DESC, s.id DESC LIMIT 250';

    const result = await env.DB.prepare(sql).bind(...binds).all();
    const sales = result.results || [];

    const codeReady = await tableExists(env, 'affiliate_codes');
    const hasCommission = await columnExists(env, 'users', 'commission_percentage');
    const codeJoin = codeReady ? `
      LEFT JOIN affiliate_codes ac ON ac.id = (
        SELECT id
        FROM affiliate_codes
        WHERE user_id = users.id AND status = 'active'
        ORDER BY id DESC
        LIMIT 1
      )
    ` : '';
    const codeSelect = codeReady ? ', ac.code AS affiliate_code' : ', NULL AS affiliate_code';
    const commissionSelect = hasCommission ? ', users.commission_percentage' : ', NULL AS commission_percentage';

    const affiliatesResult = await env.DB.prepare(`
      SELECT users.id, users.full_name, users.email, users.username, users.role, users.status${commissionSelect}${codeSelect}
      FROM users
      ${codeJoin}
      WHERE users.role IN ('owner','affiliate','manager')
      ORDER BY CASE users.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, lower(users.full_name)
    `).all();

    return json({
      sales,
      affiliates: affiliatesResult.results || [],
      stats: summarize(sales),
      viewer: { role: actor.role, is_owner: actor.role === 'owner' },
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load commissions.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const ready = await tableExists(env, 'affiliate_sales');
    if (!ready) {
      return json({ error: 'Sprint 6A commission tables are missing. Run database/sprint6a-commission-dashboard.sql in D1 first.' }, 400);
    }

    const hasCommission = await columnExists(env, 'users', 'commission_percentage');
    if (!hasCommission) return json({ error: 'Commission percentage column missing. Run Sprint 5.1 migration first.' }, 400);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const affiliateUserId = Number(body.affiliate_user_id);
    const grossAmount = money(body.gross_amount);
    const currency = clean(body.currency || 'USD').toUpperCase().slice(0, 8) || 'USD';
    const source = clean(body.source || 'manual').toLowerCase() || 'manual';
    const externalOrderId = clean(body.external_order_id).slice(0, 120) || null;
    const customerEmail = clean(body.customer_email).toLowerCase().slice(0, 180) || null;
    const notes = clean(body.notes).slice(0, 1000) || null;

    if (!Number.isFinite(affiliateUserId) || affiliateUserId < 1) return json({ error: 'Choose an affiliate.' }, 400);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) return json({ error: 'Gross amount must be greater than 0.' }, 400);
    if (!['manual', 'wordpress', 'webhook', 'import'].includes(source)) return json({ error: 'Invalid sale source.' }, 400);

    const affiliate = await env.DB.prepare(`
      SELECT id, full_name, email, username, role, status, commission_percentage
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(affiliateUserId).first();

    if (!affiliate) return json({ error: 'Affiliate user not found.' }, 404);
    if (!['owner', 'affiliate', 'manager'].includes(affiliate.role)) return json({ error: 'Sales can only be assigned to owner, affiliate, or manager profiles.' }, 400);
    if (affiliate.role === 'owner' && !isOwner(actor)) return json({ error: 'Only owners can assign sales to owner profiles.' }, 403);
    if (affiliate.status !== 'active') return json({ error: 'Sales can only be assigned to active users.' }, 400);

    let rate = affiliate.commission_percentage;
    if (Object.prototype.hasOwnProperty.call(body, 'commission_percentage') && body.commission_percentage !== '' && body.commission_percentage !== null) {
      if (actor.role !== 'owner') return json({ error: 'Only owners can override commission percentage per sale.' }, 403);
      rate = Number(body.commission_percentage);
    }

    rate = Number(rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return json({ error: 'This user needs a valid commission percentage before a sale can be entered.' }, 400);
    }

    const codeRow = await tableExists(env, 'affiliate_codes')
      ? await env.DB.prepare("SELECT code FROM affiliate_codes WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").bind(affiliateUserId).first()
      : null;
    const affiliateCode = clean(body.affiliate_code || codeRow?.code).slice(0, 60) || null;
    const commissionAmount = money(grossAmount * rate / 100);

    const result = await env.DB.prepare(`
      INSERT INTO affiliate_sales
        (affiliate_user_id, affiliate_code, source, external_order_id, customer_email, gross_amount, currency, commission_percentage, commission_amount, status, notes, created_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      affiliateUserId,
      affiliateCode,
      source,
      externalOrderId,
      customerEmail,
      grossAmount,
      currency,
      rate,
      commissionAmount,
      notes,
      actor.id
    ).run();

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'create_manual_sale', ?)
      `).bind(actor.id, affiliateUserId, JSON.stringify({ sale_id: result.meta?.last_row_id || null, grossAmount, rate, commissionAmount })).run();
    } catch {}

    return json({ ok: true, sale_id: result.meta?.last_row_id || null, commission_amount: commissionAmount });
  } catch (error) {
    return json({ error: error?.message || 'Could not create sale.' }, 500);
  }
}
