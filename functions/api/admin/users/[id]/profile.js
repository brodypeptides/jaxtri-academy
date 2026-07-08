import { json, getUserFromRequest } from '../../../../lib/auth.js';

function clean(value) { return String(value ?? '').trim(); }
function money(value) { const n = Number(value || 0); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
function isStaff(user) { return user && user.status === 'active' && (user.role === 'owner' || user.role === 'manager'); }
function isOwner(user) { return user && user.status === 'active' && user.role === 'owner'; }

async function tableExists(env, name) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(name).first();
  return Boolean(row);
}

async function columnExists(env, table, column) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (result.results || []).some((row) => row.name === column);
  } catch {
    return false;
  }
}

async function getTargetUser(env, id) {
  const hasCommission = await columnExists(env, 'users', 'commission_percentage');
  const commissionSelect = hasCommission ? ', commission_percentage' : ', NULL AS commission_percentage';
  const user = await env.DB.prepare(`
    SELECT id, full_name, email, username, role, company_title, status, created_at, updated_at${commissionSelect}
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
  return { user, hasCommission };
}

async function safeAll(env, sql, binds = [], tableName = null) {
  try {
    if (tableName && !(await tableExists(env, tableName))) return [];
    const result = await env.DB.prepare(sql).bind(...binds).all();
    return result.results || [];
  } catch {
    return [];
  }
}

async function safeFirst(env, sql, binds = [], tableName = null) {
  try {
    if (tableName && !(await tableExists(env, tableName))) return null;
    return await env.DB.prepare(sql).bind(...binds).first();
  } catch {
    return null;
  }
}

function summarizeSales(sales) {
  const totals = { pending: 0, approved: 0, paid: 0, voided: 0, all: 0 };
  const counts = { pending: 0, approved: 0, paid: 0, voided: 0 };
  for (const sale of sales) {
    const status = sale.status || 'pending';
    const amount = money(sale.commission_amount);
    counts[status] = Number(counts[status] || 0) + 1;
    totals[status] = money(Number(totals[status] || 0) + amount);
    if (status !== 'voided') totals.all = money(totals.all + amount);
  }
  return { totals, counts, total_sales: sales.length };
}

function buildChecklist({ user, code, sales, payouts, applications, invites, payoutProfile, overrides }) {
  const overrideMap = new Map((overrides || []).map((row) => [row.item_key, row]));
  const definitions = [
    ['application_approved', 'Application approved', applications.some((app) => app.status === 'approved') || user.status === 'active'],
    ['invite_sent', 'Invite sent', invites.length > 0 || user.role === 'owner'],
    ['account_created', 'Account created', Boolean(user.id)],
    ['code_assigned', 'Affiliate code assigned', Boolean(code?.code)],
    ['commission_set', 'Commission rate set', user.commission_percentage !== null && user.commission_percentage !== undefined && user.commission_percentage !== ''],
    ['payout_profile', 'Payout profile completed', Boolean(payoutProfile?.payout_email || payoutProfile?.payout_notes)],
    ['training_started', 'Training started / manual review', false],
    ['first_sale', 'First sale tracked', sales.length > 0],
    ['first_payout', 'First payout completed', payouts.some((p) => p.status === 'paid')],
  ];

  return definitions.map(([key, label, inferred]) => {
    const override = overrideMap.get(key);
    const status = override?.status || (inferred ? 'completed' : 'open');
    return {
      item_key: key,
      label,
      inferred_complete: Boolean(inferred),
      status,
      note: override?.note || '',
      updated_at: override?.updated_at || null,
    };
  });
}

export async function onRequestGet({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);

    const { user } = await getTargetUser(env, id);
    if (!user) return json({ error: 'User not found.' }, 404);
    if (user.role === 'owner' && !isOwner(actor)) return json({ error: 'Only owners can open owner profile details.' }, 403);

    const code = await safeFirst(env, `
      SELECT id, code, status, created_at, updated_at
      FROM affiliate_codes
      WHERE user_id = ? AND status = 'active'
      ORDER BY id DESC
      LIMIT 1
    `, [id], 'affiliate_codes');

    const payoutProfile = await safeFirst(env, `
      SELECT user_id, payout_method, payout_email, payout_notes, updated_at
      FROM affiliate_payout_profiles
      WHERE user_id = ?
      LIMIT 1
    `, [id], 'affiliate_payout_profiles');

    const sales = await safeAll(env, `
      SELECT s.*, pr.id AS payout_request_id, pr.status AS payout_request_status
      FROM affiliate_sales s
      LEFT JOIN payout_request_sales prs ON prs.sale_id = s.id
      LEFT JOIN payout_requests pr ON pr.id = prs.payout_request_id
      WHERE s.affiliate_user_id = ?
      ORDER BY datetime(s.created_at) DESC, s.id DESC
      LIMIT 120
    `, [id], 'affiliate_sales');

    const payouts = await safeAll(env, `
      SELECT pr.*, COUNT(prs.sale_id) AS sale_count
      FROM payout_requests pr
      LEFT JOIN payout_request_sales prs ON prs.payout_request_id = pr.id
      WHERE pr.affiliate_user_id = ?
      GROUP BY pr.id
      ORDER BY datetime(pr.requested_at) DESC, pr.id DESC
      LIMIT 80
    `, [id], 'payout_requests');

    const applications = await safeAll(env, `
      SELECT id, full_name, email, status, reviewed_at, created_at, review_note
      FROM applications
      WHERE lower(email) = lower(?)
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 20
    `, [user.email], 'applications');

    const invites = await safeAll(env, `
      SELECT id, email, role, status, expires_at, used_at, created_at
      FROM invites
      WHERE lower(email) = lower(?)
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 30
    `, [user.email], 'invites');

    const feedPosts = await safeAll(env, `
      SELECT id, title, status, reviewed_at, published_at, created_at
      FROM feed_posts
      WHERE author_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 50
    `, [id], 'feed_posts');

    const webhookEvents = code?.code ? await safeAll(env, `
      SELECT id, provider, event, external_order_id, affiliate_code, status, message, created_at
      FROM affiliate_webhook_events
      WHERE lower(coalesce(affiliate_code,'')) = lower(?)
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 60
    `, [code.code], 'affiliate_webhook_events') : [];

    const notes = await safeAll(env, `
      SELECT n.*, u.full_name AS author_name, u.email AS author_email
      FROM admin_user_notes n
      LEFT JOIN users u ON u.id = n.author_id
      WHERE n.target_user_id = ? AND n.archived_at IS NULL
      ORDER BY n.is_pinned DESC, datetime(n.created_at) DESC, n.id DESC
      LIMIT 80
    `, [id], 'admin_user_notes');

    const overrides = await safeAll(env, `
      SELECT item_key, status, note, updated_at
      FROM user_onboarding_items
      WHERE user_id = ?
    `, [id], 'user_onboarding_items');

    const auditLog = await safeAll(env, `
      SELECT a.*, actor.full_name AS actor_name, actor.email AS actor_email
      FROM admin_audit_log a
      LEFT JOIN users actor ON actor.id = a.actor_id
      WHERE a.target_user_id = ?
      ORDER BY datetime(a.created_at) DESC, a.id DESC
      LIMIT 60
    `, [id], 'admin_audit_log');

    const checklist = buildChecklist({ user, code, sales, payouts, applications, invites, payoutProfile, overrides });
    const salesSummary = summarizeSales(sales);
    const profileScore = Math.round((checklist.filter((item) => item.status === 'completed').length / checklist.length) * 100);

    return json({
      user,
      code,
      payout_profile: payoutProfile,
      sales,
      payouts,
      applications,
      invites,
      feed_posts: feedPosts,
      webhook_events: webhookEvents,
      notes,
      audit_log: auditLog,
      checklist,
      stats: {
        ...salesSummary,
        payout_requests: payouts.length,
        paid_payouts: payouts.filter((p) => p.status === 'paid').length,
        profile_score: profileScore,
        checklist_completed: checklist.filter((item) => item.status === 'completed').length,
        checklist_total: checklist.length,
      },
      viewer: { role: actor.role, is_owner: actor.role === 'owner', is_manager: actor.role === 'manager' },
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load user profile.' }, 500);
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const actor = await getUserFromRequest(env, request);
    if (!isStaff(actor)) return json({ error: 'Owner or manager access required.' }, 403);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Invalid user ID.' }, 400);

    const { user } = await getTargetUser(env, id);
    if (!user) return json({ error: 'User not found.' }, 404);
    if (user.role === 'owner' && !isOwner(actor)) return json({ error: 'Only owners can edit owner checklist items.' }, 403);

    if (!(await tableExists(env, 'user_onboarding_items'))) {
      return json({ error: 'Onboarding checklist table missing. Run the Sprint 7-9 migration first.' }, 400);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid request.' }, 400);

    const itemKey = clean(body.item_key).slice(0, 80);
    const status = clean(body.status).toLowerCase();
    const note = clean(body.note).slice(0, 500) || null;
    const allowedKeys = ['application_approved','invite_sent','account_created','code_assigned','commission_set','payout_profile','training_started','first_sale','first_payout'];
    if (!allowedKeys.includes(itemKey)) return json({ error: 'Invalid onboarding item.' }, 400);
    if (!['open','completed','skipped','blocked'].includes(status)) return json({ error: 'Invalid onboarding status.' }, 400);

    await env.DB.prepare(`
      INSERT INTO user_onboarding_items (user_id, item_key, status, note, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, item_key) DO UPDATE SET
        status = excluded.status,
        note = excluded.note,
        updated_by = excluded.updated_by,
        updated_at = datetime('now')
    `).bind(id, itemKey, status, note, actor.id).run();

    try {
      await env.DB.prepare(`
        INSERT INTO admin_audit_log (actor_id, target_user_id, action, details)
        VALUES (?, ?, 'update_onboarding_item', ?)
      `).bind(actor.id, id, JSON.stringify({ item_key: itemKey, status })).run();
    } catch {}

    return json({ ok: true });
  } catch (error) {
    return json({ error: error?.message || 'Could not update onboarding item.' }, 500);
  }
}
