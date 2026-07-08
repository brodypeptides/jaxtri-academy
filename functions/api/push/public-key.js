import { json, getUserFromRequest } from '../../lib/auth.js';
import { webPushConfigured } from '../../lib/webpush.js';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const publicKey = String(env.WEB_PUSH_PUBLIC_KEY || '').trim();
    return json({
      ok: true,
      configured: webPushConfigured(env),
      public_key: publicKey || null,
      subject: env.WEB_PUSH_SUBJECT || 'mailto:support@jaxtrilabsacademy.com',
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load push settings.' }, 500);
  }
}
