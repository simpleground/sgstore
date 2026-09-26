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
- Multi-toko: toko aktif ditentukan dari header Host — `getCurrentStore()` (`lib/tenant.ts`) untuk halaman/API publik,
  `authorizeStore('<izin>')` (`lib/admin-auth.ts`, izin per peran di `lib/permissions.ts`) untuk API admin; catat
  tindakan admin dengan `audit()` (`lib/audit.ts`). JANGAN pernah memakai
  store id dari body/query browser. Tabel products, orders, reviews, cart_items, customers, customer_sessions,
  shipping_settings, newsletter_subscribers wajib `store_id` di setiap SELECT/UPDATE/DELETE (WHERE) dan INSERT
  (kolom ini tidak punya DEFAULT). Foto baru: `storeFileKey()`; data lama milik toko `default` (slug `simple-ground`).
  Tambah tes isolasi di `tests/integration/isolation.test.mjs` untuk setiap endpoint baru.
- Pengaturan toko: `lib/store-settings.ts` (kontak, rekening, Midtrans/Biteship efektif per toko; kunci rahasia
  terenkripsi via `lib/secrets.ts`). Komponen client membaca pengaturan publik lewat `useStoreConfig()`
  (`app/store-config.tsx`). Jangan menulis nomor rekening/WA/kunci toko di kode.
- Tampilan toko: `lib/store-appearance.ts` (tema, tata letak `layout`, konten beranda, SEO, gambar). Di storefront pakai warna brand
  lewat token CSS (`bg-[var(--brand)]`, `text-[var(--brand-accent)]`, lihat `app/globals.css`), bukan hex
  hijau/terakota langsung, dan teks/nama toko dari `useStoreConfig()` — jangan tulis "Simple Ground" di kode.
- Platform (super admin): menu Platform di `/admin` (Website: `app/admin/stores-client.tsx`, Peran & izin:
  `app/admin/roles-client.tsx`; `/platform` hanya redirect), API `/api/platform/*` dengan `requireSuperAdmin()`, logika di
  `lib/platform.ts` (pusat pesanan semua toko: `lib/platform-orders.ts`, `/api/platform/orders`; laporan keuangan/penjualan produk/stok: `lib/reports.ts`; peran & izin: `lib/roles.ts` — izin anggota dibaca dari
  database lewat `getStoreAdmin().permissions`, jangan memakai `roleCan()` langsung; masuk ke admin toko tanpa login ulang: `lib/admin-handoff.ts`). Halaman etalase ada di `app/(storefront)/` (layout-nya menolak host tanpa toko dan menutup
  toko yang ditangguhkan/ditutup); API publik memakai `getOpenStore()`, panel admin `getCurrentStore()`.
- Tes integrasi: `TEST_DATABASE_URL=... npm run test:integration` (schema sementara, aman untuk DB berisi data).
- Konfigurasi hanya lewat variabel lingkungan (`.env`, lihat `.env.example`). Jangan menulis URL/kunci langsung di kode.
