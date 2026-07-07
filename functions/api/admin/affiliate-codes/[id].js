import { json, getUserFromRequest } from '../../../lib/auth.js';

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

function clean(value) { return String(value || '').trim(); }

export async function onRequestPatch({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid code ID.' }, 400);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const status = clean(body.status).toLowerCase();
    if (!['active', 'disabled'].includes(status)) return json({ error: 'Invalid code status.' }, 400);

    const existing = await env.DB.prepare('SELECT id, user_id, code FROM affiliate_codes WHERE id = ? LIMIT 1').bind(id).first();
    if (!existing) return json({ error: 'Affiliate code not found.' }, 404);

    await env.DB.prepare("UPDATE affiliate_codes SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, id).run();

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'update_affiliate_code_status', ?)
      `).bind(actor.id, existing.user_id, JSON.stringify({ code: existing.code, status })).run();
    } catch {}

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not update affiliate code.' }, 500);
  }
}
