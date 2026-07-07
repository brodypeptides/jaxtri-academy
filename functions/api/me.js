import { json, getUserFromRequest } from '../lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user) return json({ error: 'Not logged in' }, 401);
    return json({ user });
  } catch (error) {
    return json({ error: error?.message || 'Could not load session.' }, 500);
  }
}
