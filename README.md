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
| `npm run db:seed-demo` | Menambah produk demo bila toko belum punya produk (`-- --store=slug` untuk toko lain) |
| `npm run admin:create -- email "password" "Nama"` | Membuat admin / reset password admin (tambahkan `--store=slug` untuk toko lain, `--super` untuk admin platform) |
| `npm run typecheck` · `npm run lint` · `npm test` | Pemeriksaan kode |
| `npm run test:integration` | Tes integrasi dengan PostgreSQL sungguhan (lihat bawah) |

### Tes integrasi

Menjalankan aplikasi sungguhan (`next dev`) terhadap PostgreSQL dan menguji alur utama
(admin, katalog, keranjang, ongkir, pesanan, pembayaran Midtrans, ulasan) serta fondasi multi-toko.

```bash
TEST_DATABASE_URL=postgres://sgstore:sgstore@localhost:5432/sgstore npm run test:integration
```

Aman untuk database yang sudah berisi data: setiap run membuat **schema sementara** sendiri
(`sg_it_…`), menjalankan migrasi di sana, lalu menghapus schema itu lagi. Tabel yang ada tidak disentuh.
Biteship diganti server tiruan lokal; tidak ada panggilan ke Midtrans/Biteship sungguhan.

### Menjalankan dengan Docker

```bash
docker compose --profile app up -d --build   # PostgreSQL + aplikasi di http://localhost:3000
```

Aplikasi membaca `.env` bila ada; `DATABASE_URL` otomatis diarahkan ke container PostgreSQL dan
migrasi dijalankan setiap kali container menyala. Foto produk disimpan di volume `sgstore-storage`.
Image juga bisa dibangun sendiri: `docker build -t sgstore --build-arg SITE_URL=https://domain-anda .`
(`SITE_URL` dan `NEXT_PUBLIC_GOOGLE_CLIENT_ID` dibaca saat build; variabel lain saat container dijalankan).

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
| `DEFAULT_STORE_SLUG` | | Toko untuk domain yang tidak terdaftar (bawaan: toko awal `simple-ground`) |
| `PLATFORM_ROOT_DOMAIN` | | Domain platform untuk subdomain toko, mis. `platform.id` → `tokoa.platform.id` |
| `DATABASE_URL` | ✔ | Koneksi PostgreSQL `postgres://user:pass@host:5432/db` |
| `DATABASE_SSL` | | `require` untuk database cloud yang mewajibkan SSL |
| `APP_ENCRYPTION_KEY` | ✔ | Minimal 32 karakter acak (`openssl rand -hex 32`) untuk mengenkripsi kunci Midtrans/Biteship tiap toko. Dibuat otomatis oleh `setup-vps.sh`/`update.sh`. **Jangan diganti** setelah dipakai. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ✔ | Akun admin utama; dibuat otomatis saat login pertama, password ikut diperbarui bila diubah |
| `ADMIN_NAME` | | Nama tampilan admin utama (bawaan `Admin`) |
| `ADMIN_EMAILS` | | Email Google yang otomatis boleh masuk admin (pisahkan koma) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | | Client ID Google Sign-In (bawaan: milik proyek lama) |
| `STORAGE_DRIVER` | | `local` (bawaan) atau `s3` |
| `STORAGE_LOCAL_DIR` | | Folder foto, bawaan `./storage` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | | Untuk R2/S3 |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | | Kunci Midtrans **toko bawaan** (bila belum diisi di Admin → Pengaturan). Toko lain wajib memakai akun Midtrans sendiri. |
| `MIDTRANS_IS_PRODUCTION` | | `false` = Sandbox |
| `BITESHIP_API_KEY` | ✔ untuk ongkir | Kunci Biteship platform (dipakai toko yang belum mengisi kuncinya sendiri) |
| `BITESHIP_MODE` | | `sandbox` = tarif simulasi bila API gagal |
| `BITESHIP_ORIGIN_POSTAL_CODE` | | Kode pos gudang toko bawaan, bawaan `44163` (toko lain mengatur di Admin → Pengaturan) |

---

## 6. Struktur project

```
app/                 Halaman & API (Next.js App Router)
  (storefront)/      Etalase: beranda, produk, checkout (layout menolak toko nonaktif)
  admin/             Panel admin (+ admin/login)
  platform/          Panel platform untuk admin platform (membuat & mengelola toko)
  api/               Endpoint API (produk, pesanan, pembayaran, ongkir, admin)
db/index.ts          Koneksi PostgreSQL (API bergaya D1: prepare/bind/first/all/run/batch)
db/migrations/       File SQL skema database — tambah file baru untuk perubahan skema
lib/                 Logika bersama (auth admin, storage, Biteship, toko aktif, dll.)
scripts/             migrate, create-admin, seed-demo, test-integration
tests/integration/   Tes integrasi (PostgreSQL + server Next.js)
deploy/              Skrip VPS (setup, update, backup, add-domain), Nginx, konfigurasi Cloudflare
```

### Multi-toko

