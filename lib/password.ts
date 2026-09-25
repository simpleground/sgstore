// Password hashing with PBKDF2-SHA256 (Web Crypto → works on Node & Cloudflare).
// Must stay identical to scripts/_lib.mjs
const ITERATIONS = 210000;

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2_sha256$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, iterations, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2_sha256' || !iterations || !salt || !expected) return false;
  const actual = toB64(await derive(password, fromB64(salt), Number(iterations)));
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++)
    mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
