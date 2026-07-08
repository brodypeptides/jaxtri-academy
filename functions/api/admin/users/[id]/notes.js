import { json, getUserFromRequest } from '../../../../lib/auth.js';

function clean(value) { return String(value ?? '').trim(); }
function isStaff(user) { return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager'); }
function isOwner(user) { return user && user.status === 'active' && user.role === 'owner'; }

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first();
  return Boolean(row);
}

async function getTarget(env, id) {
  return await env.DB.prepare('SELECT id, role, email FROM users WHERE id = ? LIMIT 1').bind(id).first();
}

export async function onRequestPost({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);
    if (!(await tableExists(env, 'admin_user_notes'))) {
      return json({ error: 'Admin notes table missing. Run the Sprint 7-9 migration first.' }, 400);
    }

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);

    const target = await getTarget(env, id);
    if (!target) return json({ error: 'User not found.' }, 404);
    if (target.role === 'owner' && !isOwner(actor)) return json({ error: 'Only owners can add notes to owner profiles.' }, 403);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const note = clean(body.note).slice(0, 2000);
    const noteType = clean(body.note_type || 'general').toLowerCase();
    const pinned = body.is_pinned ? 1 : 0;
    if (!note) return json({ error: 'Enter a note first.' }, 400);
    if (!['general','onboarding','commission','payout','risk','success'].includes(noteType)) return json({ error: 'Invalid note type.' }, 400);

    const result = await env.DB.prepare(`
      INSERT INTO admin_user_notes (target_user_id, author_id, note, note_type, is_pinned)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, actor.id, note, noteType, pinned).run();

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'add_admin_note', ?)
      `).bind(actor.id, id, JSON.stringify({ note_id: result.meta?.last_row_id || null, note_type: noteType, is_pinned: Boolean(pinned) })).run();
    } catch {}

    return json({ ok: true, note_id: result.meta?.last_row_id || null });
  } catch (error) {
    return json({ error: error?.message || 'Could not add note.' }, 500);
  }
}
