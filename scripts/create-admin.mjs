// Create an admin account, or reset the password of an existing one, and make
// it an owner of a store (the default store unless --store=<slug> is given).
// Usage: npm run admin:create -- email@contoh.com "PasswordKuat123" "Nama Admin" [--store=slug] [--super]
//   --super  also makes the account a platform super_admin (manages every store)
import { createPool, findStore, hashPassword } from './_lib.mjs';

const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith('--'));
const storeSlug = flags.find((flag) => flag.startsWith('--store='))?.slice('--store='.length);
const makeSuper = flags.includes('--super');
const [emailArg, password, ...nameParts] = args.filter((arg) => !arg.startsWith('--'));
const email = emailArg?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
  console.log(
    'Pemakaian: npm run admin:create -- email@contoh.com "PasswordKuat123" "Nama Admin" [--store=slug] [--super]',
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error('✖ Password minimal 8 karakter.');
  process.exit(1);
}
const name = nameParts.join(' ').trim() || email.split('@')[0];
const pool = createPool();
try {
  const store = await findStore(pool, storeSlug);
  const now = new Date().toISOString();
  const hash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO admin_users (user_id, email, name, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
     RETURNING user_id, (xmax = 0) AS inserted`,
    [crypto.randomUUID(), email, name, hash, now],
  );
  const { user_id: userId, inserted } = result.rows[0];
  await pool.query(
    `INSERT INTO store_memberships (store_id, user_id, role, created_at, updated_at)
     VALUES ($1, $2, 'store_owner', $3, $3) ON CONFLICT (store_id, user_id) DO NOTHING`,
    [store.id, userId, now],
  );
  if (makeSuper)
    await pool.query(
      "UPDATE admin_users SET platform_role = 'super_admin', updated_at = $2 WHERE user_id = $1",
      [userId, now],
    );
  console.log(inserted ? `✔ Admin ${email} dibuat.` : `✔ Password admin ${email} diperbarui.`);
  console.log(`  Toko: ${store.name} (${store.slug})${makeSuper ? ' · super_admin platform' : ''}`);
} catch (error) {
  console.error('✖ Gagal:', error.message, '\n  Sudah menjalankan "npm run db:migrate"?');
  process.exitCode = 1;
} finally {
  await pool.end();
}
