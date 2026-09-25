-- Multi-toko, fase 1: kolom store_id pada tabel yang datanya milik sebuah toko.
-- Hanya menambah (additive). Baris lama otomatis menjadi milik toko 'default'.
--
-- DEFAULT 'default' sengaja dipertahankan untuk sementara agar kode yang belum
-- mengisi store_id tetap berjalan. Setelah semua INSERT mengisi store_id
-- secara eksplisit (fase isolasi data), DEFAULT ini akan dicabut lewat migrasi baru.
-- Foreign key memakai aturan bawaan (NO ACTION): toko yang masih punya data
-- tidak dapat dihapus.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);
CREATE INDEX IF NOT EXISTS idx_products_store_active_category
  ON products (store_id, active, category);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);
CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders (store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created
  ON orders (store_id, status, created_at);

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);
CREATE INDEX IF NOT EXISTS idx_reviews_store_product_active
  ON reviews (store_id, product_id, active);

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);
CREATE INDEX IF NOT EXISTS idx_cart_items_store_user ON cart_items (store_id, user_id);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);
CREATE INDEX IF NOT EXISTS idx_customers_store ON customers (store_id);

ALTER TABLE customer_sessions
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);

ALTER TABLE shipping_settings
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default' REFERENCES stores (id);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_store
  ON newsletter_subscribers (store_id);
