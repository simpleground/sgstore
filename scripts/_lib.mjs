// Shared helpers for the command-line scripts (migrate, create-admin, seed).
import pg from 'pg';

export function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      '✖ DATABASE_URL belum diatur. Salin .env.example menjadi .env lalu isi koneksi PostgreSQL.',
    );
    process.exit(1);
  }
  const ssl = process.env.DATABASE_SSL;
  return new pg.Pool({
    connectionString,
    max: 2,
    ssl: ssl === 'true' || ssl === 'require' ? { rejectUnauthorized: false } : undefined,
  });
}

// Must stay identical to lib/password.ts
const ITERATIONS = 210000;
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}
