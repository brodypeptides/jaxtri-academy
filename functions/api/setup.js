import { json, bad, readJson, hashPassword, now } from './_lib.js';
export async function onRequestPost(context) {
  const db = context.env.DB;
  const existing = await db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").first();
  if (existing) return bad('Setup is locked because an owner account already exists.', 403);
  const body = await readJson(context.request);
  if (!body.name || !body.email || !body.username || !body.password) return bad('Missing required fields.');
  if (body.password.length < 10) return bad('Password must be at least 10 characters.');
  const passwordHash = await hashPassword(body.password);
  await db.prepare(`INSERT INTO users (name,email,username,password_hash,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(body.name, body.email.toLowerCase(), body.username.toLowerCase(), passwordHash, 'owner', 'active', now(), now()).run();
  await db.prepare(`INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('initialized','true',?)`).bind(now()).run();
  return json({ ok: true });
}
