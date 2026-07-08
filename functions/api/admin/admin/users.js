import { json, getUserFromRequest } from '../../lib/auth.js';

function isStaff(user) {
  return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager');
}

function isOwner(user) {
  return user && user.status === 'active' && user.role === 'owner';
}

function clean(value) {
  return String(value || '').trim();
}

function minutesSince(value) {
  if (!value) return Infinity;
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  const time = date.getTime();
  if (!Number.isFinite(time)) return Infinity;
  return (Date.now() - time) / 60000;
}

function presenceState(lastSeenAt) {
  const minutes = minutesSince(lastSeenAt);
  if (minutes <= 2) return 'online';
  if (minutes <= 15) return 'away';
  return 'offline';
}

async function tableExists(env, name) {
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
  ).bind(name).first();
  return Boolean(row);
}

async function columnExists(env, table, column) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (result.results || []).some((row) => row.name === column);
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) {
      return json({ error: 'Owner or manager access required for user profiles.' }, 403);
    }

    const url = new URL(request.url);
    const q = clean(url.searchParams.get('q')).toLowerCase();
    const roleFilter = clean(url.searchParams.get('role')).toLowerCase();
    const statusFilter = clean(url.searchParams.get('status')).toLowerCase();
    const hasCommission = await columnExists(env, 'users', 'commission_percentage');
    const hasCodes = await tableExists(env, 'affiliate_codes');
    const commissionSelect = hasCommission ? ', users.commission_percentage' : ', NULL AS commission_percentage';
    const codeSelect = hasCodes ? ', ac.id AS affiliate_code_id, ac.code AS affiliate_code, ac.status AS affiliate_code_status' : ', NULL AS affiliate_code_id, NULL AS affiliate_code, NULL AS affiliate_code_status';
    const codeJoin = hasCodes ? `
      LEFT JOIN affiliate_codes ac ON ac.id = (
        SELECT id
        FROM affiliate_codes
        WHERE user_id = users.id AND status = 'active'
        ORDER BY id DESC
        LIMIT 1
      )
    ` : '';

    const usersResult = await env.DB.prepare(`
      SELECT users.id, users.full_name, users.email, users.username, users.role, users.company_title, users.status, users.created_at, users.updated_at${commissionSelect}${codeSelect}
      FROM users
      ${codeJoin}
      ORDER BY
        CASE users.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
        datetime(users.created_at) DESC
    `).all();

    let users = usersResult.results || [];

    const hasPresence = await tableExists(env, 'user_presence');
    if (hasPresence) {
      const presenceResult = await env.DB.prepare(`
        SELECT user_id, last_seen_at
        FROM user_presence
      `).all();
      const presenceMap = new Map((presenceResult.results || []).map((row) => [Number(row.user_id), row.last_seen_at]));
      users = users.map((user) => {
        const lastSeenAt = presenceMap.get(Number(user.id)) || null;
        return { ...user, last_seen_at: lastSeenAt, presence: presenceState(lastSeenAt) };
      });
    } else {
      users = users.map((user) => ({ ...user, last_seen_at: null, presence: 'offline' }));
    }

    const hasInvites = await tableExists(env, 'invites');
    if (hasInvites) {
      const invitesResult = await env.DB.prepare(`
        SELECT
          lower(email) AS email_key,
          SUM(CASE WHEN status = 'active' AND used_at IS NULL AND expires_at > datetime('now') THEN 1 ELSE 0 END) AS active_invites,
          SUM(CASE WHEN status = 'used' OR used_at IS NOT NULL THEN 1 ELSE 0 END) AS used_invites,
          SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked_invites
        FROM invites
        GROUP BY lower(email)
      `).all();
      const inviteMap = new Map((invitesResult.results || []).map((row) => [row.email_key, row]));
      users = users.map((user) => {
        const inviteStats = inviteMap.get(String(user.email || '').toLowerCase()) || {};
        return {
          ...user,
          active_invites: Number(inviteStats.active_invites || 0),
          used_invites: Number(inviteStats.used_invites || 0),
          revoked_invites: Number(inviteStats.revoked_invites || 0),
        };
      });
    } else {
      users = users.map((user) => ({ ...user, active_invites: 0, used_invites: 0, revoked_invites: 0 }));
    }

    const hasSessions = await tableExists(env, 'sessions');
    if (hasSessions) {
      const sessionsResult = await env.DB.prepare(`
        SELECT user_id, COUNT(*) AS active_sessions
        FROM sessions
        WHERE expires_at > datetime('now')
        GROUP BY user_id
      `).all();
      const sessionMap = new Map((sessionsResult.results || []).map((row) => [Number(row.user_id), Number(row.active_sessions || 0)]));
      users = users.map((user) => ({ ...user, active_sessions: sessionMap.get(Number(user.id)) || 0 }));
    } else {
      users = users.map((user) => ({ ...user, active_sessions: 0 }));
    }

    if (q) {
      users = users.filter((user) => [user.full_name, user.email, user.username, user.company_title, user.affiliate_code]
        .some((value) => String(value || '').toLowerCase().includes(q)));
    }
    if (roleFilter && roleFilter !== 'all') users = users.filter((user) => user.role === roleFilter);
    if (statusFilter && statusFilter !== 'all') users = users.filter((user) => user.status === statusFilter);

    const commissionSet = users.filter((user) => user.commission_percentage !== null && user.commission_percentage !== undefined && user.commission_percentage !== '').length;
    const codeSet = users.filter((user) => String(user.affiliate_code || '').trim()).length;
    const stats = {
      total: users.length,
      owners: users.filter((user) => user.role === 'owner').length,
      managers: users.filter((user) => user.role === 'manager').length,
      affiliates: users.filter((user) => user.role === 'affiliate').length,
      active: users.filter((user) => user.status === 'active').length,
      pending: users.filter((user) => user.status === 'pending').length,
      suspended: users.filter((user) => user.status === 'suspended').length,
      online: users.filter((user) => user.presence === 'online').length,
      commission_set: commissionSet,
      code_set: codeSet,
    };

    return json({
      users,
      stats,
      viewer: {
        role: actor.role,
        can_edit_users: isOwner(actor),
        can_edit_commission: isOwner(actor),
        can_edit_affiliate_codes: isStaff(actor),
        can_edit_owner_codes: isOwner(actor),
        commission_ready: hasCommission,
        affiliate_codes_ready: hasCodes,
      },
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load users.' }, 500);
  }
}
