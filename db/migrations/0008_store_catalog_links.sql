-- Multi-toko, fase 6: urutan kategori, subkategori tersembunyi, dan tautan
-- "Belanja" di footer menjadi bagian tampilan toko. Nilai Simple Ground yang
-- sebelumnya tertulis di kode beranda dipindah ke tampilan toko bawaan.
UPDATE store_settings
SET appearance_json = jsonb_set(
  appearance_json::jsonb,
  '{content}',
  (appearance_json::jsonb -> 'content') || $json${
    "catalogOrder": [
      {"category": "Chef & Kitchen Wear", "subcategories": ["Baju Chef", "Apron"]},
      {"category": "Professional Workwear", "subcategories": ["Kemeja PDL", "Seragam Kerja"]},
      {"category": "Daily Basic", "subcategories": ["Kaos", "Kemeja", "Celana"]}
    ],
    "hiddenSubcategories": ["Topi Chef"],
    "shopLinks": [
      {"label": "Koleksi Daily", "category": "Daily Basic", "subcategory": "Semua"},
      {"label": "Baju Chef", "category": "Chef & Kitchen Wear", "subcategory": "Baju Chef"},
      {"label": "Chef & Kitchen Wear", "category": "Chef & Kitchen Wear", "subcategory": "Semua"}
    ]
  }$json$::jsonb
)::text
WHERE store_id = 'default'
  AND appearance_json::jsonb ? 'content'
  AND NOT (appearance_json::jsonb -> 'content') ? 'shopLinks';
