function base64UrlToBytes(value) {
  const input = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function jsonToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function derSignatureToJose(signature) {
  const bytes = new Uint8Array(signature);
  if (bytes.length === 64) return bytes;
  if (bytes[0] !== 0x30) return bytes;

  let offset = 2;
  if (bytes[1] & 0x80) offset = 2 + (bytes[1] & 0x7f);
  if (bytes[offset] !== 0x02) return bytes;

  const rLength = bytes[offset + 1];
  let r = bytes.slice(offset + 2, offset + 2 + rLength);
  offset = offset + 2 + rLength;
  if (bytes[offset] !== 0x02) return bytes;

  const sLength = bytes[offset + 1];
  let s = bytes.slice(offset + 2, offset + 2 + sLength);

  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);

  const jose = new Uint8Array(64);
  jose.set(r, 32 - r.length);
  jose.set(s, 64 - s.length);
  return jose;
}

function vapidJwk(publicKey, privateKey) {
  const publicBytes = base64UrlToBytes(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error('WEB_PUSH_PUBLIC_KEY must be a base64url encoded uncompressed P-256 public key.');
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(publicBytes.slice(1, 33)),
    y: bytesToBase64Url(publicBytes.slice(33, 65)),
    d: privateKey,
    ext: true,
    key_ops: ['sign'],
  };
}

async function createVapidJwt(env, endpoint) {
  const publicKey = String(env.WEB_PUSH_PUBLIC_KEY || '').trim();
  const privateKey = String(env.WEB_PUSH_PRIVATE_KEY || '').trim();
  if (!publicKey || !privateKey) throw new Error('Web Push keys are not configured.');

  const audience = new URL(endpoint).origin;
  const subject = String(env.WEB_PUSH_SUBJECT || 'mailto:support@jaxtrilabsacademy.com').trim();
  const token = [
    jsonToBase64Url({ typ: 'JWT', alg: 'ES256' }),
    jsonToBase64Url({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject }),
  ].join('.');

  const key = await crypto.subtle.importKey(
    'jwk',
    vapidJwk(publicKey, privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(token),
  );

  return `${token}.${bytesToBase64Url(derSignatureToJose(signature))}`;
}

export function webPushConfigured(env) {
  return Boolean(String(env.WEB_PUSH_PUBLIC_KEY || '').trim() && String(env.WEB_PUSH_PRIVATE_KEY || '').trim());
}

export async function sendWebPush(env, subscription, options = {}) {
  const endpoint = String(subscription?.endpoint || '').trim();
  if (!endpoint) return { ok: false, status: 400, error: 'Missing push endpoint.' };
  if (!webPushConfigured(env)) return { ok: false, status: 400, error: 'Web Push keys are not configured.' };

  const publicKey = String(env.WEB_PUSH_PUBLIC_KEY || '').trim();
  const jwt = await createVapidJwt(env, endpoint);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      TTL: String(options.ttl || 60),
      Urgency: options.urgency || 'normal',
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    shouldDisable: response.status === 404 || response.status === 410,
  };
}
