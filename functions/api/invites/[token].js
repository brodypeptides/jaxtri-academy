import { json, hashPassword, createSession, cookie } from '../../lib/auth.js';

function clean(value) {
  return String(value || '').trim();
}

async function getInvite(env, token) {
  return await env.DB.prepare(`
    SELECT
      invites.id,
      invites.token,
      invites.application_id,
      invites.email,
      invites.role,
      invites.status,
      invites.expires_at,
      invites.used_at,
      invites.created_at,
      applications.full_name AS application_name,
      applications.discord_username,
      applications.tiktok,
      applications.instagram,
      applications.youtube
    FROM invites
    LEFT JOIN applications ON applications.id = invites.application_id
    WHERE invites.token = ?
    LIMIT 1
  `).bind(token).first();
}

function publicInvite(invite) {
  return {
    token: invite.token,
    email: invite.email,
    role: invite.role,
    full_name: invite.application_name || '',
    expires_at: invite.expires_at,
    status: invite.status,
    used_at: invite.used_at,
  };
}

function isUsable(invite) {
  if (!invite) return false;
  if (invite.status !== 'active') return false;
  if (invite.used_at) return false;
  if (new Date(invite.expires_at.replace(' ', 'T') + 'Z').getTime() <= Date.now()) return false;
  return true;
}

export async function onRequestGet({ env, params }) {
  try {
    const token = clean(params.token);
    if (!token) return json({ error: 'Missing invite token.' }, 400);

    const invite = await getInvite(env, token);
    if (!invite) return json({ error: 'Invite not found.' }, 404);

    if (!isUsable(invite)) {
      return json({ error: 'This invite is expired or has already been used.', invite: publicInvite(invite) }, 410);
    }

    return json({ invite: publicInvite(invite) });
  } catch (error) {
    return json({ error: error?.message || 'Could not load invite.' }, 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  try {
    const token = clean(params.token);
    if (!token) return json({ error: 'Missing invite token.' }, 400);

    const invite = await getInvite(env, token);
    if (!invite) return json({ error: 'Invite not found.' }, 404);
    if (!isUsable(invite)) return json({ error: 'This invite is expired or has already been used.' }, 410);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const fullName = clean(body.full_name || invite.application_name);
    const username = clean(body.username).toLowerCase();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirm_password || '');

    if (!fullName || !username || !password) {
      return json({ error: 'Name, username, and password are required.' }, 400);
    }

    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400);
    }

    if (password !== confirmPassword) {
      return json({ error: 'Passwords do not match.' }, 400);
    }

    const email = String(invite.email || '').trim().toLowerCase();

    const existing = await env.DB.prepare(`
      SELECT id FROM users
      WHERE lower(email) = ? OR lower(username) = ?
      LIMIT 1
    `).bind(email, username).first();

    if (existing) {
      return json({ error: 'An account already exists with this email or username.' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const companyTitle = invite.role === 'affiliate' ? 'Affiliate, Jaxtri Labs' : '';

    await env.DB.prepare(`
      INSERT INTO users (full_name, email, username, password_hash, role, company_title, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).bind(fullName, email, username, passwordHash, invite.role, companyTitle).run();

    const user = await env.DB.prepare('SELECT id, role, status FROM users WHERE lower(email) = ? LIMIT 1')
      .bind(email)
      .first();

    if (!user) return json({ error: 'Account was created, but login failed.' }, 500);

    await env.DB.prepare(`
      UPDATE invites
      SET status = 'used', used_at = datetime('now'), used_by = ?
      WHERE id = ?
    `).bind(user.id, invite.id).run();

    const session = await createSession(env, user.id, true);

    return json(
      { ok: true, redirect: user.role === 'affiliate' ? '/academy-dashboard.html' : '/owner-dashboard.html' },
      200,
      { 'Set-Cookie': cookie('jaxtri_session', session.id, session.maxAge) }
    );
  } catch (error) {
    return json({ error: error?.message || 'Could not accept invite.' }, 500);
  }
}
