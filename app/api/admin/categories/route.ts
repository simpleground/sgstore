import { NextResponse } from 'next/server';
import { authorizeStore } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { getD1 } from '@/db';
import {
  normalizeCategory,
  normalizeSubcategory,
} from '@/lib/catalog-normalize';

export async function PATCH(request: Request) {
  const auth = await authorizeStore('categories.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const body = (await request.json()) as {
    type?: 'category' | 'subcategory';
    from?: string;
    to?: string;
    category?: string;
  };
  const from = body.from?.trim();
  const to = body.to?.trim();
  const category = body.category?.trim();
  if (!from || !to || to.length > 100 || from === to)
    return NextResponse.json(
      { error: 'Pilih nama lama dan masukkan nama baru yang berbeda.' },
      { status: 400 },
    );
  const database = getD1();
  const now = new Date().toISOString();
  const result =
    body.type === 'category'
      ? await database
          .prepare(
            'UPDATE products SET category=?,updated_at=? WHERE store_id=? AND category=?',
          )
          .bind(to, now, admin.store.id, from)
          .run()
      : category
        ? await database
            .prepare(
              'UPDATE products SET subcategory=?,updated_at=? WHERE store_id=? AND category=? AND subcategory=?',
            )
            .bind(to, now, admin.store.id, category, from)
            .run()
        : null;
  if (!result)
    return NextResponse.json(
      { error: 'Kategori utama untuk subkategori belum dipilih.' },
      { status: 400 },
    );
  await audit(admin, {
    storeId: admin.store.id,
    action: body.type === 'category' ? 'category.rename' : 'subcategory.rename',
    meta: { from, to, category, changed: result.meta.changes ?? 0 },
  });
  return NextResponse.json({ ok: true, changed: result.meta.changes ?? 0 });
}

export async function POST() {
  const auth = await authorizeStore('categories.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const database = getD1();
  const rows = await database
    .prepare('SELECT id,category,subcategory FROM products WHERE store_id=?')
    .bind(admin.store.id)
    .all<any>();
  const now = new Date().toISOString();
  const statements = [];
  let changed = 0;
  for (const row of rows.results) {
    const category = normalizeCategory(row.category || '');
    const subcategory = normalizeSubcategory(row.subcategory || '');
    if (category === row.category && subcategory === row.subcategory) continue;
    statements.push(
      database
        .prepare(
          'UPDATE products SET category=?,subcategory=?,updated_at=? WHERE id=? AND store_id=?',
        )
        .bind(category, subcategory, now, row.id, admin.store.id),
    );
    changed++;
  }
  for (let index = 0; index < statements.length; index += 75)
    await database.batch(statements.slice(index, index + 75));
  await audit(admin, {
    storeId: admin.store.id,
    action: 'category.normalize',
    meta: { changed },
  });
  return NextResponse.json({ ok: true, changed });
}
