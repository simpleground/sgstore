import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
async function auth() {
  const u = await getChatGPTUser();
  return (
    u &&
    Boolean(
      await getD1()
        .prepare('SELECT user_id FROM admin_users WHERE user_id=?')
        .bind(u.userId)
        .first(),
    )
  );
}
export async function GET() {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const d = getD1();
  const [reviews, products, buyers] = await Promise.all([
    d
      .prepare(
        'SELECT r.*,p.name product_name FROM reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC',
      )
      .all(),
    d.prepare('SELECT id,name FROM products WHERE deleted_at IS NULL ORDER BY name').all(),
    d
      .prepare(
        'SELECT order_number,customer_name FROM orders ORDER BY created_at DESC LIMIT 200',
      )
      .all(),
  ]);
  return NextResponse.json({
    reviews: reviews.results,
    products: products.results,
    buyers: buyers.results,
  });
}
export async function POST(req: Request) {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const b = (await req.json()) as any;
  if (
    !b.productId ||
    !b.orderNumber ||
    !b.displayName ||
    b.rating < 1 ||
    b.rating > 5 ||
    !b.body?.trim()
  )
    return NextResponse.json(
      { error: 'Lengkapi data ulasan.' },
      { status: 400 },
    );
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      'INSERT INTO reviews (id,product_id,order_number,display_name,rating,body,active,admin_created,created_at,updated_at) VALUES (?,?,?,?,?,?,1,1,?,?)',
    )
    .bind(
      crypto.randomUUID(),
      b.productId,
      b.orderNumber,
      b.displayName.trim(),
      b.rating,
      b.body.trim(),
      now,
      now,
    )
    .run();
  return NextResponse.json({ ok: true });
}
export async function PATCH(req: Request) {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const b = (await req.json()) as any;
  if (!b.id || b.rating < 1 || b.rating > 5 || !b.body?.trim())
    return NextResponse.json({ error: 'Ulasan tidak valid.' }, { status: 400 });
  await getD1()
    .prepare(
      'UPDATE reviews SET display_name=?,rating=?,body=?,active=?,updated_at=? WHERE id=?',
    )
    .bind(
      b.displayName.trim(),
      b.rating,
      b.body.trim(),
      b.active ? 1 : 0,
      new Date().toISOString(),
      b.id,
    )
    .run();
  return NextResponse.json({ ok: true });
}
