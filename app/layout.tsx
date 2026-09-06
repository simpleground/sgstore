import type { Metadata } from 'next';
import { DM_Sans, Lora } from 'next/font/google';
import './globals.css';

const sans = DM_Sans({ variable: '--font-sans-custom', subsets: ['latin'] });
const serif = Lora({ variable: '--font-serif-custom', subsets: ['latin'] });
export const metadata: Metadata = {
  metadataBase: new URL('https://simpleground.online'),
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
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
