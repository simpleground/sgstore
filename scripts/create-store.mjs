// Create a new store together with its owner account (email + password), so the
// owner can log in right away without the /platform panel.
// Usage: npm run store:create -- slug "Nama Toko" email@contoh.com "PasswordKuat123" ["Nama Pemilik"] [--domain=tokoanda.com]
// An existing account keeps its password unless it has none yet.
import { createPool, hashPassword } from './_lib.mjs';

// Must stay identical to RESERVED_SLUGS in lib/platform.ts
const RESERVED_SLUGS = new Set([
  'www', 'admin', 'api', 'app', 'platform', 'mail', 'smtp', 'ftp', 'static', 'assets',
  'cdn', 'img', 'images', 'status', 'help', 'support', 'default', 'dashboard',
]);
const USAGE =
  'Pemakaian: npm run store:create -- slug "Nama Toko" email@contoh.com "PasswordKuat123" ["Nama Pemilik"] [--domain=tokoanda.com]';

const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const domainArg = args.find((arg) => arg.startsWith('--domain='))?.slice('--domain='.length);
const [slugArg, nameArg, emailArg, password, ...ownerParts] = args.filter((arg) => !arg.startsWith('--'));
const slug = slugArg?.trim().toLowerCase();
const name = nameArg?.trim();
const email = emailArg?.trim().toLowerCase();
if (!slug || !name || !email || !password) {
  console.log(USAGE);
  process.exit(1);
}
if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) || slug.length < 3)
  fail('Slug 3–63 karakter: huruf kecil, angka, dan tanda hubung (tidak di awal/akhir).');
if (RESERVED_SLUGS.has(slug)) fail(`Slug "${slug}" dicadangkan untuk platform.`);
if (name.length < 2 || name.length > 80) fail('Nama toko 2–80 karakter.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Email pemilik tidak valid.');
if (password.length < 8) fail('Password minimal 8 karakter.');
const domain = domainArg?.trim().toLowerCase().replace(/\.$/, '');
if (domain !== undefined && (!/^[a-z0-9.-]+\.[a-z0-9-]+$/.test(domain) || domain.startsWith('www.')))
  fail('Domain tidak valid. Contoh: tokoanda.com (tanpa https:// dan tanpa www.).');
const ownerName = ownerParts.join(' ').trim() || email.split('@')[0];

const pool = createPool();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  if ((await client.query('SELECT 1 FROM stores WHERE slug = $1', [slug])).rows[0])
    throw new Error(`Slug "${slug}" sudah dipakai toko lain. Untuk menambah admin: npm run admin:create -- ... --store=${slug}`);
  if (domain && (await client.query('SELECT 1 FROM store_domains WHERE host = $1', [domain])).rows[0])
    throw new Error(`Domain ${domain} sudah dipakai toko lain.`);
  const storeId = crypto.randomUUID();
  const now = new Date().toISOString();
  await client.query(
    "INSERT INTO stores (id, slug, name, status, created_at, updated_at) VALUES ($1, $2, $3, 'active', $4, $4)",
    [storeId, slug, name, now],
  );
  const existing = (
    await client.query('SELECT user_id, password_hash FROM admin_users WHERE email = $1', [email])
  ).rows[0];
  let userId = existing?.user_id;
  if (!existing) {
    userId = crypto.randomUUID();
    await client.query(
      `INSERT INTO admin_users (user_id, email, name, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [userId, email, ownerName, await hashPassword(password), now],
    );
  } else if (!existing.password_hash) {
    await client.query('UPDATE admin_users SET password_hash = $2, updated_at = $3 WHERE user_id = $1', [
      userId,
      await hashPassword(password),
      now,
    ]);
  }
  await client.query(
    `INSERT INTO store_memberships (store_id, user_id, role, created_at, updated_at)
     VALUES ($1, $2, 'store_owner', $3, $3)`,
    [storeId, userId, now],
  );
  if (domain)
    await client.query(
      'INSERT INTO store_domains (host, store_id, is_primary, created_at) VALUES ($1, $2, 1, $3)',
      [domain, storeId, now],
    );
  await client.query(
    `INSERT INTO audit_logs (store_id, user_email, action, target_type, target_id, meta_json, created_at)
     VALUES ($1, 'cli', 'platform.store.create', 'store', $1, $2, $3)`,
    [storeId, JSON.stringify({ slug, name, owner: email, via: 'store:create' }), now],
  );
  await client.query('COMMIT');

  console.log(`✔ Toko ${name} (${slug}) dibuat.`);
  if (!existing) console.log(`✔ Akun pemilik ${email} dibuat.`);
  else if (existing.password_hash) console.log(`  Akun ${email} sudah ada — password lama tetap dipakai.`);
  else console.log(`✔ Password akun ${email} diatur.`);
  const root = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  console.log('  Login admin di:');
  if (domain) console.log(`    https://${domain}/admin`);
  if (root && root !== 'localhost') console.log(`    https://${slug}.${root}/admin`);
  console.log(`    http://${slug}.localhost:3000/admin  (lokal, bila PLATFORM_ROOT_DOMAIN=localhost)`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('✖ Gagal:', error.message);
  if (/relation .* does not exist/.test(error.message)) console.error('  Jalankan dulu: npm run db:migrate');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
