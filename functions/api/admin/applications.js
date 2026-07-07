import { json, getUserFromRequest, canManageRecruitment } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const result = await env.DB.prepare(`
      SELECT
        id,
        full_name,
        email,
        discord_username,
        tiktok,
        instagram,
        youtube,
        experience,
        why_join,
        status,
        reviewed_by,
        reviewed_at,
        created_at
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
