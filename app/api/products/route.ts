import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { productImageUrl } from '@/lib/product-editor';

const schemaSql = `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, tone TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, image_url TEXT, image_key TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;
const defaults = [
  [
    '1',
    'Kemeja Linen Daily',
    'Daily',
    'Sand',
    289000,
    20,
    'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85',
  ],
  [
    '2',
    'Kaos Daily Essential',
    'Daily',
    'Oat',
    159000,
    30,
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85',
  ],
  [
    '3',
    'Celana Linen Relaxed',
    'Daily',
    'Sage',
    319000,
    18,
    'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=900&q=85',
  ],
  [
    '4',
    'Baju Chef Signature',
    'Chef',
    'White',
    349000,
    15,
    'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=900&q=85',
  ],
  [
    '5',
    'Apron Canvas Ground',
    'Chef',
    'Earth',
    219000,
    25,
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85',
  ],
  [
    '6',
    'Topi Chef Classic',
    'Chef',
    'White',
    129000,
    30,
    'https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?auto=format&fit=crop&w=900&q=85',
  ],
];
function readArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export async function GET() {
  const d1 = getD1();
  await d1.prepare(schemaSql).run();
  const count = await d1
    .prepare('SELECT COUNT(*) AS count FROM products')
    .first<{ count: number }>();
  if (!count?.count) {
    const now = new Date().toISOString();
    await d1.batch(
      defaults.map((p) =>
        d1
          .prepare(
            'INSERT INTO products (id,name,category,tone,price,stock,image_url,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(...p, 1, now, now),
      ),
    );
  }
  const result = await d1
    .prepare(
      "SELECT id,name,category,subcategory,tone,price,stock,sold_count,preorder_enabled,preorder_days,created_at,description,material,care_instructions,production_estimate,size_guide,variants_json,images_json,COALESCE('/api/product-image/' || image_key,image_url) AS image FROM products WHERE active=1 AND deleted_at IS NULL ORDER BY created_at ASC",
    )
    .all();
  const response = NextResponse.json({
    products: result.results.map((p: any) => {
      const keys = readArray(p.images_json).filter(
        (key): key is string => typeof key === 'string' && Boolean(key),
      );
      const variants = readArray(p.variants_json);
      return {
        ...p,
        variants,
        images: keys.length
          ? keys.map(productImageUrl)
          : [p.image || '/placeholder-product.svg'],
      };
    }),
  });
  response.headers.set(
    'cache-control',
    'public, max-age=15, stale-while-revalidate=60',
  );
  return response;
}
