import { json, getUserFromRequest } from '../../../../lib/auth.js';

function isOwner(user) {
  return user && user.status === 'active' && user.role === 'owner';
}

function clean(value) {
  return String(value || '').trim();
}

async function tableExists(env, name) {
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first();
    return Boolean(row);
  } catch {
    return false;
  }
}

async function columnExists(env, table, column) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (result.results || []).some((row) => row.name === column);
  } catch {
    return false;
  }
}

async function runIfTable(env, table, sql, binds = []) {
  if (!(await tableExists(env, table))) return { skipped: true, table };
  const result = await env.DB.prepare(sql).bind(...binds).run();
  return { skipped: false, table, changes: result.meta?.changes || 0 };
}

async function runIfColumn(env, table, column, sql, binds = []) {
  if (!(await tableExists(env, table))) return { skipped: true, table };
  if (!(await columnExists(env, table, column))) return { skipped: true, table, column };
  const result = await env.DB.prepare(sql).bind(...binds).run();
  return { skipped: false, table, column, changes: result.meta?.changes || 0 };
}

async function logAudit(env, actorId, targetUserId, action, details) {
  try {
    if (!(await tableExists(env, 'admin_audit_log'))) return;
    await env.DB.prepare(`
      INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
      VALUES (?, ?, ?, ?)
    `).bind(actorId, targetUserId, action, JSON.stringify(details || {})).run();
  } catch {
    // Non-blocking.
  }
}

