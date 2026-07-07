import { json, getUserFromRequest, canManageRecruitment } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const result = await env.DB.prepare(`
      SELECT
        feed_posts.id,
        feed_posts.title,
        feed_posts.body,
        feed_posts.media_url,
        feed_posts.status,
        feed_posts.review_note,
        feed_posts.reviewed_at,
        feed_posts.published_at,
        feed_posts.created_at,
        author.full_name AS author_name,
        author.email AS author_email,
        author.role AS author_role,
        reviewer.full_name AS reviewer_name
      FROM feed_posts
      JOIN users AS author ON author.id = feed_posts.author_id
      LEFT JOIN users AS reviewer ON reviewer.id = feed_posts.reviewed_by
      ORDER BY
        CASE feed_posts.status WHEN 'pending' THEN 0 WHEN 'published' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END,
        datetime(feed_posts.created_at) DESC
      LIMIT 200
    `).all();

    return json({ posts: result.results || [] });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('no such table') || msg.includes('feed_posts')) {
      return json({ error: 'Feed database table is missing. Run database/sprint4-3-dashboard-feed.sql in D1 first.' }, 500);
    }
    return json({ error: error?.message || 'Could not load feed submissions.' }, 500);
  }
}
