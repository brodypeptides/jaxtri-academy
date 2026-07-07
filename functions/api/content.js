export async function onRequestPost({ request, env }) {
  const data = await request.json();
  const now = new Date().toISOString();
  if (env.DB) {
    await env.DB.prepare(`INSERT INTO content_items (type,title,category,status,body,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(data.type || 'Post', data.title || 'Untitled', data.category || '', data.status || 'draft', data.body || '', data.tags || '', now, now)
      .run();
  }
  return Response.json({ ok: true });
}

export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ ok: true, items: [] });
  const { results } = await env.DB.prepare('SELECT * FROM content_items ORDER BY created_at DESC').all();
  return Response.json({ ok: true, items: results });
}
