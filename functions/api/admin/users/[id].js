import { json, getUserFromRequest } from '../../../lib/auth.js';

function isOwner(user) {
  return user && user.status === 'active' && user.role === 'owner';
}

function clean(value) {
  return String(value || '').trim();
}

async function logAudit(env, actorId, targetUserId, action, details) {
  try {
    await env.DB.prepare(`
      INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
      VALUES (?, ?, ?, ?)
    `).bind(actorId, targetUserId, action, JSON.stringify(details || {})).run();
  } catch {
    // Audit table is helpful, but user management should still work if the migration has not been run yet.
  }
}

async function getTarget(env, id) {
  return await env.DB.prepare(`
    SELECT id, full_name, email, username, role, company_title, status, created_at, updated_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isOwner(actor)) return json({ error: 'Owner access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);

    const target = await getTarget(env, id);
    if (!target) return json({ error: 'User not found.' }, 404);

    if (target.role === 'owner') {
      return json({ error: 'Owner accounts are protected from web-panel changes. Use D1 command-line SQL for owner changes.' }, 403);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const updates = [];
    const binds = [];
    const changes = {};

    if (Object.prototype.hasOwnProperty.call(body, 'role')) {
      const role = clean(body.role).toLowerCase();
      if (!['affiliate', 'manager'].includes(role)) {
        return json({ error: 'Role can only be changed to affiliate or manager in the panel. Owner changes are command-line only.' }, 400);
      }
      if (role !== target.role) {
        updates.push('role = ?');
        binds.push(role);
        changes.role = { from: target.role, to: role };
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = clean(body.status).toLowerCase();
      if (!['active', 'pending', 'suspended'].includes(status)) {
        return json({ error: 'Invalid user status.' }, 400);
      }
      if (Number(target.id) === Number(actor.id) && status !== 'active') {
        return json({ error: 'You cannot suspend or deactivate your own account from the panel.' }, 403);
      }
      if (status !== target.status) {
        updates.push('status = ?');
        binds.push(status);
        changes.status = { from: target.status, to: status };
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'company_title')) {
      const title = clean(body.company_title).slice(0, 90);
      const nextTitle = title || null;
      if ((target.company_title || null) !== nextTitle) {
        updates.push('company_title = ?');
        binds.push(nextTitle);
        changes.company_title = { from: target.company_title || '', to: title };
      }
    }

    if (!updates.length) {
      return json({ ok: true, user: target, changed: false });
    }

    updates.push("updated_at = datetime('now')");
    await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds, id).run();
    await logAudit(env, actor.id, id, 'update_user', changes);

    const updated = await getTarget(env, id);
    return json({ ok: true, user: updated, changed: true, changes });
  } catch (error) {
    return json({ error: error?.message || 'Could not update user.' }, 500);
  }
}
