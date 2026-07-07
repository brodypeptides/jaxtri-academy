import { json, bad, readJson, verifyPassword, randomToken, sha256, sessionCookie, redirectFor } from './_lib.js';
export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const identity = String(body.identity || '').toLowerCase().trim();
  const password = String(body.password || '');
  const user = await context.env.DB.prepare(`SELECT * FROM users WHERE lower(email)=? OR lower(username)=? LIMIT 1`).bind(identity, identity).first();
  if (!user || !await verifyPassword(password, user.password_hash)) return bad('Invalid login.', 401);
  if (user.status === 'suspended') return bad('Account suspended.', 403);
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const maxDays = body.remember ? 30 : 1;
  await context.env.DB.prepare(`INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, datetime('now'), datetime('now', ?))`).bind(user.id, tokenHash, `+${maxDays} days`).run();
  return json({ ok: true, redirect: redirectFor(user) }, 200, { 'set-cookie': sessionCookie(token, !!body.remember) });
}
