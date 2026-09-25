import { notFound } from 'next/navigation';
import { getCurrentStore } from '@/lib/tenant';

/**
 * Storefront pages (home, product, checkout). A host without a store gives
 * 404; a suspended or closed store shows a notice instead of the shop. The
 * admin panel (/admin) is outside this group and stays reachable.
 */
export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await getCurrentStore();
  if (!store) notFound();
  if (store.status === 'active') return children;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f4] px-5 text-center text-[var(--brand-ink)]">
      <div className="max-w-md">
        <p className="font-serif text-3xl font-bold">{store.name}</p>
        <h1 className="mt-6 text-xl font-semibold">
          {store.status === 'closed'
            ? 'Toko ini sudah tidak beroperasi.'
            : 'Toko sedang tidak aktif untuk sementara.'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#637067]">
          {store.status === 'closed'
            ? 'Terima kasih telah berbelanja. Pesanan baru tidak dapat dibuat.'
            : 'Silakan kembali lagi nanti. Pesanan yang sudah dibuat tetap diproses.'}
        </p>
      </div>
    </main>
  );
}
