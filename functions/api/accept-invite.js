import { json, bad, readJson, hashPassword, sha256, now } from './_lib.js';
export async function onRequestPost(context) {
  const b = await readJson(context.request);
  if (!b.token || !b.password) return bad('Invite token and password are required.');
  if (b.password.length < 10) return bad('Password must be at least 10 characters.');
  const tokenHash = await sha256(b.token);
  const invite = await context.env.DB.prepare(`SELECT * FROM invites WHERE token_hash=? AND status='open' AND expires_at > datetime('now')`).bind(tokenHash).first();
  if (!invite) return bad('Invite is invalid or expired.', 400);
  const passwordHash = await hashPassword(b.password);
  await context.env.DB.prepare(`UPDATE users SET password_hash=?, status='active', updated_at=? WHERE id=?`).bind(passwordHash, now(), invite.user_id).run();
  await context.env.DB.prepare(`UPDATE invites SET status='accepted', accepted_at=? WHERE id=?`).bind(now(), invite.id).run();
  return json({ ok: true });
}
