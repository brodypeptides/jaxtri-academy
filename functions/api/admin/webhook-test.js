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

async function getChecks(env) {
  const checks = {
    secret_configured: Boolean(clean(env.JAXTRI_WC_WEBHOOK_SECRET)),
    affiliate_sales_table: await tableExists(env, 'affiliate_sales'),
    affiliate_codes_table: await tableExists(env, 'affiliate_codes'),
    webhook_events_table: await tableExists(env, 'affiliate_webhook_events'),
  };
  checks.ready = checks.secret_configured && checks.affiliate_sales_table && checks.affiliate_codes_table && checks.webhook_events_table;
  return checks;
}

export async function onRequestGet({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    return json({
      ok: true,
      checks: await getChecks(env),
      webhook_url: `${new URL(request.url).origin}/api/webhooks/woocommerce`,
      message: 'Use POST to send a test WooCommerce webhook through the live endpoint.',
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not check webhook setup.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const checks = await getChecks(env);
    if (!checks.secret_configured) {
      return json({ error: 'JAXTRI_WC_WEBHOOK_SECRET is not configured in Cloudflare Pages.', checks }, 400);
    }
    if (!checks.affiliate_sales_table || !checks.affiliate_codes_table) {
      return json({ error: 'Sprint 6A commission tables are missing.', checks }, 400);
    }
    if (!checks.webhook_events_table) {
      return json({ error: 'Webhook event table is missing. Run database/sprint6g-webhook-events.sql in D1 first.', checks }, 400);
    }

    const origin = new URL(request.url).origin;
    const payload = {
      provider: 'woocommerce',
      event: 'test',
      order_id: `jaxtri-test-${Date.now()}`,
      order_status: 'test',
      gross_amount: 0,
      currency: 'USD',
      affiliate_code_candidates: [],
      source_detail: 'dashboard_test',
    };

    const response = await fetch(`${origin}/api/webhooks/woocommerce`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-jaxtri-secret': clean(env.JAXTRI_WC_WEBHOOK_SECRET),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({ error: 'Webhook returned a non-JSON response.' }));
    if (!response.ok) {
      return json({ error: data.error || 'Test webhook failed.', webhook_status: response.status, webhook_response: data, checks }, 400);
    }

    return json({ ok: true, webhook_status: response.status, webhook_response: data, checks, message: 'Test webhook reached the live WooCommerce endpoint.' });
  } catch (error) {
    return json({ error: error?.message || 'Could not send test webhook.' }, 500);
  }
}
