import { json, bad, readJson, requireUser, randomToken, sha256, now } from '../_lib.js';
async function sendInviteEmail(env, to, name, inviteUrl) {
  if (!env.RESEND_API_KEY || !env.INVITE_FROM_EMAIL) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.INVITE_FROM_EMAIL,
      to,
      subject: 'Your Jaxtri Academy invite',
      html: `<p>Hey ${name || 'there'},</p><p>Your Jaxtri Academy account has been approved.</p><p><a href="${inviteUrl}">Create your password</a></p><p>This password is separate from any other affiliate tools.</p>`
    })
  });
  return res.ok;
}
export async function onRequestPost(context) {
  const auth = await requireUser(context, ['owner','manager']); if (auth.error) return auth.error;
  const b = await readJson(context.request);
  if (!b.email || !b.name || !['owner','manager','affiliate'].includes(b.role)) return bad('Name, email, and valid role are required.');
  if (b.role === 'owner' && auth.user.role !== 'owner') return bad('Only owners can invite owners.', 403);
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  let existing = await context.env.DB.prepare(`SELECT id FROM users WHERE lower(email)=?`).bind(b.email.toLowerCase()).first();
  let userId = existing?.id;
  if (!userId) {
    const result = await context.env.DB.prepare(`INSERT INTO users (name,email,username,password_hash,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(b.name, b.email.toLowerCase(), b.email.toLowerCase(), '', b.role, 'invited', now(), now()).run();
    userId = result.meta.last_row_id;
  } else {
    await context.env.DB.prepare(`UPDATE users SET name=?, role=?, status='invited', updated_at=? WHERE id=?`).bind(b.name, b.role, now(), userId).run();
  }
  await context.env.DB.prepare(`INSERT INTO invites (user_id,email,role,token_hash,created_by,status,created_at,expires_at) VALUES (?,?,?,?,?,?,?,datetime('now','+7 days'))`).bind(userId, b.email.toLowerCase(), b.role, tokenHash, auth.user.id, 'open', now()).run();
  const base = context.env.INVITE_BASE_URL || new URL(context.request.url).origin;
  const invite_url = `${base}/accept-invite.html?token=${token}`;
  const sent = await sendInviteEmail(context.env, b.email, b.name, invite_url);
  return json({ ok: true, sent, invite_url });
}
