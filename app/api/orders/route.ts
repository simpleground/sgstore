import { NextResponse } from 'next/server';
import { getD1 } from '@/db';

type Item = { id: string; name: string; price: number; quantity: number };
const schemaSql = `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, shipping_address TEXT NOT NULL, items_json TEXT NOT NULL, subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL, payment_method TEXT NOT NULL DEFAULT 'Bank Mandiri', status TEXT NOT NULL DEFAULT 'menunggu_pembayaran', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { customerName?: string; customerPhone?: string; shippingAddress?: string; items?: Item[] };
    const name = body.customerName?.trim(); const phone = body.customerPhone?.trim(); const address = body.shippingAddress?.trim();
    const items = (body.items ?? []).filter((i) => Number.isInteger(i.quantity) && i.quantity > 0 && Number.isFinite(i.price));
    if (!name || name.length < 2 || !phone || phone.length < 8 || !address || address.length < 10 || !items.length) return NextResponse.json({ error: 'Lengkapi nama, WhatsApp, alamat, dan produk.' }, { status: 400 });
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0); const shipping = 18000; const total = subtotal + shipping;
    const now = new Date().toISOString(); const orderNumber = `SG-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const d1 = getD1(); await d1.prepare(schemaSql).run();
    await d1.prepare('CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at)').run();
    await d1.prepare('INSERT INTO orders (order_number, customer_name, customer_phone, shipping_address, items_json, subtotal, shipping, total, payment_method, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(orderNumber, name, phone, address, JSON.stringify(items), subtotal, shipping, total, 'Bank Mandiri', 'menunggu_pembayaran', now, now).run();
    return NextResponse.json({ orderNumber, total });
  } catch { return NextResponse.json({ error: 'Pesanan belum dapat disimpan. Coba lagi.' }, { status: 500 }); }
}
