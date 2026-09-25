import { NextResponse } from 'next/server';
import { getStoreAdmin } from '@/lib/admin-auth';
import { getD1 } from '@/db';

export async function PATCH(request: Request) {
  const admin = await getStoreAdmin();
  if (!admin)
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const { orderNumber, status } = (await request.json()) as {
    orderNumber?: string;
    status?: string;
  };
  const allowed = [
    'menunggu_pembayaran',
    'dibayar',
    'diproses',
    'dikirim',
    'selesai',
    'dibatalkan',
  ];
  if (!orderNumber || !status || !allowed.includes(status))
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
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
  return NextResponse.json({ ok: true });
}
