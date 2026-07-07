import { json, getUserFromRequest } from '../../../../lib/auth.js';

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user) return json({ error: 'Not logged in.' }, 401);
    if (user.role !== 'owner') return json({ error: 'Owner access required.' }, 403);

    const id = Number(params.id);
    if (!id) return json({ error: 'Invalid post ID.' }, 400);

    await env.DB.prepare('DELETE FROM feed_posts WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not delete post.' }, 500);
  }
}
