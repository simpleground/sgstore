import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getStoreAdmin } from '@/lib/admin-auth';
import { googleClientId } from '@/lib/site';
import { getCurrentStore } from '@/lib/tenant';
import { AdminLogin } from './login-client';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const store = await getCurrentStore();
  return {
    title: `Masuk Admin | ${store?.name ?? ''}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next?.startsWith('/') && !next.startsWith('//') ? next : '/admin';
  if (await getStoreAdmin()) redirect(target);
  const store = await getCurrentStore();
  return (
    <main className="min-h-screen bg-[#f7f4ec] px-5 py-10">
      <AdminLogin next={target} googleClientId={googleClientId()} storeName={store?.name ?? ''} />
    </main>
  );
}