Satu aplikasi melayani beberapa toko. Toko dipilih dari **domain** yang dibuka:
domain yang terdaftar di tabel `store_domains`, atau subdomain `<slug>.PLATFORM_ROOT_DOMAIN`.
Domain lain (localhost, domain lama) memakai toko bawaan **Simple Ground** — perilaku lama tetap sama.

Data setiap toko (produk, pesanan, pelanggan, ulasan, keranjang, kurir, newsletter, foto) terpisah:
admin hanya bisa mengelola toko tempat ia menjadi anggota; akun `ADMIN_EMAIL` adalah admin platform
yang bisa mengelola semua toko. Pelanggan punya akun terpisah di setiap toko.

**Peran anggota toko** (atur di Admin → Anggota):

| Peran | Boleh |
|---|---|
| Pemilik | Semua, termasuk mengatur pemilik & admin lain |
| Admin | Semua pengelolaan toko; di menu Anggota hanya boleh menambah/mengubah/mengeluarkan Staf |
| Staf | Pesanan dan produk (tanpa hapus permanen, impor CSV, gabung produk, kategori); tanpa ulasan, pengiriman, anggota, aktivitas |

Anggota baru yang ditambahkan dari panel masuk dengan **tombol Google** memakai email tersebut
(akun baru sengaja dibuat tanpa password). Password bisa diberikan oleh pengelola server:
`npm run admin:create -- email "Password" "Nama" --store=slug`. Toko selalu punya minimal satu Pemilik.
Semua tindakan penting admin (masuk, produk, pesanan, anggota, dll.) tercatat di Admin → Aktivitas.

**Pengaturan per toko** (Admin → Pengaturan): nama & kontak, WhatsApp, media sosial, catatan checkout,
metode pembayaran yang direkomendasikan, awalan nomor pesanan, kode pos gudang (Pemilik & Admin), serta
rekening transfer manual dan kunci Midtrans/Biteship (**hanya Pemilik**). Kunci API disimpan terenkripsi
(`APP_ENCRYPTION_KEY`) dan tidak pernah ditampilkan lagi. Setiap toko memakai akun Midtrans sendiri:
di dashboard Midtrans toko tersebut, set *Payment Notification URL* ke
`https://<domain-toko>/api/payments/midtrans/notification`.

**Tampilan per toko** (Admin → Tampilan, Pemilik & Admin): logo, ikon tab, warna utama & aksen, gaya huruf,
pengumuman, slide beranda, bagian "Tentang", ulasan & newsletter (tampil/sembunyi), slogan, serta judul &
deskripsi SEO dan gambar saat dibagikan. Semua toko memakai kode yang sama; yang berbeda hanya pengaturannya.
**Tata letak** per toko: header (klasik / logo di tengah / berwarna), banner beranda (terbelah / foto penuh /
teks saja) dengan gambar banner per slide (opsional), kartu produk (klasik / berbingkai / minimal), 3 atau 4
kolom produk, sudut (membulat / sedikit / tajam), latar halaman, footer gelap/terang, kotak info di bawah
banner, dan urutan bagian beranda. Gaya huruf: Klasik, Modern, Elegan (Playfair), Editorial (Fraunces), Ramah
(Nunito), Tegas (Space Grotesk) — semua self-hosted. Pilihan awal = tampilan Simple Ground.
Toko tanpa warna sendiri memakai warna Simple Ground. Gambar diunggah sebagai PNG/JPG/WebP
(SVG ditolak) dan disimpan di folder toko itu sendiri.

**Panel admin & menu** — semuanya ada di `/admin` dengan sidebar berkelompok: *Ringkasan* (Dashboard),
*Platform* (Website, Peran & izin — hanya super admin/akun `ADMIN_EMAIL`), *Penjualan* (Pesanan, Laporan,
Ulasan), *Katalog & toko* (Produk, Pengiriman, Tampilan, Pengaturan), dan *Tim* (Anggota, Aktivitas). Menu
hanya tampil bila peran mengizinkan. `/platform` lama diarahkan ke menu yang sesuai.

**Website** (Platform → Website): tabel semua website dengan pencarian & filter status. *Tambah website*
(modal: nama, slug/subdomain, email pemilik, domain opsional) langsung aktif di `<slug>.PLATFORM_ROOT_DOMAIN`;
pemilik masuk ke `/admin` di domain tokonya dengan Google memakai email tersebut. *Detail* (modal) menampilkan
domain, pemilik, jumlah produk & pesanan; *Ubah* (modal) mengganti nama, status, domain (tambah/lepas/utama),
dan menambah pemilik:

| Status | Etalase & checkout | Admin toko |
|---|---|---|
| Aktif | buka | bisa masuk |
| Ditangguhkan | ditutup (pesan "tidak aktif"); pesanan lama tetap bisa dicek & dibayar | bisa masuk |
| Ditutup | ditutup | hanya admin platform |

