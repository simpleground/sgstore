-- Multi-toko, fase 2: kunci unik per toko dan relasi yang tidak bisa lintas toko.
-- Tidak ada baris yang dihapus. Aman dijalankan ulang.
--
-- PENTING: setelah migrasi ini, kode sebelum fase 2 tidak bisa dipakai lagi
-- (INSERT tanpa store_id ditolak, kunci pelanggan berubah). Buat backup dulu
-- (deploy/backup.sh); kembali ke versi lama = pulihkan backup tersebut.

-- Admin yang dibuat setelah 0002 (mis. akun ADMIN_EMAIL saat login pertama)
-- belum punya toko: jadikan pemilik toko bawaan, sama seperti di 0002.
INSERT INTO store_memberships (store_id, user_id, role, created_at, updated_at)
SELECT
  'default',
  a.user_id,
  'store_owner',
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM admin_users a
WHERE NOT EXISTS (SELECT 1 FROM store_memberships m WHERE m.user_id = a.user_id)
ON CONFLICT (store_id, user_id) DO NOTHING;

-- Target foreign key komposit (store_id, id): data lain hanya boleh menunjuk
-- produk di toko yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS products_store_id_id_key ON products (store_id, id);

-- Pelanggan per toko: orang yang sama (akun Google yang sama) punya data
-- terpisah di setiap toko.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'customers'::regclass AND conname = 'customers_store_pkey'
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_pkey;
    ALTER TABLE customers ADD CONSTRAINT customers_store_pkey PRIMARY KEY (store_id, user_id);
  END IF;
END $$;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS customers_store_email_key ON customers (store_id, email);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'cart_items'::regclass AND conname = 'cart_items_store_pkey'
  ) THEN
    ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_pkey;
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_store_pkey PRIMARY KEY (store_id, user_id, product_id, variant_index);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shipping_settings'::regclass AND conname = 'shipping_settings_store_pkey'
  ) THEN
    ALTER TABLE shipping_settings DROP CONSTRAINT IF EXISTS shipping_settings_pkey;
    ALTER TABLE shipping_settings
      ADD CONSTRAINT shipping_settings_store_pkey PRIMARY KEY (store_id, courier_code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'newsletter_subscribers'::regclass
      AND conname = 'newsletter_subscribers_store_pkey'
  ) THEN
    ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_subscribers_pkey;
    ALTER TABLE newsletter_subscribers
      ADD CONSTRAINT newsletter_subscribers_store_pkey PRIMARY KEY (store_id, email);
  END IF;

  -- Relasi komposit. NOT VALID: berlaku untuk semua data baru/berubah, tetapi
  -- baris lama yang mungkin yatim (warisan data D1) tidak membuat migrasi gagal.
  -- Bisa diperiksa belakangan dengan ALTER TABLE … VALIDATE CONSTRAINT ….
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'cart_items'::regclass AND conname = 'cart_items_store_product_fkey'
  ) THEN
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_store_product_fkey
      FOREIGN KEY (store_id, product_id) REFERENCES products (store_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reviews'::regclass AND conname = 'reviews_store_product_fkey'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_store_product_fkey
      FOREIGN KEY (store_id, product_id) REFERENCES products (store_id, id) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'customer_sessions'::regclass
      AND conname = 'customer_sessions_store_customer_fkey'
  ) THEN
    ALTER TABLE customer_sessions ADD CONSTRAINT customer_sessions_store_customer_fkey
      FOREIGN KEY (store_id, user_id) REFERENCES customers (store_id, user_id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- Mulai sekarang setiap INSERT wajib menyebut toko secara eksplisit.
-- Kode yang lupa mengisi store_id akan gagal, bukan diam-diam masuk ke toko bawaan.
ALTER TABLE products ALTER COLUMN store_id DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN store_id DROP DEFAULT;
ALTER TABLE reviews ALTER COLUMN store_id DROP DEFAULT;
ALTER TABLE cart_items ALTER COLUMN store_id DROP DEFAULT;
ALTER TABLE customers ALTER COLUMN store_id DROP DEFAULT;
ALTER TABLE customer_sessions ALTER COLUMN store_id DROP DEFAULT;
ALTER TABLE shipping_settings ALTER COLUMN store_id DROP DEFAULT;
ALTER TABLE newsletter_subscribers ALTER COLUMN store_id DROP DEFAULT;
