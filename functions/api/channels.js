import { json } from '../lib/auth.js';
import {
  requireActiveUser,
  touchPresence,
  clean,
  canAccessChannel,
  canCreateChannel,
  missingSprint4,
  sprint4MissingResponse,
} from '../lib/team.js';

function slugify(name) {
  return clean(name, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export async function onRequestGet({ request, env }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);

    const result = await env.DB.prepare(`
      SELECT
        channels.id,
        channels.name,
        channels.slug,
        channels.description,
        channels.access_role,
        channels.status,
        channels.created_at,
        channel_reads.last_read_at,
        (
          SELECT COUNT(*)
          FROM channel_messages
          WHERE channel_messages.channel_id = channels.id
            AND channel_messages.sender_id != ?
            AND (
              channel_reads.last_read_at IS NULL
              OR datetime(channel_messages.created_at) > datetime(channel_reads.last_read_at)
            )
        ) AS unread_count,
        (
          SELECT channel_messages.body
          FROM channel_messages
          WHERE channel_messages.channel_id = channels.id
          ORDER BY datetime(channel_messages.created_at) DESC, channel_messages.id DESC
          LIMIT 1
        ) AS latest_body,
        (
          SELECT channel_messages.created_at
          FROM channel_messages
          WHERE channel_messages.channel_id = channels.id
          ORDER BY datetime(channel_messages.created_at) DESC, channel_messages.id DESC
          LIMIT 1
        ) AS latest_at
      FROM channels
      LEFT JOIN channel_reads
        ON channel_reads.channel_id = channels.id
       AND channel_reads.user_id = ?
      WHERE channels.status = 'active'
      ORDER BY
        CASE channels.slug WHEN 'general' THEN 0 WHEN 'leadership' THEN 1 ELSE 2 END,
        lower(channels.name)
    `).bind(user.id, user.id).all();

    const channels = (result.results || [])
      .filter(channel => canAccessChannel(user, channel))
      .map(channel => ({ ...channel, unread_count: Number(channel.unread_count || 0) }));

    return json({ channels });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    return json({ error: error?.message || 'Could not load channels.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const { user, response } = await requireActiveUser(env, request);
    if (response) return response;
    await touchPresence(env, user.id);
    if (!canCreateChannel(user)) return json({ error: 'Only owners and managers can create channels.' }, 403);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid channel request.' }, 400);

    const name = clean(body.name, 80);
    const description = clean(body.description, 300);
    const accessRole = clean(body.access_role || 'all', 20);
    const slug = slugify(name);

    if (!name || !slug) return json({ error: 'Channel name is required.' }, 400);
    if (!['all', 'staff'].includes(accessRole)) return json({ error: 'Invalid channel access.' }, 400);

    await env.DB.prepare(`
      INSERT INTO channels (name, slug, description, access_role, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(name, slug, description, accessRole, user.id).run();

    const channel = await env.DB.prepare(`
      SELECT id, name, slug, description, access_role, status, created_at
      FROM channels
      WHERE slug = ?
      LIMIT 1
    `).bind(slug).first();

    return json({ ok: true, channel });
  } catch (error) {
    if (missingSprint4(error)) return sprint4MissingResponse();
    if (String(error?.message || '').includes('UNIQUE')) return json({ error: 'A channel with that name already exists.' }, 409);
    return json({ error: error?.message || 'Could not create channel.' }, 500);
  }
}
