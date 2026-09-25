import { NextResponse } from 'next/server';
import { adminCan, authorizeStore, forbiddenForRole } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { getD1, getFiles } from '@/db';
import { validateVariants, resolveGallery, productImageUrl } from '@/lib/product-editor';
import {
  normalizeCategory,
  normalizeSubcategory,
} from '@/lib/catalog-normalize';
import { storeFileKey } from '@/lib/tenant';
async function images(storeId: string, files: File[]) {
  if (files.length > 9) throw new Error('Maksimal 9 foto per produk.');
  const keys: string[] = [];
  for (const file of files) {
    if (!file.size) continue;
    if (
      file.size > 5e6 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      throw new Error('Setiap foto harus JPG, PNG, atau WebP maksimal 5 MB.');
    const key = storeFileKey(
      storeId,
      'products',
      file.type.split('/')[1].replace('jpeg', 'jpg'),
    );
    await getFiles().put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    keys.push(key);
  }
  return keys;
}
const imageUrl = productImageUrl;
const gallery = (p: any) => {
  const keys = JSON.parse(p.images_json || '[]') as string[];
  const urls = keys.map(imageUrl);
  if (!urls.length) urls.push(p.image || '/placeholder-product.svg');
  return urls;
};
function variants(raw: string) {
  const rows = raw
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((x) => x.trim());
      let sku = '',
        color = '',
        size = '',
        normalPrice = '',
        price = '',
        stock = '';
      if (parts.length === 6)
        [sku, color, size, normalPrice, price, stock] = parts;
      else if (parts.length === 5) {
        [sku, color, size, price, stock] = parts;
        normalPrice = price;
      } else {
        [color, size, price, stock] = parts;
        normalPrice = price;
      }
      return {
        sku,
        color,
        size,
        normalPrice: Number(normalPrice),
        price: Number(price),
        stock: Number(stock),
      };
    });
  if (
    !rows.length ||
    rows.some(
      (v) =>
        !v.color ||
        !v.size ||
        !Number.isSafeInteger(v.price) || !Number.isSafeInteger(v.normalPrice) || !Number.isSafeInteger(v.stock) || v.price <= 0 ||
        v.normalPrice < v.price ||
        v.stock < 0,
    )
  )
    throw new Error(
      'Lengkapi varian. Harga normal tidak boleh lebih kecil dari harga jual.',
    );
  return rows;
}
function preorderSettings(f: FormData) {
  const enabled = f.get('preorder_enabled') === '1' ? 1 : 0;
  const days = Number(f.get('preorder_days') ?? 2);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Waktu pre-order harus 1–365 hari.');
  return { enabled, days };
}
const select =
  "SELECT id,name,category,subcategory,tone,price,stock,sold_count,preorder_enabled,preorder_days,weight_grams,active,created_at,description,material,care_instructions,production_estimate,size_guide,variants_json,images_json,deleted_at,COALESCE('/api/product-image/' || image_key,image_url) AS image FROM products";
