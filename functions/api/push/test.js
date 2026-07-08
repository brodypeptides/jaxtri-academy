import { json, getUserFromRequest } from '../../lib/auth.js';
import { sendWebPush, webPushConfigured } from '../../lib/webpush.js';

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first();
  return Boolean(row);
}

async function addStoredNotification(env, userId) {
  try {
    if (!(await tableExists(env, 'app_notifications'))) return;
    await env.DB.prepare(`
      INSERT INTO app_notifications (user_id, audience_type, title, body, link_url, status)
      VALUES (?, 'user', 'Push notification test', 'Your Jaxtri Academy push notifications are connected.', 'notifications.html', 'unread')
    `).bind(userId).run();
  } catch {
    // Non-blocking.
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);
    if (!webPushConfigured(env)) {
      return json({ error: 'Web Push keys missing. Add WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, and WEB_PUSH_SUBJECT in Cloudflare.' }, 400);
    }
    if (!(await tableExists(env, 'push_subscriptions'))) {
      return json({ error: 'Push table missing. Run database/sprint9-1-pwa-push.sql in D1 first.' }, 400);
    }

    const rows = await env.DB.prepare(`
      SELECT id, endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE user_id = ? AND status = 'active'
      ORDER BY datetime(updated_at) DESC, id DESC
      LIMIT 10
    `).bind(user.id).all();

    const subscriptions = rows.results || [];
    if (!subscriptions.length) return json({ error: 'No active push subscriptions for this account yet.' }, 400);

    let sent = 0;
    let disabled = 0;
    const failures = [];

    for (const sub of subscriptions) {
      const result = await sendWebPush(env, sub, { ttl: 60, urgency: 'normal' });
      if (result.ok) sent += 1;
      else failures.push({ id: sub.id, status: result.status, error: result.error || result.statusText || 'Push failed.' });

      if (result.shouldDisable) {
        disabled += 1;
        await env.DB.prepare(`
          UPDATE push_subscriptions
          SET status = 'disabled', updated_at = datetime('now')
          WHERE id = ?
        `).bind(sub.id).run();
      }
    }

    await addStoredNotification(env, user.id);
    return json({ ok: sent > 0, sent, disabled, failures });
  } catch (error) {
    return json({ error: error?.message || 'Could not send push test.' }, 500);
  }
}
