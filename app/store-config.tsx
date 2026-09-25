'use client';

/**
 * Pengaturan publik toko aktif (kontak, media sosial, pembayaran) untuk
 * komponen client. Diisi oleh app/layout.tsx dari getPublicStoreConfig().
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { PublicStoreConfig } from '@/lib/store-settings';

const EMPTY: PublicStoreConfig = {
  name: '',
  email: '',
  phone: '',
  address: '',
  whatsapp: '',
  socialLinks: [],
  checkoutNoticeTitle: '',
  checkoutNotice: '',
  payments: { manual: null, midtrans: false, recommended: null },
  appearance: {
    theme: { primaryColor: '', accentColor: '', font: 'classic' },
    content: {
      announcement: '',
      searchPlaceholder: 'Cari produk...',
      tagline: '',
      heroSlides: [],
      about: {
        enabled: false,
        eyebrow: '',
        title: '',
        body: '',
        imageAlt: '',
        highlights: [],
      },
      showReviews: true,
      newsletter: { enabled: false, eyebrow: '', title: '', body: '' },
    },
    logoUrl: '',
    aboutImageUrl: '',
  },
};

const StoreConfigContext = createContext<PublicStoreConfig>(EMPTY);

export function StoreConfigProvider({
  config,
  children,
}: {
  config: PublicStoreConfig | null;
  children: ReactNode;
}) {
  return (
    <StoreConfigContext.Provider value={config ?? EMPTY}>
      {children}
    </StoreConfigContext.Provider>
  );
}

export function useStoreConfig() {
  return useContext(StoreConfigContext);
}

/** wa.me link for the store's WhatsApp, or '' when the store has none. */
export function whatsappLink(config: PublicStoreConfig, text?: string) {
  if (!config.whatsapp) return '';
  return `https://wa.me/${config.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** 6281234567890 → 0812-3456-7890 */
export function formatWhatsapp(number: string) {
  const local = number.startsWith('62') ? `0${number.slice(2)}` : number;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}
