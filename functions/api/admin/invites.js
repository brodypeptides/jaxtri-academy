import { json, getUserFromRequest, canManageRecruitment, randomId } from '../../lib/auth.js';

function clean(value) {
  return String(value || '').trim();
}

function cleanEmail(value) {
  return clean(value).toLowerCase();
}

function sqlDateFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

function inviteUrl(request, token) {
  const origin = new URL(request.url).origin;
  return `${origin}/invite.html?token=${encodeURIComponent(token)}`;
}

function canCreateRole(user, role) {
  if (!user) return false;
  if (user.role === 'owner') return ['affiliate', 'manager', 'owner'].includes(role);
  if (user.role === 'manager') return role === 'affiliate';
  return false;
}

async function userExists(env, email) {
  return await env.DB.prepare(`
    SELECT id, full_name, email, username, role, status
    FROM users
    WHERE lower(email) = ?
    LIMIT 1
  `).bind(email).first();
}

async function getExistingInvite(env, email, role) {
  return await env.DB.prepare(`
    SELECT id, token, email, role, status, expires_at, used_at, created_at
    FROM invites
    WHERE lower(email) = ?
      AND role = ?
      AND status = 'active'
      AND used_at IS NULL
      AND expires_at > datetime('now')
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(email, role).first();
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const result = await env.DB.prepare(`
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
        invites.created_by,
        users.full_name AS created_by_name,
        applications.full_name AS application_name
      FROM invites
      LEFT JOIN users ON users.id = invites.created_by
      LEFT JOIN applications ON applications.id = invites.application_id
      ORDER BY
        CASE invites.status WHEN 'active' THEN 0 WHEN 'used' THEN 1 WHEN 'revoked' THEN 2 ELSE 3 END,
        datetime(invites.created_at) DESC
      LIMIT 100
    `).all();

    const invites = (result.results || []).map((invite) => ({
      ...invite,
      invite_url: inviteUrl(request, invite.token),
      source: invite.application_id ? 'application' : 'direct',
    }));

    return json({ invites });
  } catch (error) {
    if (String(error?.message || '').includes('no such table') || String(error?.message || '').includes('invites')) {
      return json({ error: 'Sprint 3 invite table is missing. Run database/sprint3-invites.sql first.' }, 500);
    }
    return json({ error: error?.message || 'Could not load invites.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid invite request.' }, 400);

    const email = cleanEmail(body.email);
    const role = clean(body.role || 'affiliate').toLowerCase();
    const expiresDaysRaw = Number(body.expires_days || 14);
    const expiresDays = Number.isFinite(expiresDaysRaw) ? Math.max(1, Math.min(60, Math.round(expiresDaysRaw))) : 14;

    if (!email || !email.includes('@')) return json({ error: 'A valid email is required.' }, 400);
    if (!['affiliate', 'manager', 'owner'].includes(role)) return json({ error: 'Invalid role.' }, 400);
    if (!canCreateRole(user, role)) return json({ error: 'You do not have permission to create this invite role.' }, 403);

    const existingUser = await userExists(env, email);
    if (existingUser) {
      return json({
        error: `An account already exists for ${email}. Update their role/status in D1 instead of creating another invite.`,
        existing_user: {
          email: existingUser.email,
          role: existingUser.role,
          status: existingUser.status,
        },
      }, 409);
    }

    const existingInvite = await getExistingInvite(env, email, role);
    if (existingInvite) {
      return json({
        ok: true,
        reused: true,
        invite: {
          ...existingInvite,
          invite_url: inviteUrl(request, existingInvite.token),
          source: 'direct',
        },
      });
    }

    const token = randomId(24);
    const expiresAt = sqlDateFromNow(expiresDays);

    await env.DB.prepare(`
      INSERT INTO invites (token, application_id, email, role, status, expires_at, created_by)
      VALUES (?, NULL, ?, ?, 'active', ?, ?)
    `).bind(token, email, role, expiresAt, user.id).run();

    const invite = await env.DB.prepare(`
      SELECT id, token, application_id, email, role, status, expires_at, used_at, created_at, created_by
      FROM invites
      WHERE token = ?
      LIMIT 1
    `).bind(token).first();

    return json({
      ok: true,
      reused: false,
      invite: {
        ...invite,
        invite_url: inviteUrl(request, token),
        source: 'direct',
      },
    });
  } catch (error) {
    if (String(error?.message || '').includes('no such table') || String(error?.message || '').includes('invites')) {
      return json({ error: 'Sprint 3 invite table is missing. Run database/sprint3-invites.sql first.' }, 500);
    }
    return json({ error: error?.message || 'Could not create invite.' }, 500);
  }
}
