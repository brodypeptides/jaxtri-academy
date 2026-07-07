import { json } from '../../../lib/auth.js';
import {
  requireActiveUser,
  touchPresence,
  clean,
  cleanUrl,
  canAccessChannel,
  missingSprint4,
  sprint4MissingResponse,
} from '../../../lib/team.js';

async function getChannel(env, id) {
  return await env.DB.prepare(`
    SELECT id, name, slug, description, access_role, status, created_at
    FROM channels
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
}

export async function onRequestGet({ request, env, params }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);

    const channelId = Number(params.id);
    const channel = await getChannel(env, channelId);
    if (!canAccessChannel(user, channel)) return json({ error: 'You cannot access this channel.' }, 403);

    const result = await env.DB.prepare(`
      SELECT
        channel_messages.id,
        channel_messages.channel_id,
        channel_messages.sender_id,
        channel_messages.body,
        channel_messages.attachment_url,
        channel_messages.attachment_name,
        channel_messages.created_at,
        users.full_name AS sender_name,
        users.role AS sender_role
      FROM channel_messages
      JOIN users ON users.id = channel_messages.sender_id
      WHERE channel_messages.channel_id = ?
      ORDER BY datetime(channel_messages.created_at) ASC, channel_messages.id ASC
      LIMIT 200
    `).bind(channelId).all();

    await env.DB.prepare(`
      INSERT INTO channel_reads (channel_id, user_id, last_read_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(channel_id, user_id) DO UPDATE SET
        last_read_at = datetime('now')
    `).bind(channelId, user.id).run();

    return json({ channel, messages: result.results || [] });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    return json({ error: error?.message || 'Could not load channel messages.' }, 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);

    const channelId = Number(params.id);
    const channel = await getChannel(env, channelId);
    if (!canAccessChannel(user, channel)) return json({ error: 'You cannot access this channel.' }, 403);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid message.' }, 400);

    const text = clean(body.body, 4000);
    const attachmentUrl = cleanUrl(body.attachment_url);
    const attachmentName = clean(body.attachment_name, 180) || (attachmentUrl ? 'Shared link' : '');

    if (!text && !attachmentUrl) return json({ error: 'Type a message or add a link/file URL.' }, 400);
    if (body.attachment_url && !attachmentUrl) return json({ error: 'Attachment URL must start with http:// or https://.' }, 400);

    await env.DB.prepare(`
      INSERT INTO channel_messages (channel_id, sender_id, body, attachment_url, attachment_name)
      VALUES (?, ?, ?, ?, ?)
    `).bind(channelId, user.id, text, attachmentUrl, attachmentName).run();

    await env.DB.prepare(`
      INSERT INTO channel_reads (channel_id, user_id, last_read_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(channel_id, user_id) DO UPDATE SET
        last_read_at = datetime('now')
    `).bind(channelId, user.id).run();

    const message = await env.DB.prepare(`
      SELECT
        channel_messages.id,
        channel_messages.channel_id,
        channel_messages.sender_id,
        channel_messages.body,
        channel_messages.attachment_url,
        channel_messages.attachment_name,
        channel_messages.created_at,
        users.full_name AS sender_name,
        users.role AS sender_role
      FROM channel_messages
      JOIN users ON users.id = channel_messages.sender_id
      WHERE channel_messages.channel_id = ?
      ORDER BY channel_messages.id DESC
      LIMIT 1
    `).bind(channelId).first();

    return json({ ok: true, message });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    return json({ error: error?.message || 'Could not send channel message.' }, 500);
  }
}
