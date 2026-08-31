'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  X,
} from 'lucide-react';

type Variant = { color: string; size: string; price: number; stock: number };
type Product = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  stock: number;
  image: string;
  images?: string[];
  tone: string;
  description: string;
  variants: Variant[];
};
type CartLine = { productId: string; variantIndex: number; quantity: number };

const defaultProducts: Product[] = [
  {
    id: '1',
    name: 'Kemeja Linen Daily',
    category: 'Daily Basic',
    subcategory: 'Kemeja',
    price: 289000,
    stock: 20,
    image:
      'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85',
    tone: 'Sand',
    description:
      'Kemeja linen ringan dengan potongan rileks untuk aktivitas harian.',
    variants: [
      { color: 'Sand', size: 'M', price: 289000, stock: 10 },
      { color: 'Sand', size: 'L', price: 299000, stock: 10 },
    ],
  },
  {
    id: '2',
    name: 'Kaos Daily Essential',
    category: 'Daily Basic',
    subcategory: 'Kaos',
    price: 159000,
    stock: 30,
    image:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85',
    tone: 'Oat',
    description: 'Kaos lembut dan nyaman sebagai pilihan esensial sehari-hari.',
    variants: [
      { color: 'Oat', size: 'M', price: 159000, stock: 15 },
      { color: 'Oat', size: 'L', price: 169000, stock: 15 },
    ],
  },
  {
    id: '3',
    name: 'Celana Linen Relaxed',
    category: 'Daily Basic',
    subcategory: 'Celana',
    price: 319000,
    stock: 18,
    image:
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=900&q=85',
    tone: 'Sage',
    description: 'Celana linen berpotongan santai, sejuk, dan mudah dipadukan.',
    variants: [
      { color: 'Sage', size: 'M', price: 319000, stock: 9 },
      { color: 'Sage', size: 'L', price: 329000, stock: 9 },
    ],
  },
  {
    id: '4',
    name: 'Baju Chef Signature',
    category: 'Chef & Kitchen Wear',
    subcategory: 'Baju Chef',
    price: 349000,
    stock: 15,
    image:
      'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=900&q=85',
    tone: 'White',
    description:
      'Baju chef profesional yang rapi, nyaman, dan leluasa bergerak.',
    variants: [
      { color: 'Putih', size: 'M', price: 349000, stock: 8 },
      { color: 'Hitam', size: 'L', price: 369000, stock: 7 },
    ],
  },
  {
    id: '5',
    name: 'Apron Canvas Ground',
    category: 'Chef & Kitchen Wear',
    subcategory: 'Apron',
    price: 219000,
    stock: 25,
    image:
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85',
    tone: 'Earth',
    description:
      'Apron kanvas kokoh dengan tampilan natural untuk dapur dan usaha.',
    variants: [{ color: 'Earth', size: 'All Size', price: 219000, stock: 25 }],
  },
  {
    id: '6',
    name: 'Topi Chef Classic',
    category: 'Chef & Kitchen Wear',
    subcategory: 'Topi Chef',
    price: 129000,
    stock: 30,
    image:
      'https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?auto=format&fit=crop&w=900&q=85',
    tone: 'White',
    description: 'Topi chef klasik yang ringan untuk melengkapi seragam dapur.',
    variants: [{ color: 'Putih', size: 'All Size', price: 129000, stock: 30 }],
  },
];
const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);

