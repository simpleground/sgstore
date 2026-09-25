import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { platformErrorResponse } from '@/lib/platform';
import {
  listPlatformOrders,
  readOrderFilter,
  updatePlatformOrderStatus,
} from '@/lib/platform-orders';

/** Orders of every store (or one store via ?store=<id>), newest first. */
export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const result = await listPlatformOrders(
      readOrderFilter(params),
      Number(params.get('page') || 1),
    );
    return NextResponse.json(result, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return platformErrorResponse(error);
  }
}

/** Change the status of an order of any store. */
export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const change = await updatePlatformOrderStatus(body);
    await audit(auth.admin, {
      storeId: change.storeId,
      action: 'order.status',
      target: { type: 'order', id: change.orderNumber },
      meta: { from: change.previous, to: change.status, via: 'platform' },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
