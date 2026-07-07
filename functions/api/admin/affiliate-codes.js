import { json, getUserFromRequest, randomId } from '../../lib/auth.js';

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

function clean(value) { return String(value || '').trim(); }

function normalizeCode(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function baseCode(user) {
  const raw = normalizeCode(user.username || user.full_name || user.email || 'AFF');
  return (raw || 'AFF').slice(0, 18);
}

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .bind(name)
    .first();
  return Boolean(row);
}

async function uniqueCode(env, user, requested) {
  const wanted = normalizeCode(requested);
  if (wanted) {
    if (wanted.length < 3) throw new Error('Affiliate code must be at least 3 characters.');
    const taken = await env.DB.prepare('SELECT id, user_id FROM affiliate_codes WHERE code = ? LIMIT 1').bind(wanted).first();
    if (taken && Number(taken.user_id) !== Number(user.id)) throw new Error('That affiliate code is already taken.');
    return wanted;
  }

  for (let i = 0; i < 8; i++) {
    const candidate = normalizeCode(`${baseCode(user)}-${randomId(3).slice(0, 4)}`);
    const taken = await env.DB.prepare('SELECT id FROM affiliate_codes WHERE code = ? LIMIT 1').bind(candidate).first();
    if (!taken) return candidate;
  }
  throw new Error('Could not generate a unique affiliate code. Try a custom code.');
}

export async function onRequestGet({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    if (!(await tableExists(env, 'affiliate_codes'))) {
      return json({ error: 'Sprint 6A affiliate code table missing. Run database/sprint6a-commission-dashboard.sql in D1 first.', setup_required: true }, 400);
    }

    const result = await env.DB.prepare(`
      SELECT
        users.id AS user_id,
        users.full_name,
        users.email,
        users.username,
        users.role,
        users.status AS user_status,
        users.commission_percentage,
        ac.id AS code_id,
        ac.code,
        ac.status AS code_status,
        ac.created_at,
        ac.updated_at
      FROM users
      LEFT JOIN affiliate_codes ac ON ac.user_id = users.id
      WHERE users.role IN ('affiliate','manager')
      ORDER BY users.role DESC, lower(users.full_name), ac.id DESC
    `).all();

    return json({ codes: result.results || [] });
  } catch (error) {
    return json({ error: error?.message || 'Could not load affiliate codes.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    if (!(await tableExists(env, 'affiliate_codes'))) {
      return json({ error: 'Sprint 6A affiliate code table missing. Run database/sprint6a-commission-dashboard.sql in D1 first.' }, 400);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const userId = Number(body.user_id);
    if (!Number.isFinite(userId) || userId < 1) return json({ error: 'Choose a user.' }, 400);

    const target = await env.DB.prepare(`
      SELECT id, full_name, email, username, role, status
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(userId).first();

    if (!target) return json({ error: 'User not found.' }, 404);
    if (!['affiliate', 'manager'].includes(target.role)) return json({ error: 'Affiliate codes can only be created for affiliates/managers.' }, 400);
    if (target.status !== 'active') return json({ error: 'Affiliate code user must be active.' }, 400);

    const code = await uniqueCode(env, target, body.code);
    const existing = await env.DB.prepare('SELECT id FROM affiliate_codes WHERE user_id = ? ORDER BY id DESC LIMIT 1').bind(userId).first();

    if (existing) {
      await env.DB.prepare(`
        UPDATE affiliate_codes
        SET code = ?, status = 'active', updated_at = datetime('now')
        WHERE id = ?
      `).bind(code, existing.id).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO affiliate_codes (user_id, code, status, created_by)
        VALUES (?, ?, 'active', ?)
      `).bind(userId, code, actor.id).run();
    }

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'upsert_affiliate_code', ?)
      `).bind(actor.id, userId, JSON.stringify({ code })).run();
    } catch {}

    return json({ ok: true, code });
  } catch (error) {
    return json({ error: error?.message || 'Could not save affiliate code.' }, 500);
  }
}
