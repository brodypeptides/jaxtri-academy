export async function onRequestPost({ request, env }) {
  const data = await request.json();
  const now = new Date().toISOString();
  if (env.DB) {
    await env.DB.prepare(`INSERT INTO applications (name,email,discord,platform,profile,audience,why,content_style,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(data.name || '', data.email || '', data.discord || '', data.platform || '', data.profile || '', data.audience || '', data.why || '', data.content_style || '', 'pending', now)
      .run();
  }
  return Response.json({ ok: true, status: 'pending' });
}

export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ ok: true, applications: [] });
  const { results } = await env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();
  return Response.json({ ok: true, applications: results });
}
