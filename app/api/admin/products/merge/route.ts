import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';

async function auth() {
  const user = await getChatGPTUser();
  return user && Boolean(await getD1().prepare('SELECT user_id FROM admin_users WHERE user_id=?').bind(user.userId).first());
}

type Variant = { sku?: string; color: string; size: string; normalPrice?: number; price: number; stock: number };
const variantKey = (variant: Variant) => variant.sku?.trim().toLowerCase() || `${variant.color.trim().toLowerCase()}|${variant.size.trim().toLowerCase()}`;

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  try {
    const { targetId, sourceIds } = (await req.json()) as { targetId?: string; sourceIds?: string[] };
    const sources = Array.from(new Set((sourceIds || []).filter((id) => id && id !== targetId)));
    if (!targetId || !sources.length) throw new Error('Pilih satu produk induk dan minimal satu produk sumber.');

    const db = getD1();
    const ids = [targetId, ...sources];
    const products: any[] = [];
    for (const id of ids) {
      const product = await db.prepare('SELECT id,name,variants_json,images_json,image_key,image_url FROM products WHERE id=?').bind(id).first<any>();
      if (!product) throw new Error(`Produk ${id} tidak ditemukan.`);
      products.push(product);
    }

    const merged: Variant[] = [];
    const indexes = new Map<string, number>();
    const sourceVariantMaps = new Map<string, number[]>();
    for (const product of products) {
      let rows: Variant[] = [];
      try { rows = JSON.parse(product.variants_json || '[]'); } catch {}
      const map: number[] = [];
      for (const variant of rows) {
        const key = variantKey(variant);
        const existing = indexes.get(key);
        if (existing !== undefined) {
          if (product.id !== targetId) throw new Error(`Variasi ganda ditemukan: ${variant.sku || `${variant.color} / ${variant.size}`}. Ubah SKU atau variasinya terlebih dahulu.`);
          map.push(existing);
          continue;
        }
        indexes.set(key, merged.length);
        map.push(merged.length);
        merged.push(variant);
      }
      sourceVariantMaps.set(product.id, map);
    }
    if (!merged.length) throw new Error('Produk yang dipilih tidak memiliki variasi.');

    const target = products[0];
    const imageKeys: string[] = [];
    for (const product of products) {
      let keys: string[] = [];
      try { keys = JSON.parse(product.images_json || '[]'); } catch {}
      if (!keys.length && product.image_key) keys = [product.image_key];
      for (const key of keys) if (key && !imageKeys.includes(key) && imageKeys.length < 7) imageKeys.push(key);
    }
    const price = Math.min(...merged.map((v) => Number(v.price)));
    const stock = merged.reduce((sum, v) => sum + Number(v.stock), 0);
    const now = new Date().toISOString();
    const statements: any[] = [
      db.prepare('UPDATE products SET price=?,stock=?,tone=?,variants_json=?,image_key=COALESCE(?,image_key),images_json=?,active=1,updated_at=? WHERE id=?')
        .bind(price, stock, merged[0].color, JSON.stringify(merged), imageKeys[0] || null, JSON.stringify(imageKeys), now, targetId),
    ];

    for (const sourceId of sources) {
      const carts = await db.prepare('SELECT user_id,variant_index,quantity FROM cart_items WHERE product_id=?').bind(sourceId).all<any>();
      const map = sourceVariantMaps.get(sourceId) || [];
      for (const cart of carts.results) {
        const newIndex = map[Number(cart.variant_index)];
        if (newIndex === undefined) continue;
        statements.push(db.prepare('INSERT INTO cart_items (user_id,product_id,variant_index,quantity,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,product_id,variant_index) DO UPDATE SET quantity=quantity+excluded.quantity,updated_at=excluded.updated_at')
          .bind(cart.user_id, targetId, newIndex, cart.quantity, now));
      }
      statements.push(db.prepare('DELETE FROM cart_items WHERE product_id=?').bind(sourceId));
      statements.push(db.prepare('UPDATE reviews SET product_id=?,updated_at=? WHERE product_id=?').bind(targetId, now, sourceId));
      statements.push(db.prepare('UPDATE products SET active=0,updated_at=? WHERE id=?').bind(now, sourceId));
    }
    await db.batch(statements);
    return NextResponse.json({ ok: true, targetId, mergedVariants: merged.length, archivedProducts: sources.length, name: target.name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal menggabungkan produk.' }, { status: 400 });
  }
}
