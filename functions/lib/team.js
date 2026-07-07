import { json, getUserFromRequest } from './auth.js';

export function clean(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

export function cleanUrl(value) {
  const raw = clean(value, 1000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function roleRank(role) {
  if (role === 'owner') return 3;
  if (role === 'manager') return 2;
  return 1;
}

export function isStaff(user) {
  return user && (user.role === 'owner' || user.role === 'manager');
}

export function canMessageUser(sender, receiver) {
  if (!sender || !receiver) return false;
  if (sender.id === receiver.id) return false;
  if (sender.status !== 'active' || receiver.status !== 'active') return false;
  if (isStaff(sender)) return true;
  return isStaff(receiver);
}

export function canAccessChannel(user, channel) {
  if (!user || !channel || user.status !== 'active') return false;
  if (channel.status && channel.status !== 'active') return false;
  if (channel.access_role === 'staff') return isStaff(user);
  return true;
}

export function canCreateChannel(user) {
  return isStaff(user);
}

export async function requireActiveUser(env, request) {
  const user = await getUserFromRequest(env, request);
  if (!user) return { user: null, response: json({ error: 'Not logged in.' }, 401) };
  if (user.status !== 'active') return { user, response: json({ error: 'Account is not active.' }, 403) };
  return { user, response: null };
}

export async function touchPresence(env, userId) {
  await env.DB.prepare(`
    INSERT INTO user_presence (user_id, last_seen_at, updated_at)
    VALUES (?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      last_seen_at = datetime('now'),
      updated_at = datetime('now')
  `).bind(userId).run();
}

export function missingSprint4(error) {
  const message = String(error?.message || '');
  return message.includes('no such table') && (
    message.includes('user_presence') ||
    message.includes('direct_messages') ||
    message.includes('channels') ||
    message.includes('channel_messages') ||
    message.includes('channel_reads')
  );
}

export function sprint4MissingResponse() {
  return json({ error: 'Sprint 4 database tables are missing. Run database/sprint4-team-messaging.sql in D1 first.' }, 500);
}
