import { json, getUserFromRequest } from '../../../lib/auth.js';

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

async function getRequest(env, id) {
  return await env.DB.prepare(`
    SELECT pr.*, u.full_name AS affiliate_name, u.email AS affiliate_email
    FROM payout_requests pr
    JOIN users u ON u.id = pr.affiliate_user_id
    WHERE pr.id = ?
    LIMIT 1
  `).bind(id).first();
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);
    if (!(await tableExists(env, 'payout_requests')) || !(await tableExists(env, 'payout_request_sales'))) {
      return json({ error: 'Payout system is not set up yet.' }, 400);
    }

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid payout request ID.' }, 400);

    const payout = await getRequest(env, id);
    if (!payout) return json({ error: 'Payout request not found.' }, 404);
    if (payout.status === 'paid') return json({ error: 'This payout request is already marked paid.' }, 400);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const nextStatus = clean(body.status).toLowerCase();
    if (!['paid', 'rejected'].includes(nextStatus)) return json({ error: 'Status must be paid or rejected.' }, 400);

    const transactionId = clean(body.transaction_id).slice(0, 180) || null;
    const adminNote = clean(body.admin_note).slice(0, 1000) || null;
    const proofUrl = clean(body.proof_url).slice(0, 1000) || null;

    if (nextStatus === 'paid' && !transactionId && !proofUrl) {
      return json({ error: 'Add a PayPal/reference ID or proof link before marking paid.' }, 400);
    }

    if (nextStatus === 'paid') {
      await env.DB.prepare(`
        UPDATE payout_requests
        SET status = 'paid',
            transaction_id = ?,
            proof_url = ?,
            admin_note = ?,
            reviewed_by = ?,
            reviewed_at = datetime('now'),
            paid_by = ?,
            paid_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(transactionId, proofUrl, adminNote, actor.id, actor.id, id).run();

      const saleRows = await env.DB.prepare(`
        SELECT sale_id
        FROM payout_request_sales
        WHERE payout_request_id = ?
      `).bind(id).all();

      for (const row of saleRows.results || []) {
        await env.DB.prepare(`
          UPDATE affiliate_sales
          SET status = 'paid',
              status_updated_by = ?,
              status_updated_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ? AND status = 'approved'
        `).bind(actor.id, row.sale_id).run();
      }
    } else {
      await env.DB.prepare(`
        UPDATE payout_requests
        SET status = 'rejected',
            admin_note = ?,
            reviewed_by = ?,
            reviewed_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(adminNote, actor.id, id).run();
    }

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'update_payout_request', ?)
      `).bind(actor.id, payout.affiliate_user_id, JSON.stringify({ payout_request_id: id, status: nextStatus, transaction_id: transactionId, proof_url: proofUrl })).run();
    } catch {}

    return json({ ok: true, payout_request: await getRequest(env, id) });
  } catch (error) {
    return json({ error: error?.message || 'Could not update payout request.' }, 500);
  }
}
