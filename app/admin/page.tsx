import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { AdminSetup } from './admin-client';
import { AdminDashboard } from './dashboard';

export const dynamic = 'force-dynamic';
const adminSql = `CREATE TABLE IF NOT EXISTS admin_users (user_id TEXT PRIMARY KEY, email TEXT NOT NULL, created_at TEXT NOT NULL)`;
const ordersSql = `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, shipping_address TEXT NOT NULL, items_json TEXT NOT NULL, subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL, payment_method TEXT NOT NULL DEFAULT 'Bank Mandiri', status TEXT NOT NULL DEFAULT 'menunggu_pembayaran', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;
export default async function AdminPage() {
  const user = await requireChatGPTUser('/admin');
  const d1 = getD1();
  await d1.batch([d1.prepare(adminSql), d1.prepare(ordersSql)]);
  const owner = await d1
    .prepare('SELECT user_id FROM admin_users LIMIT 1')
    .first<{ user_id: string }>();
  if (!owner)
    return (
      <main className="min-h-screen bg-[#f7f4ec] px-5 py-10">
        <AdminSetup />
      </main>
    );
  if (owner.user_id !== user.userId)
    return (
      <main className="grid min-h-screen place-content-center bg-[#f7f4ec] p-8 text-center">
        <h1 className="font-serif text-3xl">Akses ditolak</h1>
        <p className="mt-3 text-[#68736b]">
          Akun ini bukan administrator Simple Ground.
        </p>
      </main>
    );
  const result = await d1
    .prepare(
      'SELECT order_number, customer_name, customer_phone, shipping_address, items_json, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 200',
    )
    .all();
  return (
    <main className="min-h-screen bg-[#f7f4ec]">
      <AdminDashboard
        initialOrders={result.results as never[]}
        adminName={user.displayName}
      />
    </main>
  );
}
