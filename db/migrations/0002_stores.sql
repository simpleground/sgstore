-- Multi-toko, fase 1: tabel toko, domain, dan keanggotaan admin per toko.
-- Hanya menambah (additive): tidak ada kolom/tabel lama yang diubah atau dihapus.
--
-- Semua data lama menjadi milik toko bawaan dengan id 'default'
-- (slug 'simple-ground'). Id ini dipakai sebagai DEFAULT kolom store_id di
-- 0003_tenant_columns.sql dan sebagai DEFAULT_STORE_ID di lib/tenant.ts.

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  -- Dipakai sebagai subdomain: huruf kecil, angka, dan tanda hubung.
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  currency TEXT NOT NULL DEFAULT 'IDR',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO stores (id, slug, name, created_at, updated_at)
VALUES (
  'default',
  'simple-ground',
  'Simple Ground',
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
ON CONFLICT (id) DO NOTHING;

-- Domain / subdomain lengkap yang mengarah ke sebuah toko (tanpa port, huruf kecil).
CREATE TABLE IF NOT EXISTS store_domains (
  host TEXT PRIMARY KEY CHECK (host = lower(host) AND host ~ '^[a-z0-9.-]+$'),
  store_id TEXT NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_domains_store ON store_domains (store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_domains_primary
  ON store_domains (store_id) WHERE is_primary = 1;

-- Peran platform (lintas toko). NULL = bukan admin platform.
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS platform_role TEXT CHECK (platform_role IN ('super_admin'));

-- Hubungan admin ↔ toko beserta perannya.
CREATE TABLE IF NOT EXISTS store_memberships (
  store_id TEXT NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES admin_users (user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('store_owner', 'store_admin', 'store_staff')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_store_memberships_user ON store_memberships (user_id);

-- Saat ini setiap admin punya akses penuh, jadi semua admin yang sudah ada
-- menjadi pemilik toko bawaan. Peran bisa dipersempit setelah fase peran aktif.
INSERT INTO store_memberships (store_id, user_id, role, created_at, updated_at)
SELECT
  'default',
  user_id,
  'store_owner',
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM admin_users
ON CONFLICT (store_id, user_id) DO NOTHING;
