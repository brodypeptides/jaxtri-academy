import { json } from '../../lib/auth.js';

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

async function logEvent(env, data) {
  try {
    if (!(await tableExists(env, 'affiliate_webhook_events'))) return;
    await env.DB.prepare(`
      INSERT INTO affiliate_webhook_events
        (provider, event, external_order_id, affiliate_code, payload, status, message)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      clean(data.provider || 'woocommerce'),
      clean(data.event || ''),
      clean(data.external_order_id || data.order_id || ''),
      clean(data.affiliate_code || ''),
      JSON.stringify(data.payload || data).slice(0, 10000),
      clean(data.status || 'received'),
      clean(data.message || '').slice(0, 1000)
    ).run();
  } catch {}
}

function classifySaleStatus(payload) {
  const event = clean(payload.event).toLowerCase();
  const orderStatus = clean(payload.order_status || payload.status).toLowerCase();

  if (event.includes('refund') || ['refunded', 'cancelled', 'canceled', 'failed'].includes(orderStatus)) {
    return 'voided';
  }

  if (['processing', 'completed'].includes(orderStatus)) {
    return 'pending';
  }

  return 'ignored';
}

async function findAffiliateByCode(env, code) {
  return await env.DB.prepare(`
    SELECT
      ac.code,
      ac.user_id,
      ac.status AS code_status,
      u.full_name,
      u.email,
      u.username,
      u.role,
      u.status AS user_status,
      u.commission_percentage
    FROM affiliate_codes ac
    JOIN users u ON u.id = ac.user_id
    WHERE lower(ac.code) = lower(?)
      AND ac.status = 'active'
    LIMIT 1
  `).bind(code).first();
}

async function getExistingSale(env, externalOrderId) {
  return await env.DB.prepare(`
    SELECT *
    FROM affiliate_sales
    WHERE source = 'wordpress'
      AND external_order_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).bind(externalOrderId).first();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.includes(',')) return value.split(',');
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function uniqueCodes(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const code = clean(value).slice(0, 80);
    const key = code.toLowerCase();
    if (!code || seen.has(key)) continue;
    seen.add(key);
    out.push(code);
  }
  return out;
}

function getCandidateCodes(payload) {
  const couponCodes = uniqueCodes(asArray(payload.coupon_codes));
  const referralCode = clean(payload.referral_code || payload.ref || payload.referral_cookie || '').slice(0, 80);
  const explicitCandidates = uniqueCodes(asArray(payload.affiliate_code_candidates));
  const legacyCode = clean(payload.affiliate_code || payload.referral_code || payload.ref || payload.referral_code).slice(0, 80);
  return uniqueCodes([...explicitCandidates, ...couponCodes, referralCode, legacyCode]);
}

function attributionFor(selectedCode, payload) {
  const selected = clean(selectedCode).toLowerCase();
  const couponCodes = uniqueCodes(asArray(payload.coupon_codes)).map((x) => x.toLowerCase());
  const referralCode = clean(payload.referral_code || payload.ref || payload.referral_cookie || '').toLowerCase();
  if (selected && couponCodes.includes(selected)) return 'coupon_code';
  if (selected && referralCode && selected === referralCode) return 'referral_link';
  return clean(payload.attribution_source || payload.source_detail || 'unknown') || 'unknown';
}

async function findFirstMatchingAffiliate(env, codes) {
  for (const code of codes) {
    const affiliate = await findAffiliateByCode(env, code);
    if (affiliate) return { affiliate, code };
  }
  return { affiliate: null, code: '' };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-jaxtri-secret',
    },
  });
}


export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: 'Jaxtri WooCommerce webhook',
    status: 'active',
    method: 'POST required',
    message: 'This endpoint is active. WooCommerce should send POST requests here. Opening this URL in a browser only runs this health check.',
  });
}

