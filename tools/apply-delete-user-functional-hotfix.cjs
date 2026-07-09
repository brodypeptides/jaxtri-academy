const fs = require('fs');
const path = require('path');

const root = process.cwd();
function writeFile(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Wrote', rel);
}
function replaceInFile(rel, replacements) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.log('Skipped missing file', rel);
    return;
  }
  let text = fs.readFileSync(file, 'utf8');
  let changes = 0;
  for (const [from, to] of replacements) {
    if (text.includes(from)) {
      text = text.split(from).join(to);
      changes += 1;
    }
  }
  fs.writeFileSync(file, text, 'utf8');
  console.log(`Updated ${rel} (${changes} replacement group${changes === 1 ? '' : 's'})`);
}

writeFile('functions/api/admin/users/[id]/delete.js', `import { json, getUserFromRequest } from '../../../../lib/auth.js';

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

async function runIfTable(env, table, sql, binds = []) {
  if (!(await tableExists(env, table))) return { table, skipped: true };
  const result = await env.DB.prepare(sql).bind(...binds).run();
  return { table, changes: result.meta?.changes ?? null };
}

async function updateIfTable(env, table, sql, binds = []) {
  return await runIfTable(env, table, sql, binds);
}

async function logDelete(env, actor, target, steps) {
  try {
    if (!(await tableExists(env, 'admin_audit_log'))) return;
    await env.DB.prepare(`
      INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
      VALUES (?, NULL, ?, ?)
    `).bind(
      actor.id,
      'delete_user',
      JSON.stringify({
        deleted_user_id: target.id,
        deleted_email: target.email,
        deleted_role: target.role,
        steps,
      })
    ).run();
  } catch {
    // Do not block deletion if the audit insert fails after the account is gone.
  }
}

export async function onRequestPost({ request, env, params }) {
  const steps = [];
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isOwner(actor)) return json({ error: 'Owner access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);
    if (Number(actor.id) === Number(id)) return json({ error: 'You cannot delete your own account from the web panel.' }, 403);

    const target = await env.DB.prepare(`
      SELECT id, full_name, email, username, role, status
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!target) return json({ error: 'User not found.' }, 404);
    if (target.role === 'owner') return json({ error: 'Owner accounts are protected. Owner deletion is D1 command-line only.' }, 403);

    const body = await request.json().catch(() => ({}));
    const confirmEmail = clean(body.confirm_email).toLowerCase();
    if (!confirmEmail || confirmEmail !== clean(target.email).toLowerCase()) {
      return json({ error: 'Confirmation email did not match. User was not deleted.' }, 400);
    }

    // Remove dependent rows first so deletion works even when foreign key enforcement is enabled.
    steps.push(await runIfTable(env, 'payout_request_sales', `
      DELETE FROM payout_request_sales
      WHERE payout_request_id IN (SELECT id FROM payout_requests WHERE affiliate_user_id = ?)
         OR sale_id IN (SELECT id FROM affiliate_sales WHERE affiliate_user_id = ?)
    `, [id, id]));

    steps.push(await runIfTable(env, 'payout_requests', 'DELETE FROM payout_requests WHERE affiliate_user_id = ?', [id]));
    steps.push(await runIfTable(env, 'affiliate_sales', 'DELETE FROM affiliate_sales WHERE affiliate_user_id = ?', [id]));
    steps.push(await runIfTable(env, 'affiliate_codes', 'DELETE FROM affiliate_codes WHERE user_id = ?', [id]));
    steps.push(await runIfTable(env, 'affiliate_payout_profiles', 'DELETE FROM affiliate_payout_profiles WHERE user_id = ?', [id]));
    steps.push(await runIfTable(env, 'push_subscriptions', 'DELETE FROM push_subscriptions WHERE user_id = ?', [id]));
    steps.push(await runIfTable(env, 'notification_preferences', 'DELETE FROM notification_preferences WHERE user_id = ?', [id]));
    steps.push(await runIfTable(env, 'user_onboarding_items', 'DELETE FROM user_onboarding_items WHERE user_id = ? OR updated_by = ?', [id, id]));
    steps.push(await runIfTable(env, 'app_notifications', 'DELETE FROM app_notifications WHERE user_id = ?', [id]));
    steps.push(await updateIfTable(env, 'app_notifications', 'UPDATE app_notifications SET created_by = NULL WHERE created_by = ?', [id]));
    steps.push(await runIfTable(env, 'admin_user_notes', 'DELETE FROM admin_user_notes WHERE target_user_id = ?', [id]));
    steps.push(await updateIfTable(env, 'admin_user_notes', 'UPDATE admin_user_notes SET author_id = NULL WHERE author_id = ?', [id]));

    steps.push(await runIfTable(env, 'sessions', 'DELETE FROM sessions WHERE user_id = ?', [id]));
    steps.push(await runIfTable(env, 'user_presence', 'DELETE FROM user_presence WHERE user_id = ?', [id]));
    steps.push(await runIfTable(env, 'direct_messages', 'DELETE FROM direct_messages WHERE sender_id = ? OR receiver_id = ?', [id, id]));
    steps.push(await runIfTable(env, 'channel_reads', 'DELETE FROM channel_reads WHERE user_id = ?', [id]));
    steps.push(await runIfTable(env, 'channel_messages', 'DELETE FROM channel_messages WHERE sender_id = ?', [id]));
    steps.push(await updateIfTable(env, 'channels', 'UPDATE channels SET created_by = NULL WHERE created_by = ?', [id]));
    steps.push(await updateIfTable(env, 'feed_posts', 'UPDATE feed_posts SET reviewed_by = NULL WHERE reviewed_by = ?', [id]));
    steps.push(await runIfTable(env, 'feed_posts', 'DELETE FROM feed_posts WHERE author_id = ?', [id]));
    steps.push(await updateIfTable(env, 'applications', 'UPDATE applications SET reviewed_by = NULL WHERE reviewed_by = ?', [id]));
    steps.push(await updateIfTable(env, 'invites', 'UPDATE invites SET used_by = NULL WHERE used_by = ?', [id]));
    steps.push(await updateIfTable(env, 'invites', 'UPDATE invites SET created_by = NULL WHERE created_by = ?', [id]));
    steps.push(await updateIfTable(env, 'admin_audit_log', 'UPDATE admin_audit_log SET target_user_id = NULL WHERE target_user_id = ?', [id]));
    steps.push(await updateIfTable(env, 'admin_audit_log', 'UPDATE admin_audit_log SET actor_id = NULL WHERE actor_id = ?', [id]));

    const deleted = await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    if (!deleted.meta || Number(deleted.meta.changes || 0) < 1) {
      return json({ error: 'User could not be deleted. No matching account was removed.' }, 500);
    }

    await logDelete(env, actor, target, steps);

    return json({
      ok: true,
      deleted_user_id: id,
      deleted_email: target.email,
      message: 'User account deleted.',
    });
  } catch (error) {
    return json({
      error: error?.message || 'Could not delete user.',
      hint: 'If this continues, send this message to support with the user email you were trying to delete.',
    }, 500);
  }
}
`);

replaceInFile('owner-users.html', [
  ['Delete test user', 'Delete user'],
  ['Permanent delete is only for test users. Type this email exactly to continue:', 'This permanently deletes the user account and related access records. Type this email exactly to continue:'],
  ['Commission editing is disabled until the Sprint 5.1 D1 migration is run.', 'Commission editing is disabled until the production commission migration is run.'],
  ["alert('Email did not match. User was not deleted.');", "alert('Email did not match. User was not deleted.');"],
]);

replaceInFile('functions/api/admin/users/[id].js', [
  ['Commission column missing. Run database/sprint5-1-commission-profiles.sql in D1 first.', 'Commission column missing. Run the production commission migration in D1 first.'],
]);

console.log('\nDone. Commit these changes after reviewing them in GitHub Desktop.');
