# Simple Ground — Toko Online

Toko online Simple Ground (baju chef, seragam kerja, daily wear) berbasis **Next.js 16 + PostgreSQL**.
Bisa dijalankan di **komputer lokal (VS Code)**, di **VPS (Ubuntu/Debian)**, dan (opsional) di **Cloudflare Workers**.

| Bagian | Teknologi |
|---|---|
| Web & API | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui |
| Database | PostgreSQL 14+ (driver `pg`) |
| Foto produk | Folder lokal (`./storage`) **atau** S3/Cloudflare R2 |
| Login admin | Email + password **dan/atau** Google |
| Login pelanggan | Google |
| Pembayaran | Midtrans (QRIS / VA) + transfer manual Mandiri |
| Ongkir | Biteship |

---

## 1. Menjalankan di komputer lokal (Windows + VS Code)

### Prasyarat (sekali saja)

1. **Node.js 22 LTS** → https://nodejs.org (pilih versi 22.x)
2. **Git** → https://git-scm.com
3. **VS Code** → buka folder project, lalu pasang ekstensi yang direkomendasikan (muncul otomatis).
4. **PostgreSQL**, pilih salah satu:
   - **A. Installer** (paling mudah di Windows): unduh PostgreSQL 16 dari https://www.postgresql.org/download/windows/ .
     Setelah terpasang, buka **SQL Shell (psql)** lalu jalankan:
     ```sql
     CREATE USER sgstore WITH PASSWORD 'sgstore';
     CREATE DATABASE sgstore OWNER sgstore;
     ```
   - **B. Docker Desktop**: cukup jalankan `docker compose up -d` di folder project.

### Menjalankan

