import { json, getUserFromRequest, canManageRecruitment } from '../../../../lib/auth.js';

function canRevokeInvite(user, invite) {
  if (!user || !invite) return false;
  if (user.role === 'owner') return true;
  if (user.role === 'manager') return invite.role === 'affiliate';
  return false;
}

export async function onRequestPost({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!id) return json({ error: 'Invalid invite ID.' }, 400);

    const invite = await env.DB.prepare(`
      SELECT id, email, role, status, used_at
      FROM invites
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!invite) return json({ error: 'Invite not found.' }, 404);
    if (!canRevokeInvite(user, invite)) return json({ error: 'You do not have permission to revoke this invite.' }, 403);
    if (invite.status === 'used' || invite.used_at) return json({ error: 'Used invites cannot be revoked.' }, 400);
    if (invite.status === 'revoked') return json({ ok: true, already_revoked: true });

    await env.DB.prepare(`
      UPDATE invites
      SET status = 'revoked'
      WHERE id = ?
    `).bind(id).run();

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not revoke invite.' }, 500);
  }
}
