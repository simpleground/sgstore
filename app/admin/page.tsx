import { getD1 } from '@/db';
import { requireAdmin } from '@/lib/admin-auth';
import { AdminDashboard } from './dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireAdmin('/admin');
  const result = await getD1()
    .prepare(
      'SELECT order_number, customer_name, customer_phone, shipping_address, items_json, total, status, created_at FROM orders WHERE store_id=? ORDER BY created_at DESC LIMIT 200',
    )
    .bind(user.store.id)
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
