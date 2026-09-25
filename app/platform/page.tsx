import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/admin-auth';
import { PlatformConsole } from './platform-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Platform',
  robots: { index: false, follow: false },
};

/** Platform console: create and manage stores (platform super_admin only). */
export default async function PlatformPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login?next=/platform');
  if (admin.platformRole !== 'super_admin')
    return (
      <main className="admin-workspace grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl">Khusus admin platform</h1>
          <p className="mt-2 text-sm text-slate-500">
            Akun {admin.email} tidak memiliki akses ke panel platform.
          </p>
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm font-semibold text-blue-600"
          >
            Kembali ke admin toko
          </Link>
        </div>
      </main>
    );
  return (
    <main className="admin-workspace min-h-screen">
      <PlatformConsole adminName={admin.displayName} />
    </main>
  );
}
