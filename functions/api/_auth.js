const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

export function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function toBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, keyMaterial, 256);
  return `pbkdf2_sha256$120000$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [algo, iterText, saltB64, hashB64] = stored.split('$');
    if (algo !== 'pbkdf2_sha256') return false;
    const iterations = Number(iterText);
    const salt = fromBase64(saltB64);
    const expected = fromBase64(hashB64);
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.split('=')[1];
}

export async function createSession(env, userId, remember = false) {
  const id = uid('sess');
  const days = remember ? 30 : 1;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(id, userId, expires).run();
  const cookie = `jaxtri_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 24 * 60 * 60}`;
  return { id, cookie };
}

export async function currentUser(env, request) {
  const sessionId = getCookie(request, 'jaxtri_session');
  if (!sessionId) return null;
  const row = await env.DB.prepare(`SELECT users.id, users.name, users.email, users.username, users.role, users.company_title, users.status FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > datetime('now')`).bind(sessionId).first();
  return row || null;
}
