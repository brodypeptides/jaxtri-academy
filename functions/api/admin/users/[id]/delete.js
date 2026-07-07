import { json, getUserFromRequest } from '../../../../lib/auth.js';

async function tableExists(env, name) {
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
  ).bind(name).first();
  return Boolean(row);
}

async function runIfTable(env, table, sql, ...binds) {
  if (!(await tableExists(env, table))) return;
  await env.DB.prepare(sql).bind(...binds).run();
}

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
    if (Number(actor.id) === id) return json({ error: 'You cannot delete your own account.' }, 403);

    const target = await env.DB.prepare(`
      SELECT id, full_name, email, username, role, status
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!target) return json({ error: 'User not found.' }, 404);
    if (target.role === 'owner') {
      return json({ error: 'Owner accounts cannot be deleted from the web panel.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const confirmEmail = String(body.confirm_email || '').trim().toLowerCase();
    if (confirmEmail !== String(target.email || '').toLowerCase()) {
      return json({ error: 'Type the user email exactly to confirm permanent deletion.' }, 400);
    }

    await logAudit(env, actor.id, id, 'delete_user', { email: target.email, role: target.role, status: target.status });

    await runIfTable(env, 'sessions', 'DELETE FROM sessions WHERE user_id = ?', id);
    await runIfTable(env, 'user_presence', 'DELETE FROM user_presence WHERE user_id = ?', id);
    await runIfTable(env, 'direct_messages', 'DELETE FROM direct_messages WHERE sender_id = ? OR receiver_id = ?', id, id);
    await runIfTable(env, 'channel_reads', 'DELETE FROM channel_reads WHERE user_id = ?', id);
    await runIfTable(env, 'channel_messages', 'DELETE FROM channel_messages WHERE sender_id = ?', id);
    await runIfTable(env, 'feed_posts', 'DELETE FROM feed_posts WHERE author_id = ?', id);
    await runIfTable(env, 'feed_posts', 'UPDATE feed_posts SET reviewed_by = NULL WHERE reviewed_by = ?', id);
    await runIfTable(env, 'applications', 'UPDATE applications SET reviewed_by = NULL WHERE reviewed_by = ?', id);
    await runIfTable(env, 'invites', 'UPDATE invites SET created_by = NULL WHERE created_by = ?', id);
    await runIfTable(env, 'invites', 'UPDATE invites SET used_by = NULL WHERE used_by = ?', id);

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not delete user.' }, 500);
  }
}
