'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { productPath } from '@/lib/product-slug';

type Variant = { sku?: string; color: string; size: string; normalPrice?: number; price: number; stock: number };
export type DetailProduct = {
  id: string; name: string; category: string; subcategory: string; description: string;
  material?: string; care_instructions?: string; production_estimate?: string; size_guide?: string;
  image: string; images: string[]; variants: Variant[]; sold_count?: number;
};
type Review = { id: string; display_name: string; city: string; rating: number; body: string; created_at: string };

const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export default function ProductDetailClient({ product, related, reviews }: { product: DetailProduct; related: DetailProduct[]; reviews: Review[] }) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [message, setMessage] = useState('');
  const variant = product.variants[variantIndex] || product.variants[0];
  const images = product.images?.length ? product.images : [product.image];
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

  async function addToCart() {
    if (!variant || variant.stock < 1) return;
    const key = `${product.id}:${variantIndex}`;
    let cart: Record<string, { productId: string; variantIndex: number; quantity: number }> = {};
    try { cart = JSON.parse(localStorage.getItem('sg_cart') || '{}'); } catch {}
    const quantity = Math.min(variant.stock, (cart[key]?.quantity || 0) + 1);
    cart[key] = { productId: product.id, variantIndex, quantity };
    localStorage.setItem('sg_cart', JSON.stringify(cart));
    await fetch('/api/cart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: product.id, variantIndex, quantity }) }).catch(() => {});
    setMessage('Produk ditambahkan ke keranjang. Buka halaman toko untuk melanjutkan checkout.');
  }

  return (
    <main className="min-h-screen bg-[#f7f4ec] text-[#17251c]">
      <header className="sticky top-0 z-20 border-b bg-[#fffdf8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="font-serif text-xl font-bold">simple ground.</a>
          <a href="/#koleksi" className="text-sm font-bold text-[#24593d]">← Kembali ke katalog</a>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <nav className="mb-5 text-xs text-[#6f7b72]"><a href="/">Beranda</a> · <span>{product.category}</span> · <b>{product.name}</b></nav>
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="grid md:grid-cols-2">
            <div className="bg-[#eef0eb] p-4 sm:p-7">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white">
                <img src={images[imageIndex] || product.image} alt={product.name} className="h-full w-full object-cover" />
                {images.length > 1 && <>
                  <button onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)} aria-label="Foto sebelumnya" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronLeft /></button>
                  <button onClick={() => setImageIndex((imageIndex + 1) % images.length)} aria-label="Foto berikutnya" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronRight /></button>
                </>}
              </div>
              {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto">{images.map((src, index) => <button key={`${src}-${index}`} onClick={() => setImageIndex(index)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${index === imageIndex ? 'border-[#276344]' : 'border-transparent opacity-65'}`}><img src={src} alt="" className="h-16 w-14 object-cover" /></button>)}</div>}
            </div>
            <div className="p-5 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-[#637168]">{product.category} › {product.subcategory}</p>
              <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{product.name}</h1>
              <p className="mt-3 text-2xl font-extrabold text-[#b4512d]">{rupiah(variant?.price || 0)}</p>
              <p className="mt-2 text-sm font-bold text-[#8a5a22]">★ {average ? average.toFixed(1) : 'Belum ada rating'} {reviews.length ? `· ${reviews.length} ulasan` : ''} · {product.sold_count || 0} terjual</p>
              <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#5f6b63]">{product.description}</p>

              <label className="mt-6 block text-sm font-bold">Pilih warna dan ukuran
                <select value={variantIndex} onChange={(event) => setVariantIndex(Number(event.target.value))} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm">
                  {product.variants.map((item, index) => <option key={`${item.color}-${item.size}-${index}`} value={index} disabled={item.stock < 1}>{item.sku ? `${item.sku} · ` : ''}{item.color} · {item.size} — {rupiah(item.price)} {item.stock < 1 ? '(habis)' : ''}</option>)}
                </select>
              </label>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">{product.variants.map((item, index) => <button key={`${item.color}-${item.size}-${index}`} onClick={() => setVariantIndex(index)} className={`rounded-xl border p-3 text-left ${index === variantIndex ? 'border-[#276344] bg-[#edf6ef]' : ''}`}><b>{item.color} · {item.size}</b><span className={`mt-1 block ${item.stock ? 'text-[#276344]' : 'text-red-700'}`}>{item.stock ? `${item.stock} tersedia` : 'Habis'}</span></button>)}</div>

              {(product.material || product.care_instructions || product.production_estimate || product.size_guide) && <div className="mt-5 space-y-4 rounded-2xl bg-[#f3f6f3] p-4 text-sm">
                {product.material && <div><b>Bahan</b><p className="mt-1 whitespace-pre-line text-[#5f6b63]">{product.material}</p></div>}
                {product.care_instructions && <div><b>Perawatan</b><p className="mt-1 whitespace-pre-line text-[#5f6b63]">{product.care_instructions}</p></div>}
                {product.production_estimate && <div><b>Estimasi produksi</b><p className="mt-1 text-[#5f6b63]">{product.production_estimate}</p></div>}
                {product.size_guide && <div><b>Panduan ukuran</b><p className="mt-1 whitespace-pre-line text-[#5f6b63]">{product.size_guide}</p></div>}
              </div>}

              <button onClick={addToCart} disabled={!variant || variant.stock < 1} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173c2b] py-3.5 font-bold text-white disabled:bg-gray-400"><ShoppingBag size={18} />{variant?.stock ? 'Tambah ke keranjang' : 'Stok habis'}</button>
              <a href={`https://wa.me/6285172381996?text=${encodeURIComponent(`Halo Simple Ground, saya ingin bertanya tentang ${product.name}${variant?.sku ? ` (SKU ${variant.sku})` : ''}, warna ${variant?.color}, ukuran ${variant?.size}.`)}`} target="_blank" rel="noreferrer" className="mt-2 flex w-full justify-center rounded-xl border border-[#276344] py-3 text-sm font-bold text-[#24593d]">Tanya produk via WhatsApp</a>
              {message && <p className="mt-3 rounded-xl bg-[#edf6ef] p-3 text-xs font-semibold text-[#24593d]">{message}</p>}
            </div>
          </div>

          <div className="border-t p-5 sm:p-8"><h2 className="font-serif text-2xl font-bold">Rating & ulasan</h2>{reviews.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-xl bg-[#f5f7f4] p-4"><div className="flex justify-between gap-3"><b>{review.display_name}{review.city ? ` · ${review.city}` : ''}</b><span className="text-amber-600">{'★'.repeat(review.rating)}</span></div><p className="mt-1 text-xs text-[#7a857d]">{new Date(review.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="mt-2 text-sm text-[#59665d]">{review.body}</p></article>)}</div> : <p className="mt-2 text-sm text-[#6b766e]">Belum ada ulasan untuk produk ini.</p>}</div>
        </section>

        {related.length > 0 && <section className="mt-8"><h2 className="font-serif text-2xl font-bold">Produk serupa</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{related.map((item) => <a key={item.id} href={productPath(item.name)} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"><img src={item.image} alt={item.name} className="aspect-square w-full object-cover" loading="lazy" /><div className="p-3"><b className="text-sm">{item.name}</b><p className="mt-1 text-sm font-bold text-[#b4512d]">{rupiah(item.variants[0]?.price || 0)}</p></div></a>)}</div></section>}
      </div>
    </main>
  );
}
