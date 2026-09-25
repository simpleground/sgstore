-- Multi-toko, fase 10: tautan masuk sekali pakai dari panel platform ke admin toko
-- (super admin tidak perlu login ulang di setiap domain toko).
-- Hanya menambah tabel baru.

CREATE TABLE IF NOT EXISTS admin_handoff_tokens (
  -- SHA-256 dari token; token aslinya hanya ada di tautan.
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users (user_id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_handoff_expires ON admin_handoff_tokens (expires_at);
