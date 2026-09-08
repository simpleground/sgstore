import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { paymentTokenHash } from '@/lib/payment-access';
export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const orderNumber = new URL(request.url).searchParams.get('order');
  if (!orderNumber || token.length !== 72) return NextResponse.json({error:'Akses pembayaran tidak valid.'},{status:401});
  const order = await getD1().prepare('SELECT status,total,payment_method FROM orders WHERE order_number=? AND payment_token_hash=?').bind(orderNumber,await paymentTokenHash(token)).first<{status:string;total:number;payment_method:string}>();
  if (!order) return NextResponse.json({error:'Pesanan tidak ditemukan.'},{status:404});
  return NextResponse.json({...order,paid:['dibayar','diproses','dikirim','selesai'].includes(order.status)},{headers:{'cache-control':'no-store'}});
}
