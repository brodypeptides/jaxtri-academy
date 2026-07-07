import { json, getUserFromRequest } from '../../../../lib/auth.js';

async function logAudit(env, actorId, targetUserId, action, details) {
  try {
    await env.DB.prepare(`
      INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
      VALUES (?, ?, ?, ?)
    `).bind(actorId, targetUserId, action, JSON.stringify(details || {})).run();
  } catch {}
}

export async function onRequestPost({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!actor || actor.role !== 'owner') return json({ error: 'Owner access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);
    if (Number(actor.id) === id) return json({ error: 'Use the Logout button to end your own session.' }, 403);

    const target = await env.DB.prepare('SELECT id, full_name, email, role FROM users WHERE id = ? LIMIT 1').bind(id).first();
    if (!target) return json({ error: 'User not found.' }, 404);

    const result = await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
    await logAudit(env, actor.id, id, 'revoke_sessions', { email: target.email, deleted: result.meta?.changes || 0 });

    return json({ ok: true, deleted_sessions: result.meta?.changes || 0 });
  } catch (error) {
    return json({ error: error?.message || 'Could not revoke user sessions.' }, 500);
  }
}
