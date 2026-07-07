import { json, bad, readJson, requireUser, now } from '../_lib.js';
export async function onRequestGet(context) {
  const auth = await requireUser(context, ['owner','manager']); if (auth.error) return auth.error;
  const rows = await context.env.DB.prepare(`SELECT * FROM applications ORDER BY created_at DESC LIMIT 100`).all();
  return json({ applications: rows.results || [] });
}
export async function onRequestPost(context) {
  const auth = await requireUser(context, ['owner','manager']); if (auth.error) return auth.error;
  const b = await readJson(context.request);
  if (!b.id || !['reviewing','approved','rejected','archived'].includes(b.status)) return bad('Invalid application action.');
  await context.env.DB.prepare(`UPDATE applications SET status=?, review_note=?, reviewed_by=?, updated_at=? WHERE id=?`).bind(b.status, b.note||'', auth.user.id, now(), b.id).run();
  return json({ ok: true });
}
