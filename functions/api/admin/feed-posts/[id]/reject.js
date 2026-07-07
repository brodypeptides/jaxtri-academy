import { json, getUserFromRequest, canManageRecruitment } from '../../../../lib/auth.js';

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!id) return json({ error: 'Invalid post ID.' }, 400);
    const body = await request.json().catch(() => ({}));
    const note = String(body.note || '').trim().slice(0, 1000);

    await env.DB.prepare(`
      UPDATE feed_posts
      SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(user.id, note || null, id).run();

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not reject post.' }, 500);
  }
}
