import { json } from '../lib/auth.js';

function clean(value) { return String(value || '').trim(); }

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ error: 'Database binding missing.' }, 500);
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid application.' }, 400);

    const fullName = clean(body.full_name);
    const email = clean(body.email).toLowerCase();
    const discordUsername = clean(body.discord_username);
    const tiktok = clean(body.tiktok);
    const instagram = clean(body.instagram);
    const youtube = clean(body.youtube);
    const experience = clean(body.experience);
    const whyJoin = clean(body.why_join);
    const agreement = Boolean(body.agreement);

    if (!fullName || !email || !whyJoin) return json({ error: 'Name, email, and why you want to join are required.' }, 400);
    if (!email.includes('@')) return json({ error: 'Please enter a valid email.' }, 400);
    if (!agreement) return json({ error: 'Please confirm that you understand applications are reviewed.' }, 400);

    await env.DB.prepare(`
      INSERT INTO applications
        (full_name, email, discord_username, tiktok, instagram, youtube, experience, why_join, status)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(fullName, email, discordUsername, tiktok, instagram, youtube, experience, whyJoin).run();

    return json({ ok: true, redirect: '/application-submitted.html' });
  } catch (error) {
    return json({ error: error?.message || 'Application could not be submitted.' }, 500);
  }
}
