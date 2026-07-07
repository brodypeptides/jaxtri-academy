import { json, clearCookie, deleteSession } from '../lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (env.DB) await deleteSession(env, request);
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie('jaxtri_session') });
  } catch {
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie('jaxtri_session') });
  }
}
