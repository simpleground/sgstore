import { redirect } from 'next/navigation';

/**
 * The platform console now lives in the admin dashboard (Admin → Platform:
 * Website, Peran & izin; orders and reports of every website are in Pesanan
 * and Laporan). Old links keep working.
 */
export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const section =
    tab === 'pesanan' ? 'orders' : tab === 'laporan' ? 'reports' : 'stores';
  redirect(`/admin?section=${section}`);
}
