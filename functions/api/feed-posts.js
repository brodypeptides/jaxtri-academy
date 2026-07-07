import { json, getUserFromRequest } from '../lib/auth.js';

function clean(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function looksLikeUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function getPublished(env) {
  return env.DB.prepare(`
    SELECT
      feed_posts.id,
      feed_posts.title,
      feed_posts.body,
      feed_posts.media_url,
      feed_posts.status,
      feed_posts.published_at,
      feed_posts.created_at,
      users.full_name AS author_name,
      users.role AS author_role,
      users.company_title AS author_title
    FROM feed_posts
    JOIN users ON users.id = feed_posts.author_id
    WHERE feed_posts.status = 'published'
    ORDER BY datetime(COALESCE(feed_posts.published_at, feed_posts.created_at)) DESC
    LIMIT 60
  `).all();
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user) return json({ error: 'Not logged in.' }, 401);

    const result = await getPublished(env);
    return json({ posts: result.results || [] });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('no such table') || msg.includes('feed_posts')) {
      return json({ error: 'Feed database table is missing. Run database/sprint4-3-dashboard-feed.sql in D1 first.' }, 500);
    }
    return json({ error: error?.message || 'Could not load feed.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!user) return json({ error: 'Not logged in.' }, 401);
    if (user.status !== 'active') return json({ error: 'Account must be active to submit a post.' }, 403);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid post.' }, 400);

    const title = clean(body.title, 120);
    const postBody = clean(body.body, 3000);
    const mediaUrl = clean(body.media_url, 1000);

    if (!title) return json({ error: 'Add a short title.' }, 400);
    if (!postBody) return json({ error: 'Write something before submitting.' }, 400);
    if (!looksLikeUrl(mediaUrl)) return json({ error: 'Media URL must start with http:// or https://.' }, 400);

    await env.DB.prepare(`
      INSERT INTO feed_posts (author_id, title, body, media_url, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).bind(user.id, title, postBody, mediaUrl || null).run();

    return json({ ok: true, message: 'Post submitted for review.' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('no such table') || msg.includes('feed_posts')) {
      return json({ error: 'Feed database table is missing. Run database/sprint4-3-dashboard-feed.sql in D1 first.' }, 500);
    }
    return json({ error: error?.message || 'Could not submit post.' }, 500);
  }
}
