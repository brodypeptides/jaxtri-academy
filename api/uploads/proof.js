import { json, getUserFromRequest, randomId } from '../../lib/auth.js';

function clean(value) {
  return String(value ?? '').trim();
}

function safeFileName(name) {
  const raw = clean(name || 'upload').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80);
  return raw || 'upload';
}

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .bind(name)
    .first();
  return Boolean(row);
}

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    if (!env.UPLOADS_BUCKET) return json({ error: 'R2 binding UPLOADS_BUCKET is not configured.' }, 500);
    if (!(await tableExists(env, 'affiliate_uploads'))) return json({ error: 'Upload table missing. Run Sprint 6D migration first.' }, 400);

    const form = await request.formData().catch(() => null);
    if (!form) return json({ error: 'Upload must use multipart/form-data.' }, 400);

    const file = form.get('file');
    const purpose = clean(form.get('purpose') || 'payout_proof').slice(0, 60) || 'payout_proof';

    if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'Choose a file to upload.' }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'File is too large. Max upload size is 10MB.' }, 400);

    const contentType = clean(file.type || 'application/octet-stream').toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) return json({ error: 'Only PNG, JPG, WEBP, and PDF proof files are allowed.' }, 400);

    const fileName = safeFileName(file.name || 'proof');
    const key = `proofs/user-${user.id}/${Date.now()}-${randomId(8)}-${fileName}`;
    const buffer = await file.arrayBuffer();

    await env.UPLOADS_BUCKET.put(key, buffer, {
      httpMetadata: { contentType },
      customMetadata: {
        user_id: String(user.id),
        purpose,
        original_name: fileName,
      },
    });

    const result = await env.DB.prepare(`
      INSERT INTO affiliate_uploads (user_id, r2_key, file_name, content_type, size_bytes, purpose)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(user.id, key, fileName, contentType, file.size, purpose).run();

    const id = result.meta?.last_row_id || null;
    return json({
      ok: true,
      upload: {
        id,
        file_name: fileName,
        content_type: contentType,
        size_bytes: file.size,
        purpose,
        view_url: id ? `/api/uploads/${id}` : null,
      },
    });
  } catch (error) {
    return json({ error: error?.message || 'Upload failed.' }, 500);
  }
}