export async function GET() {
  const auth = await authorizeStore('products.view');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const r = await getD1()
    .prepare(`${select} WHERE store_id=? ORDER BY updated_at DESC`)
    .bind(admin.store.id)
    .all();
  return NextResponse.json({
    products: r.results.map((p: any) => ({
      ...p,
      variants: JSON.parse(p.variants_json || '[]'),
      images: gallery(p),
    })),
  });
}
export async function POST(req: Request) {
  const auth = await authorizeStore('products.edit');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const storeId = admin.store.id;
  try {
    const f = await req.formData(),
      d1 = getD1(),
      copyId = String(f.get('copyId') || '');
    if (copyId) {
      const p = await d1
        .prepare(`${select} WHERE id=? AND store_id=?`)
        .bind(copyId, storeId)
        .first<any>();
      if (!p) throw new Error('Produk tidak ditemukan.');
      const id = crypto.randomUUID(),
        now = new Date().toISOString();
      await d1
        .prepare(
          "INSERT INTO products (id,store_id,name,category,subcategory,tone,price,stock,sold_count,preorder_enabled,preorder_days,weight_grams,description,material,care_instructions,production_estimate,size_guide,variants_json,image_url,image_key,images_json,active,created_at,updated_at) SELECT ?,store_id,name||' (Salinan)',category,subcategory,tone,price,stock,sold_count,preorder_enabled,preorder_days,weight_grams,description,material,care_instructions,production_estimate,size_guide,variants_json,image_url,image_key,images_json,0,?,? FROM products WHERE id=? AND store_id=?",
        )
        .bind(id, now, now, copyId, storeId)
        .run();
      await audit(admin, {
        storeId,
        action: 'product.copy',
        target: { type: 'product', id },
        meta: { from: copyId, name: p.name },
      });
      return NextResponse.json({ ok: true, id });
    }
    const name = String(f.get('name') || '').trim(),
      category = normalizeCategory(String(f.get('category') || '')),
      subcategory = normalizeSubcategory(String(f.get('subcategory') || '')),
      description = String(f.get('description') || '').trim(),
      material = String(f.get('material') || '').trim(),
      careInstructions = String(f.get('care_instructions') || '').trim(),
      productionEstimate = String(f.get('production_estimate') || '').trim(),
      sizeGuide = String(f.get('size_guide') || '').trim(),
      soldCount = Number(f.get('sold_count') || 0),
      preorder = preorderSettings(f),
      weightGrams = Number(f.get('weightGrams') || 500),
      vs = f.has('variantsJson') ? validateVariants(JSON.parse(String(f.get('variantsJson')))) : variants(String(f.get('variants') || ''));
    const uploadedKeys = await images(
      storeId,
      f.getAll('images').filter((v): v is File => v instanceof File),
    );
    const keys = f.has('galleryOrder') ? resolveGallery(JSON.parse(String(f.get('galleryOrder'))), [], uploadedKeys) : uploadedKeys;
    if (
      !name ||
      !category ||
      !subcategory ||
      !description ||
      !Number.isInteger(soldCount) ||
      soldCount < 0 ||
      !Number.isInteger(weightGrams) ||
      weightGrams < 1 ||
      weightGrams > 50000
    )
      throw new Error(
        'Lengkapi nama, kategori, subkategori, deskripsi, dan foto.',
      );
    const price = Math.min(...vs.map((v) => v.price)),
      stock = vs.reduce((s, v) => s + v.stock, 0),
      id = crypto.randomUUID(),
      now = new Date().toISOString();
    await d1
      .prepare(
        'INSERT INTO products (id,store_id,name,category,subcategory,tone,price,stock,sold_count,preorder_enabled,preorder_days,weight_grams,description,material,care_instructions,production_estimate,size_guide,variants_json,image_key,images_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        storeId,
        name,
        category,
        subcategory,
        vs[0].color,
        price,
        stock,
        soldCount,
        preorder.enabled,
        preorder.days,
        weightGrams,
        description,
        material,
        careInstructions,
        productionEstimate,
        sizeGuide,
        JSON.stringify(vs),
        keys[0] ?? null,
        JSON.stringify(keys),
        1,
        now,
        now,
      )
      .run();
    await audit(admin, {
      storeId,
      action: 'product.create',
      target: { type: 'product', id },
      meta: { name },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal menyimpan.' },
      { status: 400 },
    );
  }
}
export async function PATCH(req: Request) {
  const auth = await authorizeStore('products.edit');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const storeId = admin.store.id;
  try {
    const f = await req.formData(),
      d1 = getD1(),
      id = String(f.get('id')),
      name = String(f.get('name') || '').trim(),
      category = normalizeCategory(String(f.get('category') || '')),
      subcategory = normalizeSubcategory(String(f.get('subcategory') || '')),
      description = String(f.get('description') || '').trim(),
      material = String(f.get('material') || '').trim(),
      careInstructions = String(f.get('care_instructions') || '').trim(),
      productionEstimate = String(f.get('production_estimate') || '').trim(),
      sizeGuide = String(f.get('size_guide') || '').trim(),
      soldCount = Number(f.get('sold_count') || 0),
      preorder = preorderSettings(f),
      weightGrams = Number(f.get('weightGrams') || 500),
      vs = f.has('variantsJson') ? validateVariants(JSON.parse(String(f.get('variantsJson')))) : variants(String(f.get('variants') || '')),
      active = String(f.get('active')) === 'true' ? 1 : 0,
      old = await d1
        .prepare('SELECT image_key,image_url,images_json FROM products WHERE id=? AND store_id=?')
        .bind(id, storeId)
        .first<{ image_key: string | null; image_url: string | null; images_json: string }>();
    // Check before uploading so a wrong id never leaves orphan files behind.
    if (!old) throw new Error('Produk tidak ditemukan.');
    const newKeys = await images(
        storeId,
        f.getAll('images').filter((v): v is File => v instanceof File),
      ),
      price = Math.min(...vs.map((v) => v.price)),
      stock = vs.reduce((s, v) => s + v.stock, 0),
      storedKeys = JSON.parse(old?.images_json || '[]') as string[],
      previousKeys = storedKeys.length
        ? storedKeys
        : old?.image_key
          ? [old.image_key]
          : old?.image_url ? [old.image_url] : [],
      combinedKeys =
        f.get('replaceImages') === 'true'
          ? newKeys
          : [...previousKeys, ...newKeys],
      finalKeys = f.has('galleryOrder') ? resolveGallery(JSON.parse(String(f.get('galleryOrder'))), previousKeys, newKeys) : combinedKeys;
    if (
      !name ||
      !category ||
      !subcategory ||
      !description ||
      !Number.isInteger(soldCount) ||
      soldCount < 0 ||
      !Number.isInteger(weightGrams) ||
      weightGrams < 1 ||
      weightGrams > 50000
    )
      throw new Error('Lengkapi nama, kategori, subkategori, dan deskripsi.');
    if (finalKeys.length > 9)
      throw new Error('Total foto maksimal 9 per produk.');
    await d1
      .prepare(
        'UPDATE products SET name=?,category=?,subcategory=?,tone=?,price=?,stock=?,sold_count=?,preorder_enabled=?,preorder_days=?,weight_grams=?,description=?,material=?,care_instructions=?,production_estimate=?,size_guide=?,variants_json=?,active=?,image_key=?,image_url=?,images_json=?,updated_at=? WHERE id=? AND store_id=?',
      )
      .bind(
        name,
        category,
        subcategory,
        vs[0].color,
        price,
        stock,
        soldCount,
        preorder.enabled,
        preorder.days,
        weightGrams,
        description,
        material,
        careInstructions,
        productionEstimate,
        sizeGuide,
        JSON.stringify(vs),
        active,
        finalKeys[0] && !/^https?:\/\//.test(finalKeys[0]) ? finalKeys[0] : null,
        finalKeys[0] && /^https?:\/\//.test(finalKeys[0]) ? finalKeys[0] : null,
        JSON.stringify(finalKeys),
        new Date().toISOString(),
        id,
        storeId,
      )
      .run();
    await audit(admin, {
      storeId,
      action: 'product.update',
      target: { type: 'product', id },
      meta: { name },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memperbarui.' },
      { status: 400 },
    );
  }
}
export async function PUT(req: Request) {
  const auth = await authorizeStore('products.edit');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const storeId = admin.store.id;
  try {
    const { id, active, restoreDeleted } = (await req.json()) as {
      id?: string;
      active?: number;
      restoreDeleted?: boolean;
    };
    if (id && restoreDeleted) {
      const product = await getD1()
        .prepare('SELECT deleted_at FROM products WHERE id=? AND store_id=?')
        .bind(id, storeId)
        .first<{ deleted_at: string | null }>();
      if (!product?.deleted_at)
        throw new Error('Produk tidak ditemukan di Tong Sampah.');
      const expiresAt = new Date(product.deleted_at).getTime() + 30 * 86400000;
      if (Date.now() > expiresAt)
        throw new Error(
          'Masa pemulihan 30 hari sudah berakhir. Hapus produk secara permanen.',
        );
      await getD1()
        .prepare(
          'UPDATE products SET deleted_at=NULL,active=0,updated_at=? WHERE id=? AND store_id=?',
        )
        .bind(new Date().toISOString(), id, storeId)
        .run();
      await audit(admin, {
        storeId,
        action: 'product.restore',
        target: { type: 'product', id },
      });
      return NextResponse.json({ ok: true, restored: true });
    }
    if (!id || (active !== 0 && active !== 1))
      throw new Error('Permintaan arsip tidak valid.');
    const result = await getD1()
      .prepare('UPDATE products SET active=?,updated_at=? WHERE id=? AND store_id=?')
      .bind(active, new Date().toISOString(), id, storeId)
      .run();
    if (!result.meta.changes) throw new Error('Produk tidak ditemukan.');
    await audit(admin, {
      storeId,
      action: active ? 'product.unarchive' : 'product.archive',
      target: { type: 'product', id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal mengubah arsip.' },
      { status: 400 },
    );
  }
}
export async function DELETE(req: Request) {
  const auth = await authorizeStore('products.edit');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const storeId = admin.store.id;
  try {
    const { id, permanent } = (await req.json()) as {
      id?: string;
      permanent?: boolean;
    };
    if (!id) throw new Error('Produk tidak valid.');
    if (permanent && !adminCan(admin, 'products.delete')) return forbiddenForRole();
    const d1 = getD1();
    if (!permanent) {
      const result = await d1
        .prepare(
          'UPDATE products SET deleted_at=?,active=0,updated_at=? WHERE id=? AND store_id=? AND deleted_at IS NULL',
        )
        .bind(new Date().toISOString(), new Date().toISOString(), id, storeId)
        .run();
      if (!(result.meta.changes ?? 0))
        throw new Error(
          'Produk tidak ditemukan atau sudah berada di Tong Sampah.',
        );
      await audit(admin, {
        storeId,
        action: 'product.trash',
        target: { type: 'product', id },
      });
      return NextResponse.json({ ok: true, trashed: true });
    }
    const product = await d1
      .prepare(
        'SELECT image_key,images_json FROM products WHERE id=? AND store_id=? AND deleted_at IS NOT NULL',
      )
      .bind(id, storeId)
      .first<{ image_key: string | null; images_json: string }>();
    if (!product)
      throw new Error(
        'Hanya produk di Tong Sampah yang dapat dihapus permanen.',
      );
    let keys: string[] = [];
    try {
      keys = JSON.parse(product.images_json || '[]');
    } catch {}
    if (product.image_key && !keys.includes(product.image_key))
      keys.push(product.image_key);
    await d1.batch([
      d1.prepare('DELETE FROM cart_items WHERE store_id=? AND product_id=?').bind(storeId, id),
      d1.prepare('DELETE FROM reviews WHERE store_id=? AND product_id=?').bind(storeId, id),
      d1.prepare('DELETE FROM products WHERE id=? AND store_id=?').bind(id, storeId),
    ]);
    const remaining = await d1
      .prepare('SELECT image_key,images_json FROM products WHERE store_id=?')
      .bind(storeId)
      .all<any>();
    const referenced = new Set<string>();
    for (const row of remaining.results) {
      if (row.image_key) referenced.add(row.image_key);
      try {
        for (const key of JSON.parse(row.images_json || '[]'))
          referenced.add(key);
      } catch {}
    }
    for (const key of keys)
      if (!referenced.has(key)) await getFiles().delete(key);
    await audit(admin, {
      storeId,
      action: 'product.delete',
      target: { type: 'product', id },
    });
    return NextResponse.json({ ok: true, permanent: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Penghapusan gagal.' },
      { status: 400 },
    );
  }
}
