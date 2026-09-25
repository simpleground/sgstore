import { notFound } from 'next/navigation';
import { getStoreAppearance } from '@/lib/store-appearance';
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
  if (store.status === 'active') {
    const { theme, layout } = await getStoreAppearance(store);
    // Store-wide look (fonts, corners, page background); see app/globals.css.
    // Attributes are left out for the defaults so the original look is unchanged.
    return (
      <div
        className="contents"
        data-sf-font={
          theme.font === 'classic' || theme.font === 'modern'
            ? undefined
            : theme.font
        }
        data-corners={layout.corners === 'rounded' ? undefined : layout.corners}
        data-background={
          layout.background === 'neutral' ? undefined : layout.background
        }
      >
        {children}
      </div>
    );
  }
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
