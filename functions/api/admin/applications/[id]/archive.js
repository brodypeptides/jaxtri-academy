import { json, getUserFromRequest } from '../../../../lib/auth.js';

function canManage(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManage(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!id) return json({ error: 'Invalid application ID.' }, 400);

    await env.DB.prepare(`
      UPDATE applications
      SET archived_at = datetime('now'), reviewed_by = COALESCE(reviewed_by, ?)
      WHERE id = ?
    `).bind(user.id, id).run();

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not archive application.' }, 500);
  }
}
