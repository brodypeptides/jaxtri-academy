import { json, getUserFromRequest } from '../../../lib/auth.js';

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

function isOwner(user) {
  return user && user.status === 'active' && user.role === 'owner';
}

function clean(value) {
  return String(value || '').trim();
}

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .bind(name)
    .first();
  return Boolean(row);
}

async function getSale(env, id) {
  return await env.DB.prepare(`
    SELECT s.*, u.full_name AS affiliate_name, u.email AS affiliate_email
    FROM affiliate_sales s
    JOIN users u ON u.id = s.affiliate_user_id
    WHERE s.id = ?
    LIMIT 1
  `).bind(id).first();
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const ready = await tableExists(env, 'affiliate_sales');
    if (!ready) return json({ error: 'Sprint 6A commission tables are missing.' }, 400);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid sale ID.' }, 400);

    const sale = await getSale(env, id);
    if (!sale) return json({ error: 'Sale not found.' }, 404);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const updates = [];
    const binds = [];
    const changes = {};

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = clean(body.status).toLowerCase();
      if (!['pending', 'approved', 'paid', 'voided'].includes(status)) return json({ error: 'Invalid commission status.' }, 400);
      if (status === 'paid' && !isOwner(actor)) return json({ error: 'Only owners can mark commissions as paid.' }, 403);
      if (status !== sale.status) {
        updates.push('status = ?');
        binds.push(status);
        updates.push('status_updated_by = ?');
        binds.push(actor.id);
        updates.push("status_updated_at = datetime('now')");
        changes.status = { from: sale.status, to: status };
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      const notes = clean(body.notes).slice(0, 1000) || null;
      if ((sale.notes || null) !== notes) {
        updates.push('notes = ?');
        binds.push(notes);
        changes.notes = true;
      }
    }

    if (!updates.length) return json({ ok: true, changed: false, sale });

    updates.push("updated_at = datetime('now')");
    await env.DB.prepare(`UPDATE affiliate_sales SET ${updates.join(', ')} WHERE id = ?`).bind(...binds, id).run();

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'update_commission_sale', ?)
      `).bind(actor.id, sale.affiliate_user_id, JSON.stringify({ sale_id: id, changes })).run();
    } catch {}

    const updated = await getSale(env, id);
    return json({ ok: true, changed: true, sale: updated });
  } catch (error) {
    return json({ error: error?.message || 'Could not update sale.' }, 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isOwner(actor)) return json({ error: 'Owner access required to delete sales.' }, 403);

    const ready = await tableExists(env, 'affiliate_sales');
    if (!ready) return json({ error: 'Sprint 6A commission tables are missing.' }, 400);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid sale ID.' }, 400);

    const sale = await getSale(env, id);
    if (!sale) return json({ error: 'Sale not found.' }, 404);
    if (sale.status === 'paid') return json({ error: 'Paid sales cannot be deleted. Void or correct them through records instead.' }, 403);

    await env.DB.prepare('DELETE FROM affiliate_sales WHERE id = ?').bind(id).run();

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'delete_commission_sale', ?)
      `).bind(actor.id, sale.affiliate_user_id, JSON.stringify({ sale_id: id, status: sale.status })).run();
    } catch {}

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not delete sale.' }, 500);
  }
}
