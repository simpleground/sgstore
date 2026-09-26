-- Peran & izin yang bisa diatur admin platform (Admin → Peran & izin).
-- Hanya menambah: tabel baru dan satu kolom opsional di store_memberships.
--
-- Baris dengan id 'store_admin' / 'store_staff' (is_system=1) menyimpan izin
-- peran bawaan yang sudah diubah; tanpa baris itu dipakai izin bawaan di
-- lib/permissions.ts. Pemilik toko selalu punya semua izin.
-- Peran kustom punya tingkat dasar (base_role) untuk urutan wewenang saat
-- mengelola anggota; izinnya ditentukan sendiri.

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_role TEXT NOT NULL CHECK (base_role IN ('store_admin', 'store_staff')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Peran kustom anggota (NULL = memakai peran bawaan di kolom role).
ALTER TABLE store_memberships
  ADD COLUMN IF NOT EXISTS custom_role_id TEXT REFERENCES admin_roles (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_store_memberships_custom_role ON store_memberships (custom_role_id);
