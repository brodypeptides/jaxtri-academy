import { json } from '../../lib/auth.js';
import {
  requireActiveUser,
  touchPresence,
  clean,
  cleanUrl,
  canMessageUser,
  missingSprint4,
  sprint4MissingResponse,
} from '../../lib/team.js';

async function getReceiver(env, id) {
  return await env.DB.prepare(`
    SELECT id, full_name, email, username, role, company_title, status
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
}

export async function onRequestGet({ request, env }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);

    const url = new URL(request.url);
    const otherId = Number(url.searchParams.get('user_id'));
    if (!otherId) return json({ error: 'Missing user_id.' }, 400);

    const other = await getReceiver(env, otherId);
    if (!canMessageUser(user, other)) return json({ error: 'You cannot message this member.' }, 403);

    await env.DB.prepare(`
      UPDATE direct_messages
      SET read_at = COALESCE(read_at, datetime('now'))
      WHERE sender_id = ?
        AND receiver_id = ?
        AND read_at IS NULL
    `).bind(otherId, user.id).run();

    const result = await env.DB.prepare(`
      SELECT
        direct_messages.id,
        direct_messages.sender_id,
        direct_messages.receiver_id,
        direct_messages.body,
        direct_messages.attachment_url,
        direct_messages.attachment_name,
        direct_messages.read_at,
        direct_messages.created_at,
        users.full_name AS sender_name,
        users.role AS sender_role
      FROM direct_messages
      JOIN users ON users.id = direct_messages.sender_id
      WHERE
        (direct_messages.sender_id = ? AND direct_messages.receiver_id = ?)
        OR
        (direct_messages.sender_id = ? AND direct_messages.receiver_id = ?)
      ORDER BY datetime(direct_messages.created_at) ASC, direct_messages.id ASC
      LIMIT 150
    `).bind(user.id, otherId, otherId, user.id).all();

    return json({ conversation_with: other, messages: result.results || [] });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    return json({ error: error?.message || 'Could not load messages.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid message.' }, 400);

    const receiverId = Number(body.receiver_id);
    const receiver = await getReceiver(env, receiverId);
    if (!canMessageUser(user, receiver)) return json({ error: 'You cannot message this member.' }, 403);

    const text = clean(body.body, 4000);
    const attachmentUrl = cleanUrl(body.attachment_url);
    const attachmentName = clean(body.attachment_name, 180) || (attachmentUrl ? 'Shared link' : '');

    if (!text && !attachmentUrl) return json({ error: 'Type a message or add a link/file URL.' }, 400);
    if (body.attachment_url && !attachmentUrl) return json({ error: 'Attachment URL must start with http:// or https://.' }, 400);

    await env.DB.prepare(`
      INSERT INTO direct_messages (sender_id, receiver_id, body, attachment_url, attachment_name)
      VALUES (?, ?, ?, ?, ?)
    `).bind(user.id, receiverId, text, attachmentUrl, attachmentName).run();

    const message = await env.DB.prepare(`
      SELECT
        direct_messages.id,
        direct_messages.sender_id,
        direct_messages.receiver_id,
        direct_messages.body,
        direct_messages.attachment_url,
        direct_messages.attachment_name,
        direct_messages.read_at,
        direct_messages.created_at,
        users.full_name AS sender_name,
        users.role AS sender_role
      FROM direct_messages
      JOIN users ON users.id = direct_messages.sender_id
      WHERE direct_messages.sender_id = ?
        AND direct_messages.receiver_id = ?
      ORDER BY direct_messages.id DESC
      LIMIT 1
    `).bind(user.id, receiverId).first();

    return json({ ok: true, message });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    return json({ error: error?.message || 'Could not send message.' }, 500);
  }
}
