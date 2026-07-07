import { json, getUserFromRequest, canManageRecruitment } from '../../lib/auth.js';

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

async function loadApplications(env) {
  try {
    return await env.DB.prepare(APPLICATION_FIELDS_WITH_ARCHIVE).all();
  } catch (error) {
    if (!String(error?.message || '').includes('archived_at')) throw error;
    return await env.DB.prepare(APPLICATION_FIELDS_LEGACY).all();
  }
}

async function attachInvites(env, applications) {
  if (!applications.length) return applications;

  try {
    const result = await env.DB.prepare(`
      SELECT id, token, application_id, email, role, status, expires_at, used_at, created_at
      FROM invites
      WHERE application_id IS NOT NULL
      ORDER BY datetime(created_at) DESC
    `).all();

    const latestByApplication = new Map();
    for (const invite of result.results || []) {
      if (!latestByApplication.has(invite.application_id)) {
        latestByApplication.set(invite.application_id, invite);
      }
    }

    return applications.map((app) => {
      const invite = latestByApplication.get(app.id);
      if (!invite) {
        return {
          ...app,
          invite_token: null,
          invite_status: null,
          invite_expires_at: null,
          invite_used_at: null,
          invite_created_at: null,
        };
      }

      return {
        ...app,
        invite_token: invite.token,
        invite_status: invite.status,
        invite_expires_at: invite.expires_at,
        invite_used_at: invite.used_at,
        invite_created_at: invite.created_at,
      };
    });
  } catch (error) {
    // Sprint 3 migration may not have been run yet. Keep Recruitment usable.
    if (String(error?.message || '').includes('no such table') || String(error?.message || '').includes('invites')) {
      return applications.map((app) => ({
        ...app,
        invite_token: null,
        invite_status: null,
        invite_expires_at: null,
        invite_used_at: null,
        invite_created_at: null,
      }));
    }
    throw error;
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserFromRequest(env, request);
    if (!canManageRecruitment(user)) return json({ error: 'Owner or manager access required.' }, 403);

    const result = await loadApplications(env);
    const applications = await attachInvites(env, result.results || []);

    return json({ applications });
  } catch (error) {
    return json({ error: error?.message || 'Could not load applications.' }, 500);
  }
}
