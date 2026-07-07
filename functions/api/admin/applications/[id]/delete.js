import { json, getUserFromRequest } from '../../../../lib/auth.js';

function canDelete(user) {
  return user && user.role === 'owner';
}

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canDelete(user)) return json({ error: 'Owner access required for permanent deletion.' }, 403);

    const id = Number(params.id);
    if (!id) return json({ error: 'Invalid application ID.' }, 400);

    try {
      await env.DB.prepare('DELETE FROM invites WHERE application_id = ?').bind(id).run();
    } catch (error) {
      if (!String(error?.message || '').includes('no such table')) throw error;
    }

    await env.DB.prepare('DELETE FROM applications WHERE id = ?').bind(id).run();

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not delete application.' }, 500);
  }
}
