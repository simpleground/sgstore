import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getD1 } from '@/db';
import { productSlug } from '@/lib/product-slug';
import ProductDetailClient, { type DetailProduct } from './product-detail-client';

const readArray = (value: unknown) => { try { const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
const imageUrl = (key: string) => `/api/product-image/${key}`;
const productFromRow = (row: any): DetailProduct => {
  const keys = readArray(row.images_json).filter((key): key is string => typeof key === 'string' && Boolean(key));
  const image = row.image_key ? imageUrl(row.image_key) : row.image_url || '/placeholder-product.svg';
  return { ...row, image, images: keys.length ? keys.map(imageUrl) : [image], variants: readArray(row.variants_json) };
};

async function findProduct(slug: string) {
  const result = await getD1().prepare('SELECT * FROM products WHERE active=1 AND deleted_at IS NULL').all<any>();
  const row = result.results.find((item) => productSlug(item.name) === slug);
  return row ? productFromRow(row) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) return { title: 'Produk tidak ditemukan | Simple Ground' };
  const description = product.description.slice(0, 155);
  const image = product.image.startsWith('http') ? product.image : `https://simpleground.online${product.image}`;
  return { title: `${product.name} | Simple Ground`, description, openGraph: { title: product.name, description, images: [image] }, twitter: { card: 'summary_large_image', title: product.name, description, images: [image] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) notFound();
  const d1 = getD1();
  const [relatedRows, reviewRows] = await Promise.all([
    d1.prepare('SELECT * FROM products WHERE id!=? AND active=1 AND deleted_at IS NULL AND (subcategory=? OR category=?) ORDER BY created_at DESC LIMIT 4').bind(product.id, product.subcategory, product.category).all<any>(),
    d1.prepare('SELECT id,display_name,city,rating,body,created_at FROM reviews WHERE product_id=? AND active=1 ORDER BY created_at DESC').bind(product.id).all<any>(),
  ]);
  return <ProductDetailClient product={product} related={relatedRows.results.map(productFromRow)} reviews={reviewRows.results as any} />;
}
