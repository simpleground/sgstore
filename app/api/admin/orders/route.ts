import { NextResponse } from 'next/server';
import { authorizeStore } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { getD1 } from '@/db';
import { isOrderStatus } from '@/lib/order-status';
import { platformErrorResponse } from '@/lib/platform';
import { listPlatformOrders, readOrderFilter } from '@/lib/platform-orders';

/**
 * Orders of the current store with filters (status, search, dates), paged.
 * The store always comes from the host; a ?store= from the browser is ignored.
 */
export async function GET(request: Request) {
  const auth = await authorizeStore('orders.view');
  if (!auth.ok) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const filter = { ...readOrderFilter(params), storeId: auth.admin.store.id };
    return NextResponse.json(
      await listPlatformOrders(filter, Number(params.get('page') || 1)),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return platformErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeStore('orders.update');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const { orderNumber, status } = (await request.json()) as {
    orderNumber?: string;
    status?: string;
  };
  if (!orderNumber || !isOrderStatus(status))
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const previous = await getD1()
    .prepare(
      'SELECT status FROM orders WHERE order_number = ? AND store_id = ?',
    )
    .bind(orderNumber, admin.store.id)
    .first<string>('status');
  const result = await getD1()
    .prepare(
      'UPDATE orders SET status = ?, updated_at = ? WHERE order_number = ? AND store_id = ?',
    )
    .bind(status, new Date().toISOString(), orderNumber, admin.store.id)
    .run();
  if (!result.meta.changes)
    return NextResponse.json(
      { error: 'Pesanan tidak ditemukan.' },
      { status: 404 },
    );
  await audit(admin, {
    storeId: admin.store.id,
    action: 'order.status',
    target: { type: 'order', id: orderNumber },
    meta: { from: previous, to: status },
  });
  return NextResponse.json({ ok: true });
}
