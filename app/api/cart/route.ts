import { NextResponse } from 'next/server';
import { getCustomer } from '@/app/customer-auth';
import { getD1 } from '@/db';
export async function GET() {
  const u = await getCustomer();
  if (!u) return NextResponse.json({ items: [] }, { status: 401 });
  const r = await getD1()
    .prepare(
      'SELECT product_id,variant_index,quantity FROM cart_items WHERE user_id=?',
    )
    .bind(u.userId)
    .all();
  return NextResponse.json({ items: r.results });
}
export async function PUT(req: Request) {
  const u = await getCustomer();
  if (!u) return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 });
  const { productId, variantIndex, quantity } = (await req.json()) as any;
  if (
    !productId ||
    !Number.isInteger(variantIndex) ||
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > 99
  )
    return NextResponse.json(
      { error: 'Keranjang tidak valid.' },
      { status: 400 },
    );
  const d = getD1();
  if (quantity > 0) {
    const product = await d
      .prepare('SELECT variants_json FROM products WHERE id=? AND active=1')
      .bind(productId)
      .first<{ variants_json: string }>();
    let variants: Array<{ stock?: number }> = [];
    try { variants = JSON.parse(product?.variants_json || '[]'); } catch {}
    const variant = variants[variantIndex];
    if (!product || !variant || !Number.isInteger(variant.stock) || quantity > variant.stock!)
      return NextResponse.json(
        { error: 'Produk, varian, atau jumlah stok tidak tersedia.' },
        { status: 409 },
      );
  }
  if (quantity === 0)
    await d
      .prepare(
        'DELETE FROM cart_items WHERE user_id=? AND product_id=? AND variant_index=?',
      )
      .bind(u.userId, productId, variantIndex)
      .run();
  else
    await d
      .prepare(
        'INSERT INTO cart_items (user_id,product_id,variant_index,quantity,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,product_id,variant_index) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at',
      )
      .bind(
        u.userId,
        productId,
        variantIndex,
        quantity,
        new Date().toISOString(),
      )
      .run();
  return NextResponse.json({ ok: true });
}
