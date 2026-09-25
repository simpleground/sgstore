import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { productImageUrl } from '@/lib/product-editor';
import { getOpenStore, storeNotFound } from '@/lib/tenant';

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
  const store = await getOpenStore();
  if (!store) return storeNotFound();
  const d1 = getD1();
  const result = await d1
    .prepare(
      "SELECT id,name,category,subcategory,tone,price,stock,sold_count,preorder_enabled,preorder_days,created_at,description,material,care_instructions,production_estimate,size_guide,variants_json,images_json,COALESCE('/api/product-image/' || image_key,image_url) AS image FROM products WHERE store_id=? AND active=1 AND deleted_at IS NULL ORDER BY created_at ASC",
    )
    .bind(store.id)
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
