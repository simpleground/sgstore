import { NextResponse } from 'next/server';
import { getStoreAdmin } from '@/lib/admin-auth';
import { getD1 } from '@/db';
export async function GET() {
  const admin = await getStoreAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const storeId = admin.store.id;
  const d = getD1();
  const [reviews, products, buyers] = await Promise.all([
    d
      .prepare(
        'SELECT r.*,p.name product_name FROM reviews r LEFT JOIN products p ON p.store_id=r.store_id AND p.id=r.product_id WHERE r.store_id=? ORDER BY r.created_at DESC',
      )
      .bind(storeId)
      .all(),
    d
      .prepare(
        'SELECT id,name FROM products WHERE store_id=? AND deleted_at IS NULL ORDER BY name',
      )
      .bind(storeId)
      .all(),
    d
      .prepare(
        'SELECT order_number,customer_name FROM orders WHERE store_id=? ORDER BY created_at DESC LIMIT 200',
      )
      .bind(storeId)
      .all(),
  ]);
  return NextResponse.json({
    reviews: reviews.results,
    products: products.results,
    buyers: buyers.results,
  });
}
export async function POST(req: Request) {
  const admin = await getStoreAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const b = (await req.json()) as any;
  if (
    !b.productId ||
    !b.orderNumber ||
    !b.displayName ||
    !b.city?.trim() ||
    b.rating < 1 ||
    b.rating > 5 ||
    !b.body?.trim()
  )
    return NextResponse.json(
      { error: 'Lengkapi data ulasan.' },
      { status: 400 },
    );
  const product = await getD1()
    .prepare(
      'SELECT id FROM products WHERE id=? AND store_id=? AND deleted_at IS NULL',
    )
    .bind(b.productId, admin.store.id)
    .first();
  if (!product)
    return NextResponse.json(
      { error: 'Produk tidak ditemukan.' },
      { status: 404 },
    );
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      'INSERT INTO reviews (id,store_id,product_id,order_number,display_name,city,rating,body,active,admin_created,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,1,?,?)',
    )
    .bind(
      crypto.randomUUID(),
      admin.store.id,
      b.productId,
      b.orderNumber,
      b.displayName.trim(),
      b.city.trim(),
      b.rating,
      b.body.trim(),
      now,
      now,
    )
    .run();
  return NextResponse.json({ ok: true });
}
export async function PATCH(req: Request) {
  const admin = await getStoreAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const b = (await req.json()) as any;
  if (
    !b.id ||
    !b.city?.trim() ||
    b.rating < 1 ||
    b.rating > 5 ||
    !b.body?.trim()
  )
    return NextResponse.json({ error: 'Ulasan tidak valid.' }, { status: 400 });
  const result = await getD1()
    .prepare(
      'UPDATE reviews SET display_name=?,city=?,rating=?,body=?,active=?,updated_at=? WHERE id=? AND store_id=?',
    )
    .bind(
      b.displayName.trim(),
      String(b.city || '').trim(),
      b.rating,
      b.body.trim(),
      b.active ? 1 : 0,
      new Date().toISOString(),
      b.id,
      admin.store.id,
    )
    .run();
  if (!result.meta.changes)
    return NextResponse.json(
      { error: 'Ulasan tidak ditemukan.' },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
