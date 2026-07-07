import { json, bad, readJson, requireUser, now } from '../_lib.js';
export async function onRequestPost(context) {
  const auth = await requireUser(context, ['owner','manager','affiliate']); if (auth.error) return auth.error;
  const b = await readJson(context.request);
  if (!b.type || !b.title || !b.body) return bad('Type, title, and content are required.');
  await context.env.DB.prepare(`INSERT INTO content_items (type,title,body,notes,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(b.type, b.title, b.body, b.notes||'', 'pending_review', auth.user.id, now(), now()).run();
  return json({ ok: true });
}
