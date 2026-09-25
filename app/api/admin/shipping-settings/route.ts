import { NextResponse } from 'next/server';
import { authorizeStore } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { getD1 } from '@/db';
import { SUPPORTED_COURIERS } from '@/lib/biteship';
import { getCourierSettings } from '@/lib/shipping-settings';

export async function GET() {
  const auth = await authorizeStore('shipping.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  return NextResponse.json({
    couriers: await getCourierSettings(admin.store.id),
  });
}

export async function PATCH(request: Request) {
  const auth = await authorizeStore('shipping.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const body = (await request.json()) as { code?: string; active?: boolean };
  const courier = SUPPORTED_COURIERS.find((item) => item.code === body.code);
  if (!courier || typeof body.active !== 'boolean')
    return NextResponse.json(
      { error: 'Ekspedisi tidak valid.' },
      { status: 400 },
    );
  await getD1()
    .prepare(
      'INSERT INTO shipping_settings (store_id,courier_code,courier_name,active,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(store_id,courier_code) DO UPDATE SET courier_name=excluded.courier_name,active=excluded.active,updated_at=excluded.updated_at',
    )
    .bind(
      admin.store.id,
      courier.code,
      courier.name,
      body.active ? 1 : 0,
      new Date().toISOString(),
    )
    .run();
  await audit(admin, {
    storeId: admin.store.id,
    action: 'shipping.courier',
    target: { type: 'courier', id: courier.code },
    meta: { active: body.active },
  });
  return NextResponse.json({ ok: true });
}
