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

/**
 * The store a command works on: --store=<slug> when given, otherwise the
 * default store (DEFAULT_STORE_SLUG, or the original store with id 'default').
 */
export async function findStore(pool, slug) {
  const wanted = slug?.trim().toLowerCase() || process.env.DEFAULT_STORE_SLUG?.trim().toLowerCase();
  const { rows } = wanted
    ? await pool.query('SELECT id, slug, name FROM stores WHERE slug = $1', [wanted])
    : await pool.query("SELECT id, slug, name FROM stores WHERE id = 'default'");
  if (!rows[0]) {
    let available = [];
    try {
      available = (await pool.query('SELECT slug FROM stores ORDER BY slug')).rows.map((row) => row.slug);
    } catch {
      console.error('✖ Tabel toko belum ada. Jalankan dulu: npm run db:migrate');
      process.exit(1);
    }
    console.error(`✖ Toko dengan slug "${wanted || 'default'}" tidak ditemukan.`);
    console.error(`  Slug yang tersedia: ${available.join(', ') || '(belum ada toko)'}`);
    console.error('  Tanpa --store, perintah memakai toko utama. Toko baru dibuat di halaman /platform.');
    process.exit(1);
  }
  return rows[0];
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
