import { NextResponse } from 'next/server';
import { getD1 } from '@/db';

async function sha512(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-512',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1)
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function POST(request: Request) {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey)
      return NextResponse.json(
        { error: 'Server belum dikonfigurasi.' },
        { status: 503 },
      );
    const body = (await request.json()) as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      signature_key?: string;
      transaction_status?: string;
      fraud_status?: string;
    };
    if (
      !body.order_id ||
      !body.status_code ||
      !body.gross_amount ||
      !body.signature_key
    )
      return NextResponse.json(
        { error: 'Notifikasi tidak lengkap.' },
        { status: 400 },
      );
    const expected = await sha512(
      `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`,
    );
    if (!safeEqual(expected, body.signature_key.toLowerCase()))
      return NextResponse.json(
        { error: 'Signature tidak valid.' },
        { status: 401 },
      );

    const d1 = getD1();
    const order = await d1
      .prepare('SELECT total FROM orders WHERE order_number=?')
      .bind(body.order_id)
      .first<{ total: number }>();
    if (!order)
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan.' },
        { status: 404 },
      );
    if (Math.round(Number(body.gross_amount)) !== order.total)
      return NextResponse.json(
        { error: 'Nominal pembayaran tidak cocok.' },
        { status: 400 },
      );

    const transactionStatus = body.transaction_status || '';
    let status = 'menunggu_pembayaran';
    if (
      transactionStatus === 'settlement' ||
      (transactionStatus === 'capture' && body.fraud_status === 'accept')
    )
      status = 'dibayar';
    else if (
      ['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus)
    )
      status = 'dibatalkan';
    await d1
      .prepare('UPDATE orders SET status=?, updated_at=? WHERE order_number=?')
      .bind(status, new Date().toISOString(), body.order_id)
      .run();
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: 'Notifikasi gagal diproses.' },
      { status: 500 },
    );
  }
}
