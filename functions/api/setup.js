import { json, hashPassword, createSession, cookie } from '../lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json({ error: 'D1 binding DB is missing. Check wrangler.toml and Cloudflare deployment.' }, 500);
    }

    const existing = await env.DB
      .prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
      .first();

    if (existing) {
      return json({ error: 'This Academy is already initialized.' }, 403);
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const companyTitle = String(body.company_title || 'Manager, Jaxtri Labs').trim();

    if (!fullName || !email || !username || !password) {
      return json({ error: 'Missing required fields.' }, 400);
    }

    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400);
    }

    const passwordHash = await hashPassword(password);

    await env.DB
      .prepare(`
        INSERT INTO users 
        (full_name, email, username, password_hash, role, company_title, status) 
        VALUES (?, ?, ?, ?, 'owner', ?, 'active')
      `)
      .bind(fullName, email, username, passwordHash, companyTitle)
      .run();

    const user = await env.DB
      .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
      .bind(email)
      .first();

    if (!user) {
      return json({ error: 'Owner was created, but user lookup failed.' }, 500);
    }

    await env.DB
      .prepare(`
        INSERT OR REPLACE INTO app_settings (key, value, updated_at)
        VALUES ('initialized', 'true', datetime('now'))
      `)
      .run();

    const session = await createSession(env, user.id, true);

    return json(
      { ok: true, redirect: '/owner-dashboard.html' },
      200,
      { 'Set-Cookie': cookie('jaxtri_session', session.id, session.maxAge) }
    );
  } catch (error) {
    return json(
      { error: error?.message || 'Setup failed inside Cloudflare Function.' },
      500
    );
  }
}