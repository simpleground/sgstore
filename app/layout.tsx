import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import type { CSSProperties } from 'react';
import { getStoreAppearance, imageUrl } from '@/lib/store-appearance';
import { getPublicStoreConfig } from '@/lib/store-settings';
import { getCurrentStore, storeBaseUrl } from '@/lib/tenant';
import { StoreConfigProvider } from './store-config';

// Fonts are self-hosted (from npm) so builds never depend on Google Fonts.
const sans = localFont({
  variable: '--font-sans-custom',
  src: [
    {
      path: '../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-italic.woff2',
      style: 'italic',
    },
  ],
  weight: '100 1000',
  display: 'swap',
});
const serif = localFont({
  variable: '--font-serif-custom',
  src: [
    {
      path: '../node_modules/@fontsource-variable/lora/files/lora-latin-wght-normal.woff2',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource-variable/lora/files/lora-latin-wght-italic.woff2',
      style: 'italic',
    },
  ],
  weight: '400 700',
  display: 'swap',
});
// Extra font presets for stores (Admin → Tampilan). Not preloaded: a browser
// only downloads a font when the store's preset actually uses it.
const playfair = localFont({
  variable: '--font-playfair',
  src: '../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2',
  weight: '400 900',
  display: 'swap',
  preload: false,
});
const fraunces = localFont({
  variable: '--font-fraunces',
  src: '../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
});
const nunito = localFont({
  variable: '--font-nunito',
  src: '../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2',
  weight: '200 1000',
  display: 'swap',
  preload: false,
});
const space_grotesk = localFont({
  variable: '--font-space-grotesk',
  src: '../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
  weight: '300 700',
  display: 'swap',
  preload: false,
});
// Title, description, icon and share image come from the store's appearance
// settings (Admin → Tampilan); Simple Ground's original values are its defaults.
export async function generateMetadata(): Promise<Metadata> {
  const store = await getCurrentStore();
  if (!store)
    return { title: 'Toko tidak ditemukan', robots: { index: false } };
  const { seo, images } = await getStoreAppearance(store);
  const shareImage = imageUrl(images.share) || imageUrl(images.logo);
  const favicon = imageUrl(images.favicon);
  const title = seo.title || store.name;
  const shareDescription = seo.shareDescription || seo.description;
  return {
    metadataBase: new URL(await storeBaseUrl(store)),
    ...(favicon ? { icons: { icon: favicon } } : {}),
    title,
    description: seo.description,
    // Suspended or closed stores should not be indexed while their shop is hidden.
    ...(store.status === 'active'
      ? {}
      : { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description: shareDescription,
      ...(shareImage ? { images: [shareImage] } : {}),
    },
    twitter: {
      card: shareImage ? 'summary_large_image' : 'summary',
      title,
      description: shareDescription,
      ...(shareImage ? { images: [shareImage] } : {}),
    },
  };
}
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Each request can be a different store (chosen from the host).
  const store = await getCurrentStore();
  const config = store ? await getPublicStoreConfig(store) : null;
  const theme = config?.appearance.theme;
  // Store colours are validated hex values; the CSS derives all shades from them.
  const colors = {
    ...(theme?.primaryColor ? { '--brand-primary': theme.primaryColor } : {}),
    ...(theme?.accentColor ? { '--brand-accent-base': theme.accentColor } : {}),
  } as CSSProperties;
  return (
    <html
      lang="id"
      data-brand-primary={theme?.primaryColor ? '' : undefined}
      data-brand-accent={theme?.accentColor ? '' : undefined}
      style={colors}
    >
      <body
        className={`${sans.variable} ${serif.variable} ${playfair.variable} ${fraunces.variable} ${nunito.variable} ${space_grotesk.variable} antialiased`}
        data-font={theme?.font === 'modern' ? 'modern' : undefined}
      >
        <StoreConfigProvider config={config}>{children}</StoreConfigProvider>
      </body>
    </html>
  );
}
