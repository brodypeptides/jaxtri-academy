import { json, verifyPassword, createSession, cookie } from '../lib/auth.js';

function redirectFor(role, status) {
  if (status === 'pending') return '/pending.html';
  if (role === 'owner' || role === 'manager') return '/owner-dashboard.html';
  return '/academy-dashboard.html';
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ error: 'Database binding missing.' }, 500);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return json({ error: 'Email/username and password are required.' }, 400);
    }

    const user = await env.DB.prepare(`
      SELECT *
      FROM users
      WHERE lower(email) = ? OR lower(username) = ?
      LIMIT 1
    `).bind(identifier, identifier).first();

    if (!user) return json({ error: 'Invalid login.' }, 401);

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return json({ error: 'Invalid login.' }, 401);

    if (user.status === 'suspended') return json({ error: 'Account suspended.' }, 403);

    const session = await createSession(env, user.id, !!body.remember);
    return json({ ok: true, redirect: redirectFor(user.role, user.status) }, 200, {
      'Set-Cookie': cookie('jaxtri_session', session.id, session.maxAge),
    });
  } catch (error) {
    return json({ error: error?.message || 'Login failed inside Cloudflare Function.' }, 500);
  }
}
