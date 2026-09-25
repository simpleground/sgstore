-- Multi-toko, fase 5: tampilan per toko (tema, konten beranda, SEO).
-- Hanya menambah kolom baru.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS appearance_json TEXT NOT NULL DEFAULT '{}';

-- Teks & gambar yang sebelumnya tertulis langsung di kode beranda Simple Ground
-- dipindah ke tampilan toko bawaan, sehingga halamannya tidak berubah.
INSERT INTO store_settings (store_id, settings_json, appearance_json, updated_at)
SELECT
  'default',
  '{}',
  $json${
    "theme": {"primaryColor": "", "accentColor": "", "font": "classic"},
    "content": {
      "announcement": "Belanja online · Bayar VA / QRIS · WhatsApp untuk konsultasi",
      "searchPlaceholder": "Cari kaos, kemeja, baju chef...",
      "tagline": "Daily wear dan kitchen wear yang sederhana, nyaman, dan tahan lama.",
      "heroSlides": [
        {"eyebrow": "SIMPLE GROUND ESSENTIALS", "title": "Seragam kerja yang terasa senyaman pakaian sehari-hari.", "body": "Potongan fungsional, karakter tenang, dan pilihan produk untuk mendampingi rutinitas setiap hari.", "category": "Semua", "label": "Semua koleksi"},
        {"eyebrow": "CHEF & KITCHEN WEAR", "title": "Dirancang untuk ritme dapur yang bergerak cepat.", "body": "Baju chef, apron, dan perlengkapan kerja dengan tampilan rapi serta pilihan varian yang mudah disesuaikan.", "category": "Chef & Kitchen Wear", "label": "Koleksi dapur"},
        {"eyebrow": "PROFESSIONAL WORKWEAR", "title": "Tampil profesional tanpa kehilangan kenyamanan.", "body": "Seragam kerja dengan siluet bersih untuk tim, usaha, dan kebutuhan profesional sehari-hari.", "category": "Professional Workwear", "label": "Workwear pilihan"},
        {"eyebrow": "DAILY BASIC", "title": "Pilihan sederhana yang mudah dipakai berulang kali.", "body": "Kaos, kemeja, dan celana dengan warna serbaguna untuk membangun pakaian harian yang praktis.", "category": "Daily Basic", "label": "Daily essentials"},
        {"eyebrow": "PILIHAN SIMPLE GROUND", "title": "Temukan produk terbaru dan yang paling banyak dipilih.", "body": "Jelajahi seluruh katalog, bandingkan warna dan ukuran, lalu pilih yang paling sesuai untukmu.", "category": "Semua", "label": "Produk pilihan"}
      ],
      "about": {
        "enabled": true,
        "eyebrow": "Tentang Simple Ground",
        "title": "Lebih sedikit, lebih dekat dengan yang penting.",
        "body": "Kami percaya benda yang baik tidak perlu berteriak. Setiap koleksi dirancang dalam jumlah terbatas, mengutamakan bahan nyaman dan siluet yang mudah dipakai berulang kali.",
        "imageAlt": "Gedung dengan identitas Simple Ground di tengah lanskap hijau",
        "highlights": [
          {"title": "Mudah", "caption": "pilih varian"},
          {"title": "Cepat", "caption": "bantuan WhatsApp"},
          {"title": "Jelas", "caption": "harga & stok"}
        ]
      },
      "showReviews": true,
      "newsletter": {
        "enabled": true,
        "eyebrow": "Ground Notes",
        "title": "Koleksi baru, cerita bahan, dan penawaran khusus.",
        "body": "Kami mengirim seperlunya. Tidak ada pesan yang memenuhi kotak masuk."
      }
    },
    "seo": {
      "title": "Simple Ground — Daily & Kitchen Wear",
      "description": "Belanja baju chef, seragam kerja, dan daily wear Simple Ground. Pilih ukuran, cek ongkir, dan bayar dengan Virtual Account atau QRIS. Konsultasi tersedia via WhatsApp.",
      "shareDescription": "Pakaian daily, linen, dan perlengkapan chef yang nyaman serta tahan lama."
    },
    "images": {"logo": "", "favicon": "/favicon.svg", "about": "/simple-ground-building.png", "share": "/og.png"}
  }$json$,
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE EXISTS (SELECT 1 FROM stores WHERE id = 'default')
ON CONFLICT (store_id) DO UPDATE SET appearance_json = excluded.appearance_json
  WHERE store_settings.appearance_json = '{}';

-- Pengirim pada label pengiriman (sebelumnya tertulis di kode admin).
UPDATE stores
SET phone = '085172381996',
    address = 'Kp. Dungus Maung RT 7 RW 4, Sirnagalih, Cisurupan, Garut, Jawa Barat 44163'
WHERE id = 'default' AND phone = '' AND address = '';