export async function onRequestPost({ request, env }) {
  let payload = null;

  try {
    const expectedSecret = clean(env.JAXTRI_WC_WEBHOOK_SECRET);
    if (!expectedSecret) {
      return json({ error: 'WooCommerce webhook secret is not configured in Cloudflare Pages.' }, 500);
    }

    const receivedSecret = clean(request.headers.get('x-jaxtri-secret'));
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      return json({ error: 'Unauthorized webhook.' }, 401);
    }

    if (!(await tableExists(env, 'affiliate_sales')) || !(await tableExists(env, 'affiliate_codes'))) {
      return json({ error: 'Commission tables are missing. Run the production database migration first.' }, 400);
    }

    payload = await request.json().catch(() => null);
    if (!payload) return json({ error: 'Invalid JSON payload.' }, 400);

    const provider = clean(payload.provider || 'woocommerce').toLowerCase();
    if (provider !== 'woocommerce') {
      await logEvent(env, { ...payload, status: 'ignored', message: 'Unsupported provider.', payload });
      return json({ ok: true, ignored: true, reason: 'Unsupported provider.' });
    }

    if (clean(payload.event).toLowerCase() === 'verification') {
      await logEvent(env, { ...payload, status: 'processed', message: 'Verification webhook received.', payload });
      return json({ ok: true, verification: true, message: 'Jaxtri WooCommerce webhook is reachable.' });
    }

    const candidateCodes = getCandidateCodes(payload);
    const rawOrderId = clean(payload.order_id || payload.order_number || payload.external_order_id).slice(0, 120);
    const externalOrderId = rawOrderId ? `wc:${rawOrderId}` : '';
    const saleStatus = classifySaleStatus(payload);
    const grossAmount = money(payload.gross_amount ?? payload.total ?? payload.order_total);
    const currency = clean(payload.currency || 'USD').toUpperCase().slice(0, 8) || 'USD';
    const customerEmail = clean(payload.customer_email || payload.billing_email).toLowerCase().slice(0, 180) || null;

    if (!candidateCodes.length) {
      await logEvent(env, { ...payload, status: 'ignored', message: 'No referral link or checkout coupon code was attached to this order.', payload });
      return json({ ok: true, ignored: true, reason: 'No referral link or coupon code.' });
    }

    if (!externalOrderId) {
      await logEvent(env, { ...payload, affiliate_code: candidateCodes.join(','), status: 'error', message: 'Missing WooCommerce order ID.', payload });
      return json({ error: 'Missing WooCommerce order ID.' }, 400);
    }

    if (saleStatus === 'ignored') {
      await logEvent(env, { ...payload, affiliate_code: candidateCodes.join(','), external_order_id: externalOrderId, status: 'ignored', message: `Order status ignored: ${clean(payload.order_status || payload.status)}`, payload });
      return json({ ok: true, ignored: true, reason: 'Order status not commissionable yet.' });
    }

    const match = await findFirstMatchingAffiliate(env, candidateCodes);
    const affiliate = match.affiliate;
    const affiliateCode = match.code;
    const attributionSource = attributionFor(affiliateCode, payload);
    const couponCodes = uniqueCodes(asArray(payload.coupon_codes));
    const referralCode = clean(payload.referral_code || payload.ref || payload.referral_cookie || '').slice(0, 80);

    if (!affiliate) {
      await logEvent(env, { ...payload, affiliate_code: candidateCodes.join(','), external_order_id: externalOrderId, status: 'ignored', message: `No active affiliate matched these codes: ${candidateCodes.join(', ')}`, payload });
      return json({ ok: true, ignored: true, reason: 'No active affiliate matched referral/coupon codes.' });
    }

    if (affiliate.user_status !== 'active') {
      await logEvent(env, { ...payload, affiliate_code: affiliateCode, external_order_id: externalOrderId, status: 'ignored', message: 'Affiliate user is not active.', payload });
      return json({ ok: true, ignored: true, reason: 'Affiliate user is not active.' });
    }

    const rate = Number(affiliate.commission_percentage);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      await logEvent(env, { ...payload, affiliate_code: affiliateCode, external_order_id: externalOrderId, status: 'error', message: 'Affiliate commission percentage is missing or invalid.', payload });
      return json({ error: 'Affiliate commission percentage is missing or invalid.' }, 400);
    }

    if (saleStatus !== 'voided' && (!Number.isFinite(grossAmount) || grossAmount <= 0)) {
      await logEvent(env, { ...payload, affiliate_code: affiliateCode, external_order_id: externalOrderId, status: 'error', message: 'Gross amount must be greater than 0.', payload });
      return json({ error: 'Gross amount must be greater than 0.' }, 400);
    }

    const commissionAmount = money(grossAmount * rate / 100);
    const existing = await getExistingSale(env, externalOrderId);

    if (existing) {
      let nextStatus = saleStatus;
      let message = 'Existing WordPress sale updated.';

      if (existing.status === 'paid') {
        nextStatus = existing.status;
        message = saleStatus === 'voided'
          ? 'Sale is already marked paid; webhook did not automatically void it. Review manually.'
          : 'Sale is already marked paid; webhook updated order details only.';
      } else if (existing.status === 'approved' && saleStatus === 'pending') {
        nextStatus = existing.status;
      }

      await env.DB.prepare(`
        UPDATE affiliate_sales
        SET affiliate_user_id = ?, affiliate_code = ?, customer_email = ?, gross_amount = ?, currency = ?,
            commission_percentage = ?, commission_amount = ?, status = ?, notes = ?, updated_at = datetime('now'),
            status_updated_at = CASE WHEN status != ? THEN datetime('now') ELSE status_updated_at END
        WHERE id = ?
      `).bind(
        affiliate.user_id,
        affiliate.code,
        customerEmail,
        grossAmount,
        currency,
        rate,
        commissionAmount,
        nextStatus,
        `WooCommerce order ${rawOrderId}. Attribution: ${attributionSource}${affiliateCode ? ` (${affiliateCode})` : ''}. Coupons: ${couponCodes.length ? couponCodes.join(', ') : 'none'}. Referral: ${referralCode || 'none'}. Last webhook: ${clean(payload.event || payload.order_status || 'order update')}.`,
        nextStatus,
        existing.id
      ).run();

      await logEvent(env, { ...payload, affiliate_code: affiliateCode, external_order_id: externalOrderId, status: 'processed', message, payload });
      return json({ ok: true, updated: true, sale_id: existing.id, status: nextStatus, message });
    }

    if (saleStatus === 'voided') {
      await logEvent(env, { ...payload, affiliate_code: affiliateCode, external_order_id: externalOrderId, status: 'ignored', message: 'Void/refund received before a sale record existed.', payload });
      return json({ ok: true, ignored: true, reason: 'Void/refund received before sale record existed.' });
    }

    const result = await env.DB.prepare(`
      INSERT INTO affiliate_sales
        (affiliate_user_id, affiliate_code, source, external_order_id, customer_email, gross_amount, currency, commission_percentage, commission_amount, status, notes, created_by)
      VALUES
        (?, ?, 'wordpress', ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)
    `).bind(
      affiliate.user_id,
      affiliate.code,
      externalOrderId,
      customerEmail,
      grossAmount,
      currency,
      rate,
      commissionAmount,
      `Imported from WooCommerce order ${rawOrderId}. Attribution: ${attributionSource}${affiliateCode ? ` (${affiliateCode})` : ''}. Coupons: ${couponCodes.length ? couponCodes.join(', ') : 'none'}. Referral: ${referralCode || 'none'}.`
    ).run();

    const saleId = result.meta?.last_row_id || null;
    await logEvent(env, { ...payload, affiliate_code: affiliateCode, external_order_id: externalOrderId, status: 'processed', message: `Created sale ${saleId || ''}.`, payload });

    return json({ ok: true, created: true, sale_id: saleId, status: 'pending', commission_amount: commissionAmount });
  } catch (error) {
    try {
      if (payload) await logEvent(env, { ...payload, status: 'error', message: error?.message || 'Webhook failed.', payload });
    } catch {}
    return json({ error: error?.message || 'WooCommerce webhook failed.' }, 500);
  }
}