export async function onRequestPost({ request, env, params }) {
  const actions = [];

  try {
    const actor = await getUserFromRequest(env, request);
    if (!isOwner(actor)) return json({ error: 'Owner access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);

    const target = await env.DB.prepare(`
      SELECT id, full_name, email, username, role, status
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!target) return json({ error: 'User not found.' }, 404);
    if (Number(target.id) === Number(actor.id)) return json({ error: 'You cannot delete your own account from the web panel.' }, 403);
    if (target.role === 'owner') return json({ error: 'Owner accounts are protected. Owner removal is command-line only.' }, 403);

    const body = await request.json().catch(() => ({}));
    const confirmEmail = clean(body.confirm_email).toLowerCase();
    const targetEmail = clean(target.email).toLowerCase();
    if (!confirmEmail || confirmEmail !== targetEmail) {
      return json({ error: 'Confirmation email did not match.' }, 400);
    }

    await logAudit(env, actor.id, target.id, 'delete_user_started', {
      email: target.email,
      role: target.role,
      username: target.username,
    });

    // Remove or detach records that can reference this user before deleting the user row.
    actions.push(await runIfTable(env, 'sessions', 'DELETE FROM sessions WHERE user_id = ?', [id]));
    actions.push(await runIfTable(env, 'user_presence', 'DELETE FROM user_presence WHERE user_id = ?', [id]));
    actions.push(await runIfTable(env, 'direct_messages', 'DELETE FROM direct_messages WHERE sender_id = ? OR receiver_id = ?', [id, id]));
    actions.push(await runIfTable(env, 'channel_reads', 'DELETE FROM channel_reads WHERE user_id = ?', [id]));
    actions.push(await runIfTable(env, 'channel_messages', 'DELETE FROM channel_messages WHERE sender_id = ?', [id]));
    actions.push(await runIfColumn(env, 'channels', 'created_by', 'UPDATE channels SET created_by = NULL WHERE created_by = ?', [id]));

    actions.push(await runIfColumn(env, 'applications', 'reviewed_by', 'UPDATE applications SET reviewed_by = NULL WHERE reviewed_by = ?', [id]));
    actions.push(await runIfColumn(env, 'invites', 'used_by', 'UPDATE invites SET used_by = NULL WHERE used_by = ?', [id]));
    actions.push(await runIfColumn(env, 'invites', 'created_by', 'UPDATE invites SET created_by = NULL WHERE created_by = ?', [id]));

    actions.push(await runIfColumn(env, 'feed_posts', 'reviewed_by', 'UPDATE feed_posts SET reviewed_by = NULL WHERE reviewed_by = ?', [id]));
    actions.push(await runIfColumn(env, 'feed_posts', 'author_id', 'DELETE FROM feed_posts WHERE author_id = ?', [id]));

    actions.push(await runIfColumn(env, 'affiliate_codes', 'created_by', 'UPDATE affiliate_codes SET created_by = NULL WHERE created_by = ?', [id]));
    actions.push(await runIfTable(env, 'affiliate_codes', 'DELETE FROM affiliate_codes WHERE user_id = ?', [id]));

    actions.push(await runIfTable(env, 'payout_request_sales', `
      DELETE FROM payout_request_sales
      WHERE sale_id IN (SELECT id FROM affiliate_sales WHERE affiliate_user_id = ?)
    `, [id]));
    actions.push(await runIfColumn(env, 'affiliate_sales', 'created_by', 'UPDATE affiliate_sales SET created_by = NULL WHERE created_by = ?', [id]));
    actions.push(await runIfColumn(env, 'affiliate_sales', 'status_updated_by', 'UPDATE affiliate_sales SET status_updated_by = NULL WHERE status_updated_by = ?', [id]));
    actions.push(await runIfTable(env, 'affiliate_sales', 'DELETE FROM affiliate_sales WHERE affiliate_user_id = ?', [id]));

    actions.push(await runIfTable(env, 'payout_request_sales', `
      DELETE FROM payout_request_sales
      WHERE payout_request_id IN (SELECT id FROM payout_requests WHERE affiliate_user_id = ?)
    `, [id]));
    actions.push(await runIfColumn(env, 'payout_requests', 'reviewed_by', 'UPDATE payout_requests SET reviewed_by = NULL WHERE reviewed_by = ?', [id]));
    actions.push(await runIfColumn(env, 'payout_requests', 'paid_by', 'UPDATE payout_requests SET paid_by = NULL WHERE paid_by = ?', [id]));
    actions.push(await runIfTable(env, 'payout_requests', 'DELETE FROM payout_requests WHERE affiliate_user_id = ?', [id]));
    actions.push(await runIfTable(env, 'affiliate_payout_profiles', 'DELETE FROM affiliate_payout_profiles WHERE user_id = ?', [id]));

    actions.push(await runIfColumn(env, 'admin_user_notes', 'author_id', 'UPDATE admin_user_notes SET author_id = NULL WHERE author_id = ?', [id]));
    actions.push(await runIfColumn(env, 'admin_user_notes', 'target_user_id', 'DELETE FROM admin_user_notes WHERE target_user_id = ?', [id]));
    actions.push(await runIfColumn(env, 'user_onboarding_items', 'updated_by', 'UPDATE user_onboarding_items SET updated_by = NULL WHERE updated_by = ?', [id]));
    actions.push(await runIfTable(env, 'user_onboarding_items', 'DELETE FROM user_onboarding_items WHERE user_id = ?', [id]));

    actions.push(await runIfColumn(env, 'app_notifications', 'created_by', 'UPDATE app_notifications SET created_by = NULL WHERE created_by = ?', [id]));
    actions.push(await runIfTable(env, 'app_notifications', 'DELETE FROM app_notifications WHERE user_id = ?', [id]));
    actions.push(await runIfTable(env, 'push_subscriptions', 'DELETE FROM push_subscriptions WHERE user_id = ?', [id]));
    actions.push(await runIfTable(env, 'notification_preferences', 'DELETE FROM notification_preferences WHERE user_id = ?', [id]));

    actions.push(await runIfColumn(env, 'admin_audit_log', 'actor_id', 'UPDATE admin_audit_log SET actor_id = NULL WHERE actor_id = ?', [id]));
    actions.push(await runIfColumn(env, 'admin_audit_log', 'target_user_id', 'UPDATE admin_audit_log SET target_user_id = NULL WHERE target_user_id = ?', [id]));

    const deleted = await env.DB.prepare('DELETE FROM users WHERE id = ? AND role != \'owner\'').bind(id).run();
    if (!deleted.meta?.changes) return json({ error: 'User could not be deleted. Refresh and try again.' }, 409);

    await logAudit(env, actor.id, null, 'delete_user_completed', {
      deleted_user_id: id,
      email: target.email,
      role: target.role,
    });

    return json({ ok: true, deleted_user_id: id, email: target.email, actions });
  } catch (error) {
    return json({
      error: error?.message || 'Could not delete user.',
      detail: 'Deletion stopped before removing the user. Share this message if the issue continues.',
      actions,
    }, 500);
  }
}
