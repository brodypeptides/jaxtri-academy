import { json, bad, readJson, requireUser, now } from '../_lib.js';
export async function onRequestGet(context) {
  const auth = await requireUser(context, ['owner','manager']); if (auth.error) return auth.error;
  const rows = await context.env.DB.prepare(`SELECT content_items.*, users.name as author_name FROM content_items LEFT JOIN users ON users.id = content_items.created_by WHERE content_items.status IN ('pending_review','changes_requested') ORDER BY content_items.created_at DESC`).all();
  return json({ submissions: rows.results || [] });
}
export async function onRequestPost(context) {
  const auth = await requireUser(context, ['owner','manager']); if (auth.error) return auth.error;
  const b = await readJson(context.request);
  if (!b.id || !['published','rejected','changes_requested','archived'].includes(b.status)) return bad('Invalid content review action.');
  await context.env.DB.prepare(`UPDATE content_items SET status=?, review_note=?, reviewed_by=?, updated_at=? WHERE id=?`).bind(b.status, b.note||'', auth.user.id, now(), b.id).run();
  return json({ ok: true });
}
