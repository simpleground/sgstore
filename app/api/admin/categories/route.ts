import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import {
  normalizeCategory,
  normalizeSubcategory,
} from '@/lib/catalog-normalize';

async function authorized() {
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

export async function PATCH(request: Request) {
  if (!(await authorized()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
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
            'UPDATE products SET category=?,updated_at=? WHERE category=?',
          )
          .bind(to, now, from)
          .run()
      : category
        ? await database
            .prepare(
              'UPDATE products SET subcategory=?,updated_at=? WHERE category=? AND subcategory=?',
            )
            .bind(to, now, category, from)
            .run()
        : null;
  if (!result)
    return NextResponse.json(
      { error: 'Kategori utama untuk subkategori belum dipilih.' },
      { status: 400 },
    );
  return NextResponse.json({ ok: true, changed: result.meta.changes ?? 0 });
}

export async function POST() {
  if (!(await authorized()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const database = getD1();
  const rows = await database
    .prepare('SELECT id,category,subcategory FROM products')
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
          'UPDATE products SET category=?,subcategory=?,updated_at=? WHERE id=?',
        )
        .bind(category, subcategory, now, row.id),
    );
    changed++;
  }
  for (let index = 0; index < statements.length; index += 75)
    await database.batch(statements.slice(index, index + 75));
  return NextResponse.json({ ok: true, changed });
}
