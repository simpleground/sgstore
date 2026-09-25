<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Simple Ground — catatan untuk AI/developer

- Next.js 16 App Router + PostgreSQL. Jalankan: `npm run dev`. Lihat README.md.
- Akses database lewat `getD1()` dari `@/db` (API bergaya Cloudflare D1: `prepare(sql).bind(...).first()/all()/run()`, `batch([...])`).
  Tulis SQL yang valid untuk PostgreSQL; placeholder `?` otomatis diubah ke `$1..$n`.
  Alias camelCase wajib diberi tanda kutip: `SELECT user_id AS "userId"`. Pada `ON CONFLICT ... DO UPDATE`, sebut nama tabel untuk nilai lama (`cart_items.quantity`).
- Kolom boolean disimpan sebagai INTEGER 0/1. Waktu disimpan sebagai teks ISO-8601.
- Perubahan skema: tambah file baru di `db/migrations/NNNN_nama.sql` lalu `npm run db:migrate`. Jangan ubah file migrasi lama.
- Foto produk: `getFiles()` / `lib/storage.ts` (driver `local` atau `s3`). URL publik: `/api/product-image/<key>`.
- Auth admin: `lib/admin-auth.ts` (`isAdmin()` untuk API, `requireAdmin()` untuk halaman). Auth pelanggan: `app/customer-auth.ts`.
- Multi-toko (sedang bertahap): toko aktif ditentukan dari header Host lewat `getCurrentStore()` di `lib/tenant.ts`
  — jangan pernah dari body/query browser. Tabel data toko punya kolom `store_id` (sementara `DEFAULT 'default'`);
  query baru pada tabel tersebut wajib memfilter `store_id`. Data lama milik toko `default` (slug `simple-ground`).
- Tes integrasi: `TEST_DATABASE_URL=... npm run test:integration` (schema sementara, aman untuk DB berisi data).
- Konfigurasi hanya lewat variabel lingkungan (`.env`, lihat `.env.example`). Jangan menulis URL/kunci langsung di kode.