export default function Home() {
  const [category, setCategory] = useState('Semua');
  const [subcategory, setSubcategory] = useState('Semua');
  const [products, setProducts] = useState(defaultProducts);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, number>
  >({});
  const [selectedImages, setSelectedImages] = useState<Record<string, number>>(
    {},
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState('');
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === 'Semua' || p.category === category) &&
          (subcategory === 'Semua' || p.subcategory === subcategory) &&
          p.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [category, subcategory, query, products],
  );
  const catalog = useMemo(() => {
    const suggestions: Record<string, string[]> = {
      'Chef & Kitchen Wear': ['Baju Chef', 'Topi Chef', 'Apron'],
      'Professional Workwear': ['Kemeja PDL', 'Seragam Kerja'],
      'Daily Basic': ['Kaos', 'Kemeja', 'Celana'],
    };
    for (const p of products)
      suggestions[p.category] = Array.from(
        new Set([...(suggestions[p.category] ?? []), p.subcategory]),
      );
    return suggestions;
  }, [products]);
  const count = Object.values(cart).reduce((a, b) => a + b.quantity, 0);
  const cartRows = Object.entries(cart).flatMap(([key, line]) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) return [];
    const variant = product.variants[line.variantIndex] ?? {
      color: product.tone,
      size: 'All Size',
      price: product.price,
      stock: product.stock,
    };
    return [{ key, product, variant, quantity: line.quantity }];
  });
  const subtotal = cartRows.reduce(
    (sum, row) => sum + row.variant.price * row.quantity,
    0,
  );
  const shipping = subtotal ? 18000 : 0;
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d: { products?: typeof defaultProducts }) => {
        if (d.products?.length) setProducts(d.products);
      })
      .catch(() => {});
  }, []);
  function changeItem(productId: string, variantIndex: number, delta: number) {
    const key = `${productId}:${variantIndex}`;
    setCart((current) => {
      const next = Math.max(0, (current[key]?.quantity || 0) + delta);
      const result = {
        ...current,
        [key]: { productId, variantIndex, quantity: next },
      };
      if (!next) delete result[key];
      return result;
    });
  }
  async function submitOrder() {
    setOrderBusy(true);
    setOrderError('');
    const items = cartRows.map(({ product, variant, quantity }) => ({
      id: product.id,
      name: product.name,
      color: variant.color,
      size: variant.size,
      price: variant.price,
      quantity,
    }));
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          shippingAddress,
          items,
        }),
      });
      const data = (await response.json()) as {
        orderNumber?: string;
        error?: string;
      };
      if (!response.ok || !data.orderNumber)
        throw new Error(data.error || 'Pesanan gagal disimpan.');
      setOrderNumber(data.orderNumber);
      setOrdered(true);
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : 'Pesanan gagal disimpan.',
      );
    } finally {
      setOrderBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f4] text-[#17251c]">
      <div className="bg-[#173c2b] px-4 py-2 text-center text-[11px] font-semibold text-white sm:text-xs">
        Gratis ongkir untuk pembelian di atas Rp500.000
      </div>
      <header className="sticky top-0 z-30 border-b bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-8">
          <a
            href="#home"
            className="shrink-0 font-serif text-xl font-bold tracking-[-.04em] sm:text-2xl"
          >
            simple ground<span className="text-[#c0693c]">.</span>
          </a>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-[#276344]/25 bg-[#f7faf7] px-3 py-2.5 focus-within:border-[#276344]">
            <Search size={18} className="shrink-0 text-[#587064]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Cari kaos, kemeja, baju chef..."
            />
          </label>
          <a href="#koleksi" className="hidden text-sm font-semibold lg:block">
            Produk
          </a>
          <a href="#footer" className="hidden text-sm font-semibold lg:block">
            Bantuan
          </a>
          <button
            onClick={() => setCartOpen(true)}
            aria-label={`Buka keranjang, ${count} barang`}
            className="relative flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#173c2b] px-3 text-white sm:px-4"
          >
            <ShoppingBag size={19} />
            <span className="hidden text-sm font-semibold sm:inline">
              Keranjang
            </span>
            {count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#e07a47] px-1 text-[10px] font-bold">
                {count}
              </span>
            )}
          </button>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-8">
          {['Semua', ...Object.keys(catalog)].map((item) => (
            <button
              key={item}
              onClick={() => {
                setCategory(item);
                setSubcategory('Semua');
                document
                  .querySelector('#koleksi')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold ${category === item ? 'bg-[#e5efe8] text-[#17442f]' : 'bg-[#f3f4f2] text-[#58645c]'}`}
            >
              {item === 'Semua' ? 'Semua Produk' : item}
            </button>
          ))}
        </div>
        {category !== 'Semua' && (
          <div className="border-t bg-[#fafbf9]">
            <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-8">
              <span className="my-auto mr-1 shrink-0 text-[11px] font-bold text-[#6a756d]">
                SUBKATEGORI
              </span>
              {['Semua', ...(catalog[category] ?? [])].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setSubcategory(item);
                    document
                      .querySelector('#koleksi')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${subcategory === item ? 'bg-[#173c2b] text-white' : 'border bg-white'}`}
                >
                  {item === 'Semua' ? `Semua ${category}` : item}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <section
        id="home"
        className="mx-auto max-w-7xl px-4 pt-5 sm:px-8 sm:pt-7"
      >
        <div className="relative overflow-hidden rounded-2xl bg-[#dce8df] px-6 py-8 sm:px-10 sm:py-10">
          <div className="relative z-10 max-w-xl">
            <span className="inline-flex rounded-md bg-white/80 px-3 py-1 text-xs font-bold text-[#9a4a28]">
              KOLEKSI SIMPLE GROUND
            </span>
            <h1 className="mt-4 font-serif text-3xl font-bold leading-tight sm:text-5xl">
              Pakaian nyaman untuk aktivitas sehari-hari.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#4e6255] sm:text-base">
              Daily wear, linen, dan perlengkapan chef. Pilih warna serta
              ukuran, lalu pesan langsung dari toko.
            </p>
            <a
              href="#koleksi"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173c2b] px-5 py-3 text-sm font-bold text-white"
            >
              Mulai belanja <ArrowRight size={17} />
            </a>
          </div>
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-[#c9d8c8] sm:-right-8 sm:h-80 sm:w-80" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold sm:text-sm">
            <ShieldCheck className="shrink-0 text-[#2e704d]" size={20} />{' '}
            Pembayaran aman
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold sm:text-sm">
            <Truck className="shrink-0 text-[#2e704d]" size={20} /> Siap dikirim
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold sm:text-sm">
            <Store className="shrink-0 text-[#2e704d]" size={20} /> Produk
            pilihan
          </div>
        </div>
      </section>

      <section id="koleksi" className="px-4 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl font-bold sm:text-3xl">
                Pilihan produk
              </h2>
              <p className="mt-1 text-sm text-[#68756c]">
                {filtered.length} produk ditemukan
              </p>
            </div>
            {(query || category !== 'Semua' || subcategory !== 'Semua') && (
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('Semua');
                  setSubcategory('Semua');
                }}
                className="text-sm font-semibold text-[#276344]"
              >
                Hapus filter
              </button>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {filtered.map((p) => {
              const variantIndex = selectedVariants[p.id] ?? 0;
              const productImages = p.images?.length ? p.images : [p.image];
              const imageIndex = selectedImages[p.id] ?? 0;
              const variant = p.variants[variantIndex] ?? {
                color: p.tone,
                size: 'All Size',
                price: p.price,
                stock: p.stock,
              };
              return (
                <article
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <button
                    onClick={() => setDetailId(p.id)}
                    className="relative block aspect-square w-full overflow-hidden bg-[#ebe5d9] text-left"
                  >
                    <img
                      src={productImages[imageIndex] ?? productImages[0]}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                    <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold">
                      {p.subcategory}
                    </span>
                  </button>
                  <div className="p-3 sm:p-4">
                    <button
                      onClick={() => setDetailId(p.id)}
                      className="line-clamp-2 min-h-10 text-left text-sm font-semibold leading-5 sm:text-base"
                    >
                      {p.name}
                    </button>
                    <p className="mt-2 text-base font-extrabold text-[#b4512d] sm:text-lg">
                      {rupiah(variant.price)}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6d786f]">
                      {variant.color} · {variant.size} · stok {variant.stock}
                    </p>
                    <button
                      onClick={() => setDetailId(p.id)}
                      className="mt-3 w-full rounded-xl border border-[#276344] py-2.5 text-xs font-bold text-[#24593d] sm:text-sm"
                    >
                      Lihat & pilih varian
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed bg-white py-16 text-center">
              <Search className="mx-auto text-[#8a958d]" />
              <p className="mt-3 font-semibold">Produk tidak ditemukan</p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('Semua');
                  setSubcategory('Semua');
                }}
                className="mt-2 text-sm font-semibold text-[#276344]"
              >
                Lihat semua produk
              </button>
            </div>
          )}
        </div>
      </section>

      <section
        id="cerita"
        className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center"
      >
        <div className="overflow-hidden rounded-[2rem]">
          <img
            src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1100&q=85"
            alt="Detail kain dan proses produksi yang teliti"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
        <div className="lg:pl-14">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#a34f2c]">
            Tentang Simple Ground
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-.04em]">
            Lebih sedikit, lebih dekat dengan yang penting.
          </h2>
          <p className="mt-6 leading-7 text-[#566158]">
            Kami percaya benda yang baik tidak perlu berteriak. Setiap koleksi
            dirancang dalam jumlah terbatas, mengutamakan bahan nyaman dan
            siluet yang mudah dipakai berulang kali.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-[#263e2e]/15 pt-6">
            <div>
              <b className="font-serif text-3xl">100%</b>
              <p className="mt-1 text-xs text-[#68736b]">material pilihan</p>
            </div>
            <div>
              <b className="font-serif text-3xl">30 hari</b>
              <p className="mt-1 text-xs text-[#68736b]">tukar ukuran</p>
            </div>
            <div>
              <b className="font-serif text-3xl">Lokal</b>
              <p className="mt-1 text-xs text-[#68736b]">produksi etis</p>
            </div>
          </div>
        </div>
      </section>

      <footer
        id="footer"
        className="bg-[#243b2c] px-5 py-14 text-[#f4efdf] sm:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="font-serif text-3xl font-bold">simple ground.</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#c6d0c6]">
              Daily wear dan kitchen wear yang sederhana, nyaman, dan tahan
              lama.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em]">
              Belanja
            </p>
            <div className="mt-4 space-y-3 text-sm text-[#c6d0c6]">
              <p>Koleksi Daily</p>
              <p>Baju Chef</p>
              <p>Apron & Topi Chef</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em]">
              Bantuan
            </p>
            <div className="mt-4 space-y-3 text-sm text-[#c6d0c6]">
              <p>Pengiriman & retur</p>
              <p>Konfirmasi pembayaran</p>
              <a href="https://wa.me/6285172381996" className="block">
                WhatsApp: 0851-7238-1996
              </a>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-7xl border-t border-white/15 pt-5 text-xs text-[#9eae9f]">
          © 2026 Simple Ground. Dibuat dengan perhatian.
        </p>
      </footer>

      {detailId &&
        products
          .filter((p) => p.id === detailId)
          .map((p) => {
            const productImages = p.images?.length ? p.images : [p.image];
            const imageIndex = selectedImages[p.id] ?? 0;
            const variantIndex = selectedVariants[p.id] ?? 0;
            const variant = p.variants[variantIndex] ?? {
              color: p.tone,
              size: 'All Size',
              price: p.price,
              stock: p.stock,
            };
            return (
              <div
                key={p.id}
                className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5"
                onMouseDown={(e) =>
                  e.target === e.currentTarget && setDetailId(null)
                }
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Detail ${p.name}`}
                  className="max-h-[94vh] w-full max-w-4xl overflow-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4 sm:hidden">
                    <b>Detail produk</b>
                    <button
                      onClick={() => setDetailId(null)}
                      aria-label="Tutup detail"
                    >
                      <X />
                    </button>
                  </div>
                  <div className="grid md:grid-cols-2">
                    <div className="bg-[#f0f1ed] p-4 sm:p-6">
                      <div className="aspect-square overflow-hidden rounded-2xl bg-white">
                        <img
                          src={productImages[imageIndex] ?? productImages[0]}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {productImages.length > 1 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto">
                          {productImages.map((src, index) => (
                            <button
                              key={`${src}-${index}`}
                              onClick={() =>
                                setSelectedImages((s) => ({
                                  ...s,
                                  [p.id]: index,
                                }))
                              }
                              className={`shrink-0 overflow-hidden rounded-lg border-2 ${imageIndex === index ? 'border-[#276344]' : 'border-white'}`}
                              aria-label={`Foto ${index + 1}`}
                            >
                              <img
                                src={src}
                                alt=""
                                className="h-16 w-14 object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative p-5 sm:p-8">
                      <button
                        onClick={() => setDetailId(null)}
                        aria-label="Tutup detail"
                        className="absolute right-5 top-5 hidden rounded-full bg-[#f1f3f0] p-2 md:block"
                      >
                        <X size={20} />
                      </button>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#637168]">
                        {p.category} › {p.subcategory}
                      </span>
                      <h2 className="mt-2 pr-10 font-serif text-2xl font-bold sm:text-3xl">
                        {p.name}
                      </h2>
                      <p className="mt-3 text-2xl font-extrabold text-[#b4512d]">
                        {rupiah(variant.price)}
                      </p>
                      <p className="mt-4 text-sm leading-6 text-[#5f6b63]">
                        {p.description}
                      </p>
                      <div className="my-5 border-t" />
                      <label className="block text-sm font-bold">
                        Pilih warna dan ukuran
                        <select
                          value={variantIndex}
                          onChange={(e) =>
                            setSelectedVariants((s) => ({
                              ...s,
                              [p.id]: Number(e.target.value),
                            }))
                          }
                          className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-[#276344]"
                        >
                          {p.variants.map((v, index) => (
                            <option
                              key={`${v.color}-${v.size}-${index}`}
                              value={index}
                              disabled={v.stock < 1}
                            >
                              {v.color} · {v.size} — {rupiah(v.price)}{' '}
                              {v.stock < 1 ? '(habis)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-2 text-xs text-[#6f7b72]">
                        Stok tersedia: {variant.stock}
                      </p>
                      <button
                        onClick={() => {
                          changeItem(p.id, variantIndex, 1);
                          setDetailId(null);
                          setCartOpen(true);
                        }}
                        disabled={variant.stock < 1}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173c2b] py-3.5 font-bold text-white disabled:bg-gray-400"
                      >
                        <ShoppingBag size={18} />{' '}
                        {variant.stock > 0
                          ? 'Tambah ke keranjang'
                          : 'Stok habis'}
                      </button>
                      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                        <span className="rounded-xl bg-[#f3f6f3] p-3">
                          ✓ Pembayaran transfer Mandiri
                        </span>
                        <span className="rounded-xl bg-[#f3f6f3] p-3">
                          ✓ Bantuan via WhatsApp
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            );
          })}

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setCartOpen(false)
          }
        >
          <aside className="ml-auto flex h-full w-full max-w-md flex-col bg-[#fffdf8] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#263e2e]/10 p-5">
              <div>
                {checkout && (
                  <button
                    onClick={() => {
                      setCheckout(false);
                      setOrdered(false);
                    }}
                    className="mr-3 align-middle"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                <b className="font-serif text-2xl">
                  {checkout ? 'Pembayaran' : 'Keranjang'}{' '}
                  {!checkout && count > 0 && `(${count})`}
                </b>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Tutup">
                <X />
              </button>
            </div>
            {!checkout ? (
              <>
                <div className="flex-1 overflow-auto p-5">
                  {count === 0 ? (
                    <div className="grid h-full place-content-center text-center">
                      <ShoppingBag
                        className="mx-auto mb-4 text-[#7b877e]"
                        size={38}
                      />
                      <p className="font-serif text-xl">
                        Keranjangmu masih kosong.
                      </p>
                      <button
                        onClick={() => setCartOpen(false)}
                        className="mt-4 text-sm font-semibold underline"
                      >
                        Lihat koleksi
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {cartRows.map(
                        ({ key, product: p, variant, quantity }) => (
                          <div key={key} className="flex gap-4">
                            <img
                              src={p.images?.[0] ?? p.image}
                              alt=""
                              className="h-24 w-20 rounded-xl object-cover"
                            />
                            <div className="flex flex-1 flex-col">
                              <b className="text-sm">{p.name}</b>
                              <span className="mt-1 text-xs text-[#758078]">
                                {variant.color} · {variant.size}
                              </span>
                              <div className="mt-auto flex items-center justify-between">
                                <div className="flex items-center gap-3 rounded-full border px-2 py-1">
                                  <button
                                    onClick={() =>
                                      changeItem(
                                        p.id,
                                        Number(key.split(':').pop()),
                                        -1,
                                      )
                                    }
                                    aria-label="Kurangi"
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span className="text-sm">{quantity}</span>
                                  <button
                                    onClick={() =>
                                      changeItem(
                                        p.id,
                                        Number(key.split(':').pop()),
                                        1,
                                      )
                                    }
                                    aria-label="Tambah"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                                <b className="text-sm">
                                  {rupiah(variant.price * quantity)}
                                </b>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
                {count > 0 && (
                  <div className="border-t p-5">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <b>{rupiah(subtotal)}</b>
                    </div>
                    <p className="mt-2 text-xs text-[#758078]">
                      Ongkir tetap Rp18.000.
                    </p>
                    <button
                      onClick={() => setCheckout(true)}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#243b2c] py-3.5 font-semibold text-white"
                    >
                      Lanjut checkout <ArrowRight size={17} />
                    </button>
                  </div>
                )}
              </>
            ) : ordered ? (
              <div className="grid flex-1 place-content-center overflow-auto p-8 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#dce8dc] text-[#243b2c]">
                  <Check size={28} />
                </span>
                <h3 className="mt-5 font-serif text-3xl">Pesanan tersimpan!</h3>
                <p className="mt-3 text-sm leading-6 text-[#637067]">
                  Nomor pesanan <b>{orderNumber}</b>. Admin sudah dapat melihat
                  pesanan ini.
                </p>
                <div className="mt-6 rounded-2xl bg-[#f1ecdf] p-5 text-left text-sm">
                  <p className="text-xs text-[#758078]">
                    Transfer Bank Mandiri
                  </p>
                  <p className="mt-1 text-lg font-bold">9000027694984</p>
                  <p className="text-xs">a.n. Muhammad Arifin</p>
                  <div className="my-4 border-t border-[#263e2e]/10" />
                  <p className="text-xs text-[#758078]">Total transfer</p>
                  <p className="mt-1 text-lg font-bold text-[#a34f2c]">
                    {rupiah(subtotal + shipping)}
                  </p>
                </div>
                <a
                  href={`https://wa.me/6285172381996?text=${encodeURIComponent(`Halo Simple Ground, saya ingin konfirmasi pembayaran pesanan ${orderNumber} sebesar ${rupiah(subtotal + shipping)}.`)}`}
                  className="mt-4 rounded-full bg-[#243b2c] px-5 py-3 text-sm font-semibold text-white"
                >
                  Konfirmasi via WhatsApp
                </a>
                <p className="mt-3 text-xs leading-5 text-[#758078]">
                  Bayar dalam 24 jam agar pesanan tetap tersimpan.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Nama lengkap
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none"
                    placeholder="Nama penerima"
                  />
                </div>
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Nomor WhatsApp
                  </label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    inputMode="tel"
                    className="mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Alamat pengiriman
                  </label>
                  <textarea
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="mt-2 min-h-24 w-full rounded-xl border bg-white px-4 py-3 outline-none"
                    placeholder="Jalan, kecamatan, kota, kode pos"
                  />
                </div>
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Pembayaran
                  </p>
                  <div className="mt-2 rounded-2xl border border-[#243b2c] bg-[#edf1e9] p-4">
                    <b>Bank Mandiri</b>
                    <p className="mt-1 text-sm">
                      9000027694984 · Muhammad Arifin
                    </p>
                  </div>
                </div>
                <div className="mt-6 rounded-2xl bg-[#f1ecdf] p-4 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{rupiah(subtotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span>Pengiriman</span>
                    <span>{rupiah(shipping)}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-3 font-bold">
                    <span>Total</span>
                    <span>{rupiah(subtotal + shipping)}</span>
                  </div>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={
                    orderBusy ||
                    customerName.trim().length < 2 ||
                    customerPhone.trim().length < 8 ||
                    shippingAddress.trim().length < 10
                  }
                  className="mt-5 w-full rounded-full bg-[#c0693c] py-3.5 font-semibold text-white disabled:opacity-60"
                >
                  {orderBusy
                    ? 'Menyimpan pesanan…'
                    : 'Buat pesanan & lihat rekening'}
                </button>
                {orderError && (
                  <p className="mt-3 text-center text-sm text-red-700">
                    {orderError}
                  </p>
                )}
                <p className="mt-3 text-center text-[11px] leading-4 text-[#758078]">
                  Setelah membuat pesanan, transfer pembayaran lalu konfirmasi
                  melalui WhatsApp.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
