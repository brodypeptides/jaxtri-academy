import { json, getUserFromRequest } from '../../../../lib/auth.js';

function canManage(user) { return user && (user.role === 'owner' || user.role === 'manager'); }

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManage(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!id) return json({ error: 'Invalid application ID.' }, 400);

    const body = await request.json().catch(() => ({}));
    const note = String(body.note || '').trim();

    await env.DB.prepare(`
      UPDATE applications
      SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
      WHERE id = ?
    `).bind(user.id, note, id).run();

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not reject application.' }, 500);
  }
}
