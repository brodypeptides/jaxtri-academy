const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;

function bytesToBase64(bytes) {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function base64ToBytes(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

export function randomId(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToBase64(arr)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256
  );

  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [type, iters, saltB64, hashB64] = stored.split('$');
    if (type !== 'pbkdf2') return false;

    const iterations = Number(iters);
    if (!Number.isFinite(iterations) || iterations > 100000) return false;

    const salt = base64ToBytes(saltB64);
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      key,
      256
    );

    return bytesToBase64(new Uint8Array(bits)) === hashB64;
  } catch {
    return false;
  }
}

export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function getCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  return raw
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))
    ?.split('=')[1];
}

export async function createSession(env, userId, remember = false) {
  const id = randomId();
  const days = remember ? 30 : 1;
  const expires = new Date(Date.now() + days * 86400000).toISOString();

  await env.DB.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)')
    .bind(id, userId, expires)
    .run();

  return { id, maxAge: days * 86400 };
}

export async function getUserFromRequest(env, req) {
  const sid = getCookie(req, 'jaxtri_session');
  if (!sid) return null;

  const row = await env.DB.prepare(`
      SELECT
        users.id,
        users.full_name,
        users.email,
        users.username,
        users.role,
        users.company_title,
        users.status
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
        AND sessions.expires_at > datetime('now')
    `)
    .bind(sid)
    .first();

  return row || null;
}
