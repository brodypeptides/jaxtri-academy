import { json, getUserFromRequest } from '../../lib/auth.js';

function canManage(user) {
  return user && (user.role === 'owner' || user.role === 'manager');
}

const APPLICATION_FIELDS_WITH_ARCHIVE = `
  SELECT id, full_name, email, discord_username, tiktok, instagram, youtube,
         experience, why_join, status, review_note, reviewed_by, reviewed_at,
         archived_at, created_at
  FROM applications
  ORDER BY
    CASE WHEN archived_at IS NOT NULL THEN 3
         WHEN status = 'pending' THEN 0
         WHEN status = 'approved' THEN 1
         WHEN status = 'rejected' THEN 2
         ELSE 4 END,
    datetime(created_at) DESC
`;

const APPLICATION_FIELDS_LEGACY = `
  SELECT id, full_name, email, discord_username, tiktok, instagram, youtube,
         experience, why_join, status, review_note, reviewed_by, reviewed_at,
         NULL AS archived_at, created_at
  FROM applications
  ORDER BY
    CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END,
    datetime(created_at) DESC
`;

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManage(user)) return json({ error: 'Owner or manager access required.' }, 403);

    let result;
    try {
      result = await env.DB.prepare(APPLICATION_FIELDS_WITH_ARCHIVE).all();
    } catch (error) {
      if (!String(error?.message || '').includes('archived_at')) throw error;
      result = await env.DB.prepare(APPLICATION_FIELDS_LEGACY).all();
    }

    return json({ applications: result.results || [] });
  } catch (error) {
    return json({ error: error?.message || 'Could not load applications.' }, 500);
  }
}
