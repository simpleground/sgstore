import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/admin-auth';
import { googleClientId } from '@/lib/site';
import { AdminLogin } from './login-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Masuk Admin | Simple Ground',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next?.startsWith('/') && !next.startsWith('//') ? next : '/admin';
  if (await getAdmin()) redirect(target);
  return (
    <main className="min-h-screen bg-[#f7f4ec] px-5 py-10">
      <AdminLogin next={target} googleClientId={googleClientId()} />
    </main>
  );
}
