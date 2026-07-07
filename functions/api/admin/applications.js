import { json, getUserFromRequest } from '../../lib/auth.js';

function canManage(user) {
  return user && (user.role === 'owner' || user.role === 'manager');
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManage(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const result = await env.DB.prepare(`
      SELECT id, full_name, email, discord_username, tiktok, instagram, youtube, experience, why_join, status, review_note, reviewed_by, reviewed_at, created_at
      FROM applications
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        datetime(created_at) DESC
    `).all();

    return json({ applications: result.results || [] });
  } catch (error) {
    return json({ error: error?.message || 'Could not load applications.' }, 500);
  }
}
