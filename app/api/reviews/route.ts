import { NextResponse } from 'next/server';
import { getCustomer } from '@/app/customer-auth';
import { getD1 } from '@/db';

export async function GET() {
  const r = await getD1()
    .prepare(
      'SELECT id,product_id,display_name,rating,body,created_at FROM reviews WHERE active=1 ORDER BY created_at DESC',
    )
    .all();
  return NextResponse.json({ reviews: r.results });
}
export async function POST(req: Request) {
  const user = await getCustomer();
  if (!user)
    return NextResponse.json(
      { error: 'Silakan masuk terlebih dahulu.' },
      { status: 401 },
    );
  const { productId, rating, body } = (await req.json()) as {
    productId?: string;
    rating?: number;
    body?: string;
  };
  if (
    !productId ||
    !Number.isInteger(rating) ||
    rating! < 1 ||
    rating! > 5 ||
    !body?.trim() ||
    body.trim().length > 1000
  )
    return NextResponse.json(
      { error: 'Rating dan ulasan belum valid.' },
      { status: 400 },
    );
  const d1 = getD1(),
    now = new Date().toISOString();
  const old = await d1
    .prepare('SELECT id FROM reviews WHERE user_id=? AND product_id=?')
    .bind(user.userId, productId)
    .first<{ id: string }>();
  if (old)
    await d1
      .prepare(
        'UPDATE reviews SET display_name=?,rating=?,body=?,active=1,updated_at=? WHERE id=?',
      )
      .bind(user.name, rating, body.trim(), now, old.id)
      .run();
  else
    await d1
      .prepare(
        'INSERT INTO reviews (id,product_id,user_id,display_name,rating,body,active,admin_created,created_at,updated_at) VALUES (?,?,?,?,?,?,1,0,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        productId,
        user.userId,
        user.name,
        rating,
        body.trim(),
        now,
        now,
      )
      .run();
  return NextResponse.json({ ok: true });
}
