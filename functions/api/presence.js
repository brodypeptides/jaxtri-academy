import { json } from '../lib/auth.js';
import { requireActiveUser, touchPresence, missingSprint4, sprint4MissingResponse } from '../lib/team.js';

export async function onRequestPost({ request, env }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);
    return json({ ok: true, last_seen_at: new Date().toISOString() });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    return json({ error: error?.message || 'Could not update presence.' }, 500);
  }
}
