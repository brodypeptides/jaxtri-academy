import { json, getCookie, sha256, clearCookie } from './_lib.js';
export async function onRequestPost(context) { const token = getCookie(context.request, 'jaxtri_session'); if (token) await context.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run(); return json({ ok: true }, 200, { 'set-cookie': clearCookie() }); }
