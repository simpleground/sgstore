// Create an admin account, or reset the password of an existing one.
// Usage: npm run admin:create -- email@contoh.com "PasswordKuat123" "Nama Admin"
import { createPool, hashPassword } from './_lib.mjs';

const [emailArg, password, ...nameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
  console.log('Pemakaian: npm run admin:create -- email@contoh.com "PasswordKuat123" "Nama Admin"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('✖ Password minimal 8 karakter.');
  process.exit(1);
}
const name = nameParts.join(' ').trim() || email.split('@')[0];
const pool = createPool();
try {
  const now = new Date().toISOString();
  const hash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO admin_users (user_id, email, name, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
     RETURNING (xmax = 0) AS inserted`,
    [crypto.randomUUID(), email, name, hash, now],
  );
  console.log(result.rows[0].inserted ? `✔ Admin ${email} dibuat.` : `✔ Password admin ${email} diperbarui.`);
} catch (error) {
  console.error('✖ Gagal:', error.message, '\n  Sudah menjalankan "npm run db:migrate"?');
  process.exitCode = 1;
} finally {
  await pool.end();
}
