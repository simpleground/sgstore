// Applies every SQL file in db/migrations that has not been applied yet.
// Usage: npm run db:migrate
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPool } from './_lib.mjs';

const dir = join(import.meta.dirname, '..', 'db', 'migrations');
const pool = createPool();

try {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const done = new Set(
    (await pool.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name),
  );
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, applied_at) VALUES ($1, $2)', [
        file,
        new Date().toISOString(),
      ]);
      await client.query('COMMIT');
      console.log(`✔ ${file}`);
      applied++;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✖ ${file} gagal:`, error.message);
      process.exitCode = 1;
      break;
    } finally {
      client.release();
    }
  }
  if (!process.exitCode)
    console.log(applied ? `Selesai: ${applied} migrasi diterapkan.` : 'Database sudah terbaru.');
} catch (error) {
  console.error('✖ Tidak dapat terhubung ke database:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
