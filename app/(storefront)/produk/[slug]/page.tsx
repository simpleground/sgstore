import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getD1 } from '@/db';
import { productImageUrl } from '@/lib/product-editor';
import { productSlug } from '@/lib/product-slug';
import { getCurrentStore, storeBaseUrl } from '@/lib/tenant';
import ProductDetailClient, {
  type DetailProduct,
} from './product-detail-client';

const readArray = (value: unknown) => {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const imageUrl = productImageUrl;
const productFromRow = (row: any): DetailProduct => {
  const keys = readArray(row.images_json).filter(
    (key): key is string => typeof key === 'string' && Boolean(key),
  );
  const image = row.image_key
    ? imageUrl(row.image_key)
    : row.image_url || '/placeholder-product.svg';
  return {
    ...row,
    image,
    images: keys.length ? keys.map(imageUrl) : [image],
    variants: readArray(row.variants_json),
  };
};

async function findProduct(slug: string) {
  const store = await getCurrentStore();
  if (!store) return null;
  const result = await getD1()
    .prepare('SELECT * FROM products WHERE store_id=? AND active=1 AND deleted_at IS NULL')
    .bind(store.id)
    .all<any>();
  const row = result.results.find((item) => productSlug(item.name) === slug);
  return row ? productFromRow(row) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getCurrentStore();
  const product = await findProduct(slug);
  const storeName = store?.name ?? '';
  if (!store || !product) return { title: `Produk tidak ditemukan | ${storeName}` };
  const baseUrl = await storeBaseUrl(store);
  const description = (product.description || `Lihat ${product.name} dari ${storeName}. Temukan pilihan warna, ukuran, harga, dan ketersediaan produk.`).slice(0, 155);
  const image = product.image.startsWith('http')
    ? product.image
    : `${baseUrl}${product.image}`;
  return {
    title: `${product.name} | ${storeName}`,
    alternates: { canonical: `${baseUrl}/produk/${productSlug(product.name)}` },
    description,
    openGraph: { title: product.name, description, images: [image] },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getCurrentStore();
  const product = await findProduct(slug);
  if (!store || !product) notFound();
  const d1 = getD1();
  const [relatedRows, reviewRows] = await Promise.all([
    d1
      .prepare(
        'SELECT * FROM products WHERE store_id=? AND id!=? AND active=1 AND deleted_at IS NULL AND (subcategory=? OR category=?) ORDER BY created_at DESC LIMIT 4',
      )
      .bind(store.id, product.id, product.subcategory, product.category)
      .all<any>(),
    d1
      .prepare(
        'SELECT id,display_name,city,rating,body,created_at FROM reviews WHERE store_id=? AND product_id=? AND active=1 ORDER BY created_at DESC',
      )
      .bind(store.id, product.id)
      .all<any>(),
  ]);
  return (
    <ProductDetailClient
      product={product}
      related={relatedRows.results.map(productFromRow)}
      reviews={reviewRows.results as any}
    />
  );
}
