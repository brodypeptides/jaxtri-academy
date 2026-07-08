import { json, getUserFromRequest } from '../../lib/auth.js';

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

function safeInlineName(name) {
  return String(name || 'proof').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'proof';
}

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .bind(name)
    .first();
  return Boolean(row);
}

export async function onRequestGet({ request, env, params }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);
    if (!env.UPLOADS_BUCKET) return json({ error: 'R2 binding UPLOADS_BUCKET is not configured.' }, 500);
    if (!(await tableExists(env, 'affiliate_uploads'))) return json({ error: 'Upload table missing.' }, 400);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid upload ID.' }, 400);

    const upload = await env.DB.prepare(`
      SELECT *
      FROM affiliate_uploads
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!upload) return json({ error: 'Upload not found.' }, 404);
    if (upload.user_id !== user.id && !isStaff(user)) return json({ error: 'Access denied.' }, 403);

    const object = await env.UPLOADS_BUCKET.get(upload.r2_key);
    if (!object) return json({ error: 'File is missing from R2.' }, 404);

    return new Response(object.body, {
      headers: {
        'content-type': upload.content_type || 'application/octet-stream',
        'content-disposition': `inline; filename="${safeInlineName(upload.file_name)}"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load upload.' }, 500);
  }
}
