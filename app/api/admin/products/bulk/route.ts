import { NextResponse } from 'next/server';
import { authorizeStore } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { getD1 } from '@/db';
import {
  normalizeCategory,
  normalizeSubcategory,
  productIdentity,
  productNameSimilarity,
} from '@/lib/catalog-normalize';

const columns = [
  'product_id',
  'active',
  'name',
  'category',
  'subcategory',
  'description',
  'material',
  'care_instructions',
  'production_estimate',
  'size_guide',
  'weight_grams',
  'sold_count',
  'sku',
  'color',
  'size',
  'normal_price',
  'discount_percent',
  'stock',
  'image_url',
];
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

type ImportVariant = {
  sku?: string;
  color: string;
  size: string;
  normalPrice: number;
  price: number;
  stock: number;
};
const optionKey = (variant: ImportVariant) =>
  `${variant.color.trim().toLowerCase()}|${variant.size.trim().toLowerCase()}`;

function mergeVariants(existing: ImportVariant[], incoming: ImportVariant[]) {
  const merged = existing.map((variant) => ({ ...variant }));
  let skuAdjusted = 0;
  for (const row of incoming) {
    const sku = String(row.sku || '')
      .trim()
      .toLowerCase();
    const same = merged.findIndex(
      (variant) =>
        (sku &&
          String(variant.sku || '')
            .trim()
            .toLowerCase() === sku) ||
        optionKey(variant) === optionKey(row),
    );
    if (same >= 0) {
      merged[same] = { ...merged[same], ...row };
      continue;
    }
    const used = new Set(
      merged
        .map((variant) =>
          String(variant.sku || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    let next = String(row.sku || '').trim();
    if (next && used.has(next.toLowerCase())) {
      let suffix = 2;
      while (used.has(`${next}-${suffix}`.toLowerCase())) suffix++;
      next = `${next}-${suffix}`;
      skuAdjusted++;
    }
    merged.push({ ...row, sku: next });
  }
  return { variants: merged, skuAdjusted };
}

export async function GET(request: Request) {
  const auth = await authorizeStore('products.import');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const result = await getD1()
    .prepare(
      'SELECT * FROM products WHERE store_id=? AND deleted_at IS NULL ORDER BY name,id',
    )
    .bind(admin.store.id)
    .all();
  const rows: Record<string, unknown>[] = [];
  const ids = new URL(request.url).searchParams.getAll('id');
  const selected = new Set(ids);
  for (const product of result.results as any[]) {
    if (selected.size && !selected.has(product.id)) continue;
    let variants: any[] = [];
    try {
      variants = JSON.parse(product.variants_json || '[]');
    } catch {}
    for (const variant of variants) {
      const normalPrice = Number(variant.normalPrice ?? variant.price);
      const price = Number(variant.price);
      const discount =
        normalPrice > 0
          ? Math.round((1 - price / normalPrice) * 10000) / 100
          : 0;
      rows.push({
        product_id: product.id,
        active: product.active ? 1 : 0,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        description: product.description,
        material: product.material,
        care_instructions: product.care_instructions,
        production_estimate: product.production_estimate,
        size_guide: product.size_guide,
        weight_grams: product.weight_grams,
        sold_count: product.sold_count,
        sku: variant.sku ?? '',
        color: variant.color,
        size: variant.size,
        normal_price: normalPrice,
        discount_percent: Math.max(0, discount),
        stock: variant.stock,
        image_url: product.image_url ?? '',
      });
    }
  }
  const csv =
    '\uFEFF' +
    [
      columns.join(';'),
      ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(';')),
    ].join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="produk-simple-ground-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const auth = await authorizeStore('products.import');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const storeId = admin.store.id;
  try {
    const { rows, preview = false } = (await request.json()) as {
      rows: any[];
      preview?: boolean;
    };
    if (!Array.isArray(rows) || !rows.length)
      throw new Error('File belum berisi data produk.');
    const groups = new Map<string, any>();
    let skuAdjusted = 0;
    let normalizedFields = 0;
    let highStockVariants = 0;
    for (const row of rows) {
      row.name = String(row.name || '').trim();
      const originalCategory = String(row.category || '').trim();
      const originalSubcategory = String(row.subcategory || '').trim();
      row.category = normalizeCategory(originalCategory);
      row.subcategory = normalizeSubcategory(originalSubcategory);
      if (row.category !== originalCategory) normalizedFields++;
      if (row.subcategory !== originalSubcategory) normalizedFields++;
      row.description = String(row.description || '').trim();
      if (row.image_url) {
        const image = new URL(String(row.image_url));
        if (!['http:', 'https:'].includes(image.protocol)) throw new Error(`${row.name}: URL foto harus HTTP atau HTTPS.`);
      }
      for (const field of ['material', 'care_instructions', 'production_estimate', 'size_guide']) {
        if (row[field] !== undefined) row[field] = String(row[field]).trim();
      }
      for (const field of ['weight_grams', 'sold_count']) {
        if (row[field] === undefined) continue;
        const value = Number(row[field]);
        if (String(row[field]).trim() === '' || !Number.isSafeInteger(value) || value < (field === 'weight_grams' ? 1 : 0))
          throw new Error(`${row.name}: ${field} harus bilangan bulat ${field === 'weight_grams' ? 'lebih dari 0' : '0 atau lebih'}.`);
        row[field] = value;
      }
      const normalPrice = Number(row.normal_price);
      const discountPercent = Number(row.discount_percent || 0);
      const price = Math.round(normalPrice * (1 - discountPercent / 100));
      const stock = Number(row.stock);
      if (stock >= 9999) highStockVariants++;
      if (
        !row.name ||
        !row.category ||
        !row.subcategory ||
        !row.color ||
        !row.size ||
        !Number.isFinite(normalPrice) ||
        !Number.isFinite(discountPercent) ||
        normalPrice <= 0 ||
        discountPercent < 0 ||
        discountPercent >= 100 ||
        price <= 0 ||
        !Number.isInteger(stock) ||
        stock < 0
      )
        throw new Error(
          `Data produk "${row.name || '(tanpa nama)'}" belum lengkap.`,
        );
      const productId = String(row.product_id || '').trim();
      const key = productId
        ? `id:${productId}`
        : `new:${productIdentity(row.name)}|${row.category.toLowerCase()}|${row.subcategory.toLowerCase()}`;
      const group = groups.get(key) ?? { ...row, productId, variants: [] };
      for (const field of ['description', 'material', 'care_instructions', 'production_estimate', 'size_guide', 'weight_grams', 'sold_count', 'active', 'image_url']) {
        if (String(group[field] ?? '') !== String(row[field] ?? ''))
          throw new Error(`${row.name}: kolom ${field} harus sama pada semua baris varian produk ini.`);
      }
      if (
        productIdentity(group.name) !== productIdentity(row.name) ||
        group.category !== row.category ||
        group.subcategory !== row.subcategory
      )
        throw new Error(
          `Baris dengan product_id ${productId} memiliki identitas produk berbeda.`,
        );
      const originalSku = String(row.sku || '').trim();
      const usedSkus = new Set(
        group.variants
          .map((variant: any) => String(variant.sku || '').toLowerCase())
          .filter(Boolean),
      );
      let sku = originalSku;
      if (sku && usedSkus.has(sku.toLowerCase())) {
        let suffix = 2;
        while (usedSkus.has(`${originalSku}-${suffix}`.toLowerCase())) suffix++;
        sku = `${originalSku}-${suffix}`;
        skuAdjusted++;
      }
      group.variants.push({
        sku,
        color: String(row.color).trim(),
        size: String(row.size).trim(),
        normalPrice,
        price,
        stock,
      });
      groups.set(key, group);
    }

    const database = getD1();
    const now = new Date().toISOString();
    const existingRows = await database
      .prepare(
        'SELECT id,name,category,subcategory,variants_json,active FROM products WHERE store_id=? AND deleted_at IS NULL',
      )
      .bind(storeId)
      .all();
    const existingIds = new Set(
      (existingRows.results as Array<{ id: string }>).map((row) => row.id),
    );
    const activeCatalog = (existingRows.results as any[])
      .filter((row) => Number(row.active) === 1)
      .map((row) => ({
        ...row,
        category: normalizeCategory(String(row.category || '')),
        subcategory: normalizeSubcategory(String(row.subcategory || '')),
      }));
    let autoMatched = 0;
    const autoMatchedNames: string[] = [];
    for (const group of groups.values()) {
      if (group.productId) continue;
      const candidates = activeCatalog
        .filter(
          (product) =>
            product.category === group.category &&
            product.subcategory === group.subcategory,
        )
        .map((product) => ({
          product,
          exact: productIdentity(product.name) === productIdentity(group.name),
          score: productNameSimilarity(product.name, group.name),
        }))
        .sort(
          (left, right) =>
            Number(right.exact) - Number(left.exact) ||
            right.score - left.score,
        );
      const best = candidates[0];
      const runnerUp = candidates[1];
      const exactMatches = candidates.filter((candidate) => candidate.exact);
      const confident =
        best &&
        (exactMatches.length === 1 ||
          (exactMatches.length === 0 &&
            best.score >= 0.94 &&
            best.score - (runnerUp?.score || 0) >= 0.08));
      if (!confident) continue;
      group.productId = best.product.id;
      group.autoMatched = true;
      try {
        group.existingVariants = JSON.parse(best.product.variants_json || '[]');
      } catch {
        group.existingVariants = [];
      }
      autoMatched++;
      autoMatchedNames.push(`“${group.name}” → “${best.product.name}”`);
    }
    const statements = [];
    let created = 0;
    let updated = 0;
    let newProductsWithoutImage = 0;
    for (const group of groups.values()) {
      if (group.autoMatched) {
        const combined = mergeVariants(
          group.existingVariants || [],
          group.variants,
        );
        group.variants = combined.variants;
        skuAdjusted += combined.skuAdjusted;
      }
      const price = Math.min(
        ...group.variants.map((variant: any) => variant.price),
      );
      const stock = group.variants.reduce(
        (sum: number, variant: any) => sum + variant.stock,
        0,
      );
      const active = String(group.active ?? '1').toLowerCase();
      const activeValue = ['0', 'false', 'arsip', 'archived'].includes(active)
        ? 0
        : 1;
      if (group.productId) {
        if (!existingIds.has(group.productId))
          throw new Error(`Produk ID ${group.productId} tidak ditemukan.`);
        if (String(group.image_url || '').trim()) {
          statements.push(database.prepare('UPDATE products SET image_url=?,image_key=NULL,images_json=? WHERE id=? AND store_id=? AND COALESCE(image_url,\'\')!=?').bind(String(group.image_url).trim(), '[]', group.productId, storeId, String(group.image_url).trim()));
        }
        statements.push(
          database
            .prepare(
              'UPDATE products SET material=COALESCE(?,material),care_instructions=COALESCE(?,care_instructions),production_estimate=COALESCE(?,production_estimate),size_guide=COALESCE(?,size_guide),weight_grams=COALESCE(?,weight_grams),sold_count=COALESCE(?,sold_count),name=?,category=?,subcategory=?,description=?,tone=?,price=?,stock=?,variants_json=?,active=?,updated_at=? WHERE id=? AND store_id=?',
            )
            .bind(
              group.material ?? null,
              group.care_instructions ?? null,
              group.production_estimate ?? null,
              group.size_guide ?? null,
              group.weight_grams ?? null,
              group.sold_count ?? null,
              group.name,
              group.category,
              group.subcategory,
              group.description || group.name,
              group.variants[0].color,
              price,
              stock,
              JSON.stringify(group.variants),
              activeValue,
              now,
              group.productId,
              storeId,
            ),
        );
        updated++;
      } else {
        if (!String(group.image_url || '').trim()) newProductsWithoutImage++;
        statements.push(
          database
            .prepare(
              'INSERT INTO products (store_id,material,care_instructions,production_estimate,size_guide,weight_grams,sold_count,id,name,category,subcategory,tone,price,stock,description,variants_json,image_url,images_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            )
            .bind(
              storeId,
              group.material ?? '',
              group.care_instructions ?? '',
              group.production_estimate ?? '',
              group.size_guide ?? '',
              group.weight_grams ?? 500,
              group.sold_count ?? 0,
              crypto.randomUUID(),
              group.name,
              group.category,
              group.subcategory,
              group.variants[0].color,
              price,
              stock,
              group.description || group.name,
              JSON.stringify(group.variants),
              group.image_url || null,
              '[]',
              activeValue,
              now,
              now,
            ),
        );
        created++;
      }
    }
    const warnings = [
      highStockVariants
        ? `${highStockVariants} variasi memiliki stok 9.999 atau lebih.`
        : '',
      newProductsWithoutImage
        ? `${newProductsWithoutImage} produk baru belum memiliki URL foto.`
        : '',
      skuAdjusted ? `${skuAdjusted} SKU ganda akan dibuat unik otomatis.` : '',
      autoMatched
        ? `${autoMatched} produk dikenali otomatis sebagai barang yang sudah ada.`
        : '',
    ].filter(Boolean);
    const summary = {
      ok: true,
      preview,
      rows: rows.length,
      count: groups.size,
      created,
      updated,
      groupedRows: rows.length - groups.size,
      skuAdjusted,
      normalizedFields,
      highStockVariants,
      newProductsWithoutImage,
      autoMatched,
      autoMatchedNames: autoMatchedNames.slice(0, 12),
      warnings,
    };
    if (preview) return NextResponse.json(summary);
    for (let index = 0; index < statements.length; index += 75)
      await database.batch(statements.slice(index, index + 75));
    await audit(admin, {
      storeId,
      action: 'product.import',
      meta: { rows: rows.length, created, updated, autoMatched },
    });
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impor gagal.' },
      { status: 400 },
    );
  }
}
