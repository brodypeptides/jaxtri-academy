export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}
export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
export function bad(error, status = 400) { return json({ error }, status); }
export function now() { return new Date().toISOString(); }
export function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes); crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function hashPassword(password, salt = randomToken(16)) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 310000, hash: 'SHA-256' }, key, 256);
  const hash = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2_sha256$310000$${salt}$${hash}`;
}
export async function verifyPassword(password, stored) {
  const [algo, iter, salt, hash] = String(stored || '').split('$');
  if (algo !== 'pbkdf2_sha256' || !salt || !hash) return false;
  const computed = await hashPassword(password, salt);
  return computed === stored;
}
export function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.split('=').slice(1).join('=') || '';
}
export async function getUser(context) {
  const token = getCookie(context.request, 'jaxtri_session');
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await context.env.DB.prepare(`SELECT users.id, users.name, users.email, users.username, users.role, users.status FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')`).bind(tokenHash).first();
  return row || null;
}
export async function requireUser(context, roles = []) {
  const user = await getUser(context);
  if (!user) return { error: json({ error: 'Not authenticated' }, 401) };
  if (roles.length && !roles.includes(user.role)) return { error: json({ error: 'Forbidden' }, 403) };
  return { user };
}
export function sessionCookie(token, remember = false) {
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  return `jaxtri_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
export function clearCookie() { return 'jaxtri_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'; }
export function redirectFor(user) {
  if (user.status !== 'active') return '/pending.html';
  if (user.role === 'owner' || user.role === 'manager') return '/owner-dashboard.html';
  return '/academy-dashboard.html';
}
