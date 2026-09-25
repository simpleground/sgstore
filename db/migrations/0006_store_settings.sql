-- Multi-toko, fase 4: pengaturan & integrasi per toko. Hanya menambah tabel baru.

-- Pengaturan yang boleh dilihat publik (kontak, rekening transfer, dll.).
-- Bentuk JSON-nya divalidasi aplikasi (lib/store-settings.ts).
CREATE TABLE IF NOT EXISTS store_settings (
  store_id TEXT PRIMARY KEY REFERENCES stores (id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

-- Kunci rahasia per toko, dienkripsi aplikasi (AES-256-GCM, APP_ENCRYPTION_KEY).
-- `hint` = 4 karakter terakhir untuk ditampilkan di panel admin.
CREATE TABLE IF NOT EXISTS store_secrets (
  store_id TEXT NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name IN ('midtrans_server_key', 'biteship_api_key')),
  value_encrypted TEXT NOT NULL,
  hint TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_id, name)
);

-- Nilai yang sebelumnya tertulis langsung di kode toko bawaan (Simple Ground)
-- dipindah ke pengaturannya, sehingga tampilan toko tidak berubah.
INSERT INTO store_settings (store_id, settings_json, updated_at)
SELECT
  'default',
  '{
    "whatsapp": "6285172381996",
    "socialLinks": [
      {"label": "Facebook", "url": "https://www.facebook.com/profile.php?id=61586255756281"},
      {"label": "Instagram", "url": "https://www.instagram.com/simple_ground"},
      {"label": "TikTok", "url": "https://www.tiktok.com/@simple.ground"},
      {"label": "X / Twitter", "url": "https://x.com/Simple_Ground"},
      {"label": "Shopee", "url": "https://shopee.co.id/simpleground?entryPoint=ShopBySearch&searchKeyword=simple%20ground"},
      {"label": "YouTube", "url": "https://youtube.com/@simple_ground"}
    ],
    "checkoutNoticeTitle": "Pemeliharaan pembayaran QRIS & Virtual Account",
    "checkoutNotice": "Pembayaran QRIS dan Virtual Account sedang dalam pemeliharaan. Untuk sementara, kami menyarankan Anda memilih transfer manual Bank Mandiri. Pembayaran manual akan dikonfirmasi oleh admin.",
    "recommendedPayment": "manual",
    "orderPrefix": "SG",
    "manualPayment": {
      "enabled": true,
      "bankName": "Bank Mandiri",
      "accountNumber": "9000027694984",
      "accountHolder": "Muhammad Arifin"
    },
    "midtrans": {"enabled": true}
  }',
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE EXISTS (SELECT 1 FROM stores WHERE id = 'default')
ON CONFLICT (store_id) DO NOTHING;
