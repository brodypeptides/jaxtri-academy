import { json, bad, readJson, now } from './_lib.js';
export async function onRequestPost(context) {
  const b = await readJson(context.request);
  if (!b.name || !b.email || !b.reason) return bad('Name, email, and reason are required.');
  await context.env.DB.prepare(`INSERT INTO applications (name,email,discord,platform,audience_size,experience,reason,social_links,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(b.name, b.email.toLowerCase(), b.discord||'', b.platform||'', b.audience_size||'', b.experience||'', b.reason, b.social_links||'', 'applied', now(), now()).run();
  return json({ ok: true });
}
