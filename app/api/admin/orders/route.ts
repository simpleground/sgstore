import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';

async function authorized() {
  const user = await getChatGPTUser();
  if (!user) return false;
  const row = await getD1()
    .prepare('SELECT user_id FROM admin_users WHERE user_id = ?')
    .bind(user.userId)
    .first();
  return Boolean(row);
}
export async function PATCH(request: Request) {
  if (!(await authorized()))
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
  await getD1()
    .prepare(
      'UPDATE orders SET status = ?, updated_at = ? WHERE order_number = ?',
    )
    .bind(status, new Date().toISOString(), orderNumber)
    .run();
  return NextResponse.json({ ok: true });
}
