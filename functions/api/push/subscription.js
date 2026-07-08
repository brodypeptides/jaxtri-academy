import { json, getUserFromRequest } from '../../lib/auth.js';

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first();
  return Boolean(row);
}

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function deviceLabel(userAgent) {
  const ua = String(userAgent || '');
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows desktop';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac desktop';
  return 'Browser device';
}

async function ensureReady(env) {
  if (!(await tableExists(env, 'push_subscriptions'))) {
    return 'Push table missing. Run database/sprint9-1-pwa-push.sql in D1 first.';
  }
  return null;
}

async function setPushPreference(env, userId, enabled) {
  try {
    if (!(await tableExists(env, 'notification_preferences'))) return;
    await env.DB.prepare(`
      INSERT INTO notification_preferences (user_id, push_enabled, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        push_enabled = excluded.push_enabled,
        updated_at = datetime('now')
    `).bind(userId, enabled ? 1 : 0).run();
  } catch {
    // Preferences are helpful, but the subscription should still save if this fails.
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const readyError = await ensureReady(env);
    if (readyError) return json({ ok: false, ready: false, error: readyError }, 400);

    const rows = await env.DB.prepare(`
      SELECT id, endpoint, device_label, user_agent, status, created_at, updated_at, last_seen_at
      FROM push_subscriptions
      WHERE user_id = ?
      ORDER BY datetime(updated_at) DESC, id DESC
      LIMIT 12
    `).bind(user.id).all();

    const pref = await env.DB.prepare(`
      SELECT push_enabled FROM notification_preferences WHERE user_id = ? LIMIT 1
    `).bind(user.id).first().catch(() => null);

    return json({
      ok: true,
      ready: true,
      push_enabled: pref ? Boolean(pref.push_enabled) : (rows.results || []).some((row) => row.status === 'active'),
      subscriptions: (rows.results || []).map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        endpoint_tail: String(row.endpoint || '').slice(-18),
        device_label: row.device_label,
        user_agent: row.user_agent,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_seen_at: row.last_seen_at,
      })),
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load push subscription.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const readyError = await ensureReady(env);
    if (readyError) return json({ error: readyError }, 400);

    const body = await request.json().catch(() => null);
    if (!body || !body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return json({ error: 'Invalid push subscription.' }, 400);
    }

    const endpoint = clean(body.endpoint, 1200);
    const p256dh = clean(body.keys.p256dh, 260);
    const auth = clean(body.keys.auth, 120);
    const userAgent = clean(request.headers.get('user-agent'), 600);
    const label = clean(body.device_label || deviceLabel(userAgent), 80);

    await env.DB.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, device_label, status, updated_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        device_label = excluded.device_label,
        status = 'active',
        updated_at = datetime('now'),
        last_seen_at = datetime('now')
    `).bind(user.id, endpoint, p256dh, auth, userAgent, label).run();

    await setPushPreference(env, user.id, true);
    return json({ ok: true, enabled: true, device_label: label });
  } catch (error) {
    return json({ error: error?.message || 'Could not save push subscription.' }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user || user.status !== 'active') return json({ error: 'Not logged in.' }, 401);

    const readyError = await ensureReady(env);
    if (readyError) return json({ error: readyError }, 400);

    const body = await request.json().catch(() => ({}));
    const endpoint = clean(body.endpoint, 1200);

    if (endpoint) {
      await env.DB.prepare(`
        UPDATE push_subscriptions
        SET status = 'disabled', updated_at = datetime('now')
        WHERE user_id = ? AND endpoint = ?
      `).bind(user.id, endpoint).run();
    } else {
      await env.DB.prepare(`
        UPDATE push_subscriptions
        SET status = 'disabled', updated_at = datetime('now')
        WHERE user_id = ?
      `).bind(user.id).run();
    }

    await setPushPreference(env, user.id, false);
    return json({ ok: true, enabled: false });
  } catch (error) {
    return json({ error: error?.message || 'Could not disable push notifications.' }, 500);
  }
}