Buka terminal di VS Code (<kbd>Ctrl</kbd>+<kbd>`</kbd>):

```bash
copy .env.example .env        # Windows (di Mac/Linux: cp .env.example .env)
npm install
npm run db:migrate            # membuat tabel di database
npm run db:seed-demo          # (opsional) 6 produk contoh
npm run dev
```

Buka **http://localhost:3000**. Panel admin: **http://localhost:3000/admin**
→ masuk dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env` (akun dibuat otomatis saat login pertama).

> Tip: tekan <kbd>F5</kbd> di VS Code untuk menjalankan `npm run dev` dengan debugger.

### Perintah yang tersedia

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode pengembangan (auto-reload) |
| `npm run build` lalu `npm start` | Mode produksi |
| `npm run db:migrate` | Menerapkan file baru di `db/migrations/` |
| `npm run db:seed-demo` | Menambah produk demo bila tabel produk kosong |
| `npm run admin:create -- email "password" "Nama"` | Membuat admin / reset password admin |
| `npm run typecheck` · `npm run lint` · `npm test` | Pemeriksaan kode |

---

## 2. Deploy ke VPS (Ubuntu 22.04/24.04 atau Debian 12)

Pastikan kode terbaru sudah di-*push* ke GitHub. Lalu, di VPS (login SSH sebagai root):

```bash
curl -fsSL https://raw.githubusercontent.com/simpleground/sgstore/main/deploy/setup-vps.sh -o setup-vps.sh
sudo bash setup-vps.sh simpleground.online https://github.com/simpleground/sgstore.git
```

> **Repo privat?** Buat token di GitHub → Settings → Developer settings → *Personal access tokens*,
> lalu pakai URL `https://USERNAME:TOKEN@github.com/simpleground/sgstore.git`, dan unduh
> `setup-vps.sh` dengan cara menyalin isinya ke VPS (`nano setup-vps.sh`).

Skrip ini otomatis: memasang Node.js 22, PostgreSQL, Nginx, PM2, Certbot, firewall; membuat database
dengan password acak; membuat `.env`; menjalankan migrasi dan build; menyalakan aplikasi dan membuatnya
hidup lagi otomatis setelah reboot. Di akhir, skrip menampilkan **email dan password admin**.

Setelah itu:

1. Arahkan DNS domain (A record `@` dan `www`) ke IP VPS.
2. Aktifkan HTTPS: `sudo certbot --nginx -d simpleground.online -d www.simpleground.online`
3. Isi kunci Midtrans & Biteship di `/var/www/sgstore/.env`, lalu:
   `sudo -u sgstore bash -c 'cd /var/www/sgstore && npm run build && pm2 reload sgstore'`
4. Buka `https://simpleground.online/admin` dan buat akun admin.
5. Di dashboard Midtrans, set *Payment Notification URL* ke
   `https://simpleground.online/api/payments/midtrans/notification`.
6. Di Google Cloud Console, tambahkan `https://simpleground.online` ke *Authorized JavaScript origins*.

**Update aplikasi** setelah ada perubahan di GitHub:
```bash
sudo -u sgstore bash /var/www/sgstore/deploy/update.sh
```

**Backup** database + foto (simpan 14 hari):
```bash
sudo -u sgstore bash /var/www/sgstore/deploy/backup.sh
```

Perintah berguna: `sudo -u sgstore pm2 logs sgstore` (lihat log), `sudo -u sgstore pm2 status`,
`curl http://127.0.0.1:3000/api/health` (cek aplikasi & database).

---

## 3. Deploy ke Cloudflare Workers (opsional)

Cloudflare **tidak menyediakan PostgreSQL**, jadi database tetap harus ada di tempat lain
(mis. PostgreSQL di VPS Anda, Neon, atau Supabase) dan dihubungkan lewat **Hyperdrive**.
Foto produk harus memakai **R2** (`STORAGE_DRIVER=s3`), karena Workers tidak punya disk.
Catatan: batas CPU paket gratis Workers hanya 10 ms per request, yang sering terlalu kecil untuk
Next.js. Paket Workers Paid (US$5/bulan) lebih aman.

```bash
npm i -D @opennextjs/cloudflare wrangler
copy deploy\cloudflare\wrangler.jsonc .
copy deploy\cloudflare\open-next.config.ts .
npx wrangler login
npx wrangler hyperdrive create sgstore-db --connection-string="postgres://USER:PASS@HOST:5432/sgstore"
#   → salin "id" ke wrangler.jsonc (bagian hyperdrive)
npx wrangler r2 bucket create sgstore-files
#   → buat R2 API token (S3), isi rahasia:
npx wrangler secret put S3_ENDPOINT          # https://<ACCOUNT_ID>.r2.cloudflarestorage.com
npx wrangler secret put S3_BUCKET            # sgstore-files
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put MIDTRANS_SERVER_KEY  # dst. untuk kunci lainnya
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

Migrasi database tetap dijalankan dari komputer Anda: `npm run db:migrate` dengan `DATABASE_URL`
yang mengarah ke database tersebut.

---

## 4. Memindahkan data dari website lama (ChatGPT Sites)

Website lama menyimpan data di Cloudflare D1/R2 milik platform ChatGPT, yang tidak bisa dipindah otomatis.
Cara paling praktis:

- **Produk:** di admin **lama** → Produk → *Ekspor CSV*, lalu di admin **baru** → *Impor CSV*.
  Sebelum domain dipindah, simpan juga foto produk lalu unggah ulang (atau isi kolom `image_url`).
- **Pesanan, pelanggan & ulasan:** perlu ekspor database D1. Kalau Anda punya file ekspor
  (`.sql`/`.csv`), data bisa diimpor ke tabel PostgreSQL yang namanya dan kolomnya sama persis.

---

## 5. Variabel lingkungan (`.env`)

| Nama | Wajib | Keterangan |
|---|---|---|
| `SITE_URL` | ✔ | URL website, mis. `https://simpleground.online` (dipakai untuk SEO & callback Midtrans). Ubah **sebelum** `npm run build`. |
| `DATABASE_URL` | ✔ | Koneksi PostgreSQL `postgres://user:pass@host:5432/db` |
| `DATABASE_SSL` | | `require` untuk database cloud yang mewajibkan SSL |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ✔ | Akun admin utama; dibuat otomatis saat login pertama, password ikut diperbarui bila diubah |
| `ADMIN_NAME` | | Nama tampilan admin utama (bawaan `Admin`) |
| `ADMIN_EMAILS` | | Email Google yang otomatis boleh masuk admin (pisahkan koma) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | | Client ID Google Sign-In (bawaan: milik proyek lama) |
| `STORAGE_DRIVER` | | `local` (bawaan) atau `s3` |
| `STORAGE_LOCAL_DIR` | | Folder foto, bawaan `./storage` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | | Untuk R2/S3 |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | | Kunci Midtrans |
| `MIDTRANS_IS_PRODUCTION` | | `false` = Sandbox |
| `BITESHIP_API_KEY` | ✔ untuk ongkir | Kunci Biteship |
| `BITESHIP_MODE` | | `sandbox` = tarif simulasi bila API gagal |
| `BITESHIP_ORIGIN_POSTAL_CODE` | | Kode pos gudang, bawaan `44163` |

---

## 6. Struktur project

```
app/                 Halaman & API (Next.js App Router)
  admin/             Panel admin (+ admin/login)
  api/               Endpoint API (produk, pesanan, pembayaran, ongkir, admin)
db/index.ts          Koneksi PostgreSQL (API bergaya D1: prepare/bind/first/all/run/batch)
db/migrations/       File SQL skema database — tambah file baru untuk perubahan skema
lib/                 Logika bersama (auth admin, storage, Biteship, dll.)
scripts/             migrate, create-admin, seed-demo
deploy/              Skrip VPS (setup, update, backup), Nginx, konfigurasi Cloudflare
```

**Menambah kolom/tabel:** buat file baru mis. `db/migrations/0002_tambah_kolom.sql`, isi SQL-nya,
lalu jalankan `npm run db:migrate` (di lokal dan di VPS — `update.sh` menjalankannya otomatis).

---

## 7. Masalah umum

| Gejala | Solusi |
|---|---|
| `DATABASE_URL belum diatur` | Salin `.env.example` menjadi `.env` dan isi. |
| `password authentication failed` | Username/password di `DATABASE_URL` salah. |
| `relation "products" does not exist` | Jalankan `npm run db:migrate`. |
| Tombol Google tidak muncul / error origin | Tambahkan URL website ke *Authorized JavaScript origins* di Google Cloud Console. |
| Lupa password admin | `npm run admin:create -- email@anda.com "PasswordBaru123"` |
| `An unexpected Turbopack error` / `failed to create junction point` (Windows) | Hapus folder `.next`, lalu jalankan lagi `npm run dev` (sudah memakai webpack, bukan Turbopack). |
| Upload foto gagal di VPS (413) | Pastikan `client_max_body_size 50m;` ada di konfigurasi Nginx. |
