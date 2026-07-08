import { generateKeyPairSync } from 'node:crypto';

function b64urlToBuffer(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });
const publicRaw = Buffer.concat([
  Buffer.from([0x04]),
  b64urlToBuffer(publicJwk.x),
  b64urlToBuffer(publicJwk.y),
]).toString('base64url');

console.log('WEB_PUSH_PUBLIC_KEY=' + publicRaw);
console.log('WEB_PUSH_PRIVATE_KEY=' + privateJwk.d);
console.log('WEB_PUSH_SUBJECT=mailto:support@jaxtrilabsacademy.com');
