import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { normalizeCategory, normalizeSubcategory, productIdentity } from '@/lib/catalog-normalize';

async function auth() {
  const user = await getChatGPTUser();
  return (
    user &&
    Boolean(
      await getD1()
        .prepare('SELECT user_id FROM admin_users WHERE user_id=?')
        .bind(user.userId)
        .first(),
    )
  );
}

const columns = [
  'product_id', 'active', 'name', 'category', 'subcategory', 'description',
  'sku', 'color', 'size', 'normal_price', 'discount_percent', 'stock',
  'image_url',
];
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function GET() {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const result = await getD1()
    .prepare(
      'SELECT id,name,category,subcategory,description,variants_json,image_url,active FROM products ORDER BY name,id',
    )
    .all();
  const rows: Record<string, unknown>[] = [];
  for (const product of result.results as any[]) {
    let variants: any[] = [];
    try { variants = JSON.parse(product.variants_json || '[]'); } catch {}
    for (const variant of variants) {
      const normalPrice = Number(variant.normalPrice ?? variant.price);
      const price = Number(variant.price);
      const discount = normalPrice > 0
        ? Math.round((1 - price / normalPrice) * 10000) / 100
        : 0;
      rows.push({
        product_id: product.id,
        active: product.active ? 1 : 0,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        description: product.description,
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
  const csv = '\uFEFF' + [
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
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  try {
    const { rows } = (await request.json()) as { rows: any[] };
    if (!Array.isArray(rows) || !rows.length)
      throw new Error('File belum berisi data produk.');
    const groups = new Map<string, any>();
    let skuAdjusted = 0;
    for (const row of rows) {
      row.name = String(row.name || '').trim();
      row.category = normalizeCategory(String(row.category || ''));
      row.subcategory = normalizeSubcategory(String(row.subcategory || ''));
      row.description = String(row.description || '').trim();
      const normalPrice = Number(row.normal_price);
      const discountPercent = Number(row.discount_percent || 0);
      const price = Math.round(normalPrice * (1 - discountPercent / 100));
      const stock = Number(row.stock);
      if (
        !row.name || !row.category || !row.subcategory || !row.color ||
        !row.size || normalPrice <= 0 || discountPercent < 0 ||
        discountPercent >= 100 || price <= 0 || !Number.isInteger(stock) || stock < 0
      )
        throw new Error(`Data produk "${row.name || '(tanpa nama)'}" belum lengkap.`);
      const productId = String(row.product_id || '').trim();
      const key = productId
        ? `id:${productId}`
        : `new:${productIdentity(row.name)}|${row.category.toLowerCase()}|${row.subcategory.toLowerCase()}`;
      const group = groups.get(key) ?? { ...row, productId, variants: [] };
      if (
        productIdentity(group.name) !== productIdentity(row.name) || group.category !== row.category ||
        group.subcategory !== row.subcategory
      )
        throw new Error(`Baris dengan product_id ${productId} memiliki identitas produk berbeda.`);
      const originalSku = String(row.sku || '').trim();
      const usedSkus = new Set(group.variants.map((variant: any) => String(variant.sku || '').toLowerCase()).filter(Boolean));
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
    const existingRows = await database.prepare('SELECT id FROM products').all();
    const existingIds = new Set(
      (existingRows.results as Array<{ id: string }>).map((row) => row.id),
    );
    const statements = [];
    let created = 0;
    let updated = 0;
    for (const group of groups.values()) {
      const price = Math.min(...group.variants.map((variant: any) => variant.price));
      const stock = group.variants.reduce((sum: number, variant: any) => sum + variant.stock, 0);
      const active = String(group.active ?? '1').toLowerCase();
      const activeValue = ['0', 'false', 'arsip', 'archived'].includes(active) ? 0 : 1;
      if (group.productId) {
        if (!existingIds.has(group.productId))
          throw new Error(`Produk ID ${group.productId} tidak ditemukan.`);
        statements.push(
          database
            .prepare('UPDATE products SET name=?,category=?,subcategory=?,description=?,tone=?,price=?,stock=?,variants_json=?,active=?,updated_at=? WHERE id=?')
            .bind(group.name, group.category, group.subcategory,
              group.description || group.name, group.variants[0].color, price,
              stock, JSON.stringify(group.variants), activeValue, now,
              group.productId),
        );
        updated++;
      } else {
        statements.push(
          database
            .prepare('INSERT INTO products (id,name,category,subcategory,tone,price,stock,description,variants_json,image_url,images_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(crypto.randomUUID(), group.name, group.category,
              group.subcategory, group.variants[0].color, price, stock,
              group.description || group.name, JSON.stringify(group.variants),
              group.image_url || null, '[]', activeValue, now, now),
        );
        created++;
      }
    }
    for (let index = 0; index < statements.length; index += 75)
      await database.batch(statements.slice(index, index + 75));
    return NextResponse.json({ ok: true, count: groups.size, created, updated, groupedRows: rows.length - groups.size, skuAdjusted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Impor gagal.' },
      { status: 400 },
    );
  }
}
