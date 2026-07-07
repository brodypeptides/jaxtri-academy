import { json } from '../lib/auth.js';
import { requireActiveUser, touchPresence, isStaff, missingSprint4, sprint4MissingResponse } from '../lib/team.js';

function statusFromLastSeen(lastSeen) {
  if (!lastSeen) return 'offline';
  const then = new Date(String(lastSeen).replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(then)) return 'offline';
  const diff = Date.now() - then;
  if (diff < 2 * 60 * 1000) return 'online';
  if (diff < 15 * 60 * 1000) return 'away';
  return 'offline';
}

function canMessage(currentUser, member) {
  if (!currentUser || !member || currentUser.id === member.id) return false;
  if (isStaff(currentUser)) return true;
  return member.role === 'owner' || member.role === 'manager';
}

export async function onRequestGet({ request, env }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);

    const usersResult = await env.DB.prepare(`
      SELECT
        users.id,
        users.full_name,
        users.email,
        users.username,
        users.role,
        users.company_title,
        users.status,
        user_presence.last_seen_at
      FROM users
      LEFT JOIN user_presence ON user_presence.user_id = users.id
      WHERE users.status = 'active'
      ORDER BY
        CASE users.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
        lower(users.full_name)
    `).all();

    const unreadResult = await env.DB.prepare(`
      SELECT sender_id, COUNT(*) AS count
      FROM direct_messages
      WHERE receiver_id = ?
        AND read_at IS NULL
      GROUP BY sender_id
    `).bind(user.id).all();

    const unreadBySender = new Map((unreadResult.results || []).map(row => [Number(row.sender_id), Number(row.count || 0)]));

    const members = (usersResult.results || []).map(member => ({
      id: member.id,
      full_name: member.full_name,
      email: member.email,
      username: member.username,
      role: member.role,
      company_title: member.company_title,
      status: member.status,
      last_seen_at: member.last_seen_at,
      presence: statusFromLastSeen(member.last_seen_at),
      can_message: canMessage(user, member),
      unread_count: unreadBySender.get(Number(member.id)) || 0,
      is_self: Number(member.id) === Number(user.id),
    }));

    return json({ user, members });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    return json({ error: error?.message || 'Could not load roster.' }, 500);
  }
}
