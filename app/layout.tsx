import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { siteUrl } from '@/lib/site';
import { getPublicStoreConfig } from '@/lib/store-settings';
import { getCurrentStore } from '@/lib/tenant';
import { StoreConfigProvider } from './store-config';

// Fonts are self-hosted (from npm) so builds never depend on Google Fonts.
const sans = localFont({
  variable: '--font-sans-custom',
  src: [
    { path: '../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2', style: 'normal' },
    { path: '../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-italic.woff2', style: 'italic' },
  ],
  weight: '100 1000',
  display: 'swap',
});
const serif = localFont({
  variable: '--font-serif-custom',
  src: [
    { path: '../node_modules/@fontsource-variable/lora/files/lora-latin-wght-normal.woff2', style: 'normal' },
    { path: '../node_modules/@fontsource-variable/lora/files/lora-latin-wght-italic.woff2', style: 'italic' },
  ],
  weight: '400 700',
  display: 'swap',
});
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  icons: { icon: '/favicon.svg' },
  title: 'Simple Ground — Daily & Kitchen Wear',
  description:
    'Belanja baju chef, seragam kerja, dan daily wear Simple Ground. Pilih ukuran, cek ongkir, dan bayar dengan Virtual Account atau QRIS. Konsultasi tersedia via WhatsApp.',
  openGraph: {
    title: 'Simple Ground — Daily & Kitchen Wear',
    description:
      'Pakaian daily, linen, dan perlengkapan chef yang nyaman serta tahan lama.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Simple Ground — Daily & Kitchen Wear',
    description:
      'Pakaian daily, linen, dan perlengkapan chef yang nyaman serta tahan lama.',
    images: ['/og.png'],
  },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Each request can be a different store (chosen from the host).
  const store = await getCurrentStore();
  const config = store ? await getPublicStoreConfig(store) : null;
  return (
    <html lang="id">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        <StoreConfigProvider config={config}>{children}</StoreConfigProvider>
      </body>
    </html>
  );
}
