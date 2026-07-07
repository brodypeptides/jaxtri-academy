import { json } from '../lib/auth.js';

export async function onRequestGet({ env }) {
  try {
    if (!env.DB) return json({ error: 'Database binding missing.' }, 500);
    const owner = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").first();
    return json({ initialized: !!owner });
  } catch (error) {
    return json({ error: error?.message || 'Could not check setup status.' }, 500);
  }
}
