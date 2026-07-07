import { json, getUserFromRequest, canManageRecruitment, randomId } from '../../../../lib/auth.js';

function sqlDateFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

function inviteUrl(request, token) {
  const origin = new URL(request.url).origin;
  return `${origin}/invite.html?token=${encodeURIComponent(token)}`;
}

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!id) return json({ error: 'Invalid application ID.' }, 400);

    const app = await env.DB.prepare(`
      SELECT id, full_name, email, status, archived_at
      FROM applications
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!app) return json({ error: 'Application not found.' }, 404);
    if (app.archived_at) return json({ error: 'Restore this application before creating an invite.' }, 400);
    if (app.status !== 'approved') return json({ error: 'Approve the application before creating an invite.' }, 400);

    const existing = await env.DB.prepare(`
      SELECT token, status, expires_at, used_at
      FROM invites
      WHERE application_id = ?
        AND status = 'active'
        AND used_at IS NULL
        AND expires_at > datetime('now')
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).bind(id).first();

    if (existing) {
      return json({
        ok: true,
        reused: true,
        token: existing.token,
        invite_url: inviteUrl(request, existing.token),
        expires_at: existing.expires_at,
      });
    }

    const token = randomId(24);
    const expiresAt = sqlDateFromNow(14);

    await env.DB.prepare(`
      INSERT INTO invites (token, application_id, email, role, status, expires_at, created_by)
      VALUES (?, ?, ?, 'affiliate', 'active', ?, ?)
    `).bind(token, app.id, String(app.email || '').toLowerCase(), expiresAt, user.id).run();

    return json({
      ok: true,
      reused: false,
      token,
      invite_url: inviteUrl(request, token),
      expires_at: expiresAt,
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not create invite.' }, 500);
  }
}