Data toko tidak pernah dihapus dari panel. Tombol *Kelola* membuka admin website itu di domainnya sendiri dan
langsung masuk sebagai super admin, lewat tautan sekali pakai 60 detik (hanya hash token yang disimpan, tabel
`admin_handoff_tokens`); tercatat di Aktivitas toko sebagai masuk "platform".

**Pesanan** — super admin melihat pesanan semua website (filter *Semua website* atau satu website), pemilik &
anggota toko hanya pesanan tokonya sendiri. Filter status, tanggal (WIB), pencarian nomor/nama/telepon; detail,
ubah status, WA pembeli, dan cetak label (pengirim = toko pemilik pesanan). Perubahan tercatat di Aktivitas toko
terkait.

**Laporan** (izin `reports.view`) — tiga tab, untuk super admin bisa semua website atau satu website, untuk
toko lain hanya tokonya sendiri. Masing-masing bisa diunduh sebagai CSV (pemisah `;`, langsung terbuka di Excel):
- *Keuangan*: omzet terkonfirmasi (pesanan dibayar, termasuk ongkir), produk vs ongkir, rata-rata per pesanan,
  grafik per hari/bulan (WIB), pemasukan per metode pembayaran, nilai pesanan menunggu & batal, perbandingan
  website, status pesanan. CSV = daftar pesanan periode.
- *Penjualan produk*: semua produk terjual di periode (jumlah, pesanan, penjualan) dan ringkasan per kategori.
- *Stok inventori*: stok per varian saat ini, nilai stok, status habis/menipis (≤ 5)/aman, pre-order.

**Peran & izin** (Platform → Peran & izin, super admin) — Pemilik selalu punya semua izin. Izin *Admin* dan
*Staf* bawaan bisa diubah (berlaku di semua toko), dan bisa dibuat peran kustom (mis. "Admin Keuangan") dengan
tingkat dasar Admin/Staf dan centang izin. Peran kustom dipilih di menu *Anggota* setiap toko; tingkat dasarnya
menentukan siapa boleh mengubah anggota tersebut (Admin toko hanya boleh memberi peran tingkat Staf). Peran kustom
yang dihapus mengembalikan anggotanya ke peran dasar. Disimpan di tabel `admin_roles` dan
`store_memberships.custom_role_id`.

**Mencoba di komputer lokal:** isi `PLATFORM_ROOT_DOMAIN=localhost` di `.env`, masuk ke
`http://localhost:3000/admin` dengan `ADMIN_EMAIL`, buka menu *Website*, buat toko
dengan slug mis. `toko-b`, lalu buka `http://toko-b.localhost:3000` (Chrome/Edge/Firefox otomatis
mengarahkan `*.localhost` ke komputer sendiri).

**Checklist membuka toko baru:** Tampilan (logo, warna, isi beranda) · Pengaturan (kontak, rekening,
kode pos gudang, kunci Midtrans sendiri) · produk · domain & SSL (lihat di bawah) · origin Google.

#### Subdomain & domain sendiri di VPS

Aplikasi memilih toko dari nama domain, jadi semua domain cukup diarahkan ke aplikasi yang sama.

*Subdomain platform* (`<slug>.platform.id`), sekali saja:

1. `.env`: `PLATFORM_ROOT_DOMAIN=platform.id`, lalu `pm2 reload sgstore --update-env`.
2. DNS: A record `*.platform.id` (dan `platform.id`) ke IP VPS.
3. Sertifikat wildcard (Let's Encrypt mewajibkan verifikasi DNS; Certbot meminta Anda membuat TXT record):
   `sudo certbot certonly --manual --preferred-challenges dns -d platform.id -d '*.platform.id'`
   Sertifikat manual tidak diperpanjang otomatis — untuk perpanjangan otomatis pakai plugin DNS penyedia
   domain Anda (mis. `python3-certbot-dns-cloudflare`).
4. Nginx: salin `deploy/nginx-sgstore.conf` sebagai `/etc/nginx/sites-available/sgstore-platform`, ganti
   `server_name` menjadi `platform.id *.platform.id;`, aktifkan, lalu
   `sudo certbot install --nginx --cert-name platform.id` dan `sudo systemctl reload nginx`.

*Domain sendiri* (`tokoanda.com`), per toko: tambahkan domain di Admin → Website → Ubah, arahkan A record `@` dan
`www` ke IP VPS, lalu jalankan `sudo bash /var/www/sgstore/deploy/add-domain.sh tokoanda.com`
(membuat server block Nginx + sertifikat SSL).

Untuk setiap domain baru, tambahkan juga `https://<domain>` di Google Cloud Console → *Authorized
JavaScript origins* (login Google), dan bila toko memakai Midtrans, set *Payment Notification URL* akun
Midtrans toko itu ke `https://<domain>/api/payments/midtrans/notification`.

> **Sebelum `npm run db:migrate` di server, buat backup** (`deploy/backup.sh`). Migrasi multi-toko
> (0004) tidak bisa dipakai oleh kode versi lama; kembali ke versi lama = pulihkan backup.

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
