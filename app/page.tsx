'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Mail,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Star,
  Truck,
  UserRound,
  X,
} from 'lucide-react';

type Variant = {
  sku?: string;
  color: string;
  size: string;
  normalPrice?: number;
  price: number;
  stock: number;
  sold_count?: number;
  created_at?: string;
};
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
  material?: string;
  care_instructions?: string;
  production_estimate?: string;
  size_guide?: string;
  sold_count?: number;
  created_at?: string;
  variants: Variant[];
};
type CartLine = { productId: string; variantIndex: number; quantity: number };
type Review = {
  id: string;
  product_id: string;
  display_name: string;
  city: string;
  rating: number;
  body: string;
  created_at: string;
};

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
const cleanCategory = (value: string) =>
  value.replace(/^Proffesional Workwear$/i, 'Professional Workwear');
const cleanLabel = (value: string) => {
  const corrected = value.replace(/Kemaja/gi, 'Kemeja');
  return corrected.replace(/\b(kaos|celana|kemeja)\b/gi, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
};

export default function Home() {
  const [category, setCategory] = useState('Semua');
  const [subcategory, setSubcategory] = useState('Semua');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('rekomendasi');
  const [priceLimit, setPriceLimit] = useState(500000);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(16);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, number>
  >({});
  const [selectedImages, setSelectedImages] = useState<Record<string, number>>(
    {},
  );
  const [imageTouchStart, setImageTouchStart] = useState<number | null>(null);
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
  const [account, setAccount] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewCity, setReviewCity] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const filtered = useMemo(() => {
    const result = products.filter(
        (p) =>
          (category === 'Semua' || cleanCategory(p.category) === category) &&
          (subcategory === 'Semua' || cleanLabel(p.subcategory) === subcategory) &&
          cleanLabel(p.name).toLowerCase().includes(query.toLowerCase()) &&
          Math.min(...p.variants.map((variant) => variant.price)) <= priceLimit,
      );
    if (sort === 'termurah')
      return [...result].sort((a, b) => a.price - b.price);
    if (sort === 'terlaris')
      return [...result].sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
    if (sort === 'terbaru')
      return [...result].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    if (sort === 'termahal')
      return [...result].sort((a, b) => b.price - a.price);
    if (sort === 'stok')
      return [...result].sort((a, b) => b.stock - a.stock);
    return result;
  }, [category, subcategory, query, products, priceLimit, sort]);
  const catalog = useMemo(() => {
    const suggestions: Record<string, string[]> = {
      'Chef & Kitchen Wear': ['Baju Chef', 'Topi Chef', 'Apron'],
      'Professional Workwear': ['Kemeja PDL', 'Seragam Kerja'],
      'Daily Basic': ['Kaos', 'Kemeja', 'Celana'],
    };
    for (const p of products) {
      const normalizedCategory = cleanCategory(p.category);
      suggestions[normalizedCategory] = Array.from(
        new Set([...(suggestions[normalizedCategory] ?? []), cleanLabel(p.subcategory)]),
      );
    }
    return suggestions;
  }, [products]);
  useEffect(() => setVisibleCount(16), [category, subcategory, query, priceLimit, sort]);
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
    try {
      setWishlist(JSON.parse(localStorage.getItem('sg_wishlist') || '[]'));
    } catch {}
    fetch('/api/products')
      .then((r) => r.json())
      .then((d: { products?: typeof defaultProducts }) => {
        if (d.products?.length) setProducts(d.products);
        else setProductsError('Katalog belum memiliki produk aktif.');
      })
      .catch(() => setProductsError('Katalog belum dapat dimuat. Coba muat ulang halaman.'))
      .finally(() => setProductsLoading(false));
  }, []);
  function toggleWishlist(productId: string) {
    setWishlist((current) => {
      const next = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      localStorage.setItem('sg_wishlist', JSON.stringify(next));
      return next;
    });
  }
  async function submitNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterMessage('Menyimpan…');
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: newsletterEmail }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNewsletterMessage(data.error ?? 'Email belum dapat disimpan.');
      return;
    }
    setNewsletterEmail('');
    setNewsletterMessage('Terima kasih. Kamu sudah terdaftar.');
  }
  useEffect(() => {
    if (!loginOpen) return;
    const start = () => {
      const google = (window as any).google;
      if (!google) return;
      google.accounts.id.initialize({
        client_id:
          '288475161498-4t2ksn25uhbgc2vm1f1h9bvsuln5feu0.apps.googleusercontent.com',
        callback: async ({ credential }: { credential: string }) => {
          const r = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ credential }),
          });
          if (r.ok) location.reload();
          else
            setReviewMessage(
              'Login Google gagal. Periksa pengaturan domain Google Cloud.',
            );
        },
      });
      const el = document.getElementById('google-login-button');
      if (el) {
        el.innerHTML = '';
        google.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          width: 300,
          text: 'continue_with',
        });
      }
    };
    if ((window as any).google) {
      start();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = start;
    document.head.appendChild(script);
  }, [loginOpen]);
  async function logoutCustomer() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAccount(null);
  }
  useEffect(() => {
    fetch('/api/account')
      .then((r) => r.json())
      .then(async (d) => {
        setAccount(d.user);
        if (d.user) {
          const c = await fetch('/api/cart').then((r) => r.json());
          const saved: Record<string, CartLine> = {};
          for (const i of c.items ?? []) {
            const key = `${i.product_id}:${i.variant_index}`;
            saved[key] = {
              productId: i.product_id,
              variantIndex: i.variant_index,
              quantity: i.quantity,
            };
          }
          setCart(saved);
        } else {
          try {
            setCart(JSON.parse(localStorage.getItem('sg_cart') || '{}'));
          } catch {}
        }
      })
      .catch(() => {});
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews ?? []))
      .catch(() => {});
  }, []);
  async function submitReview(productId: string) {
    setReviewMessage('');
    const r = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId,
        rating: reviewRating,
        body: reviewBody,
        city: reviewCity,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setReviewMessage(d.error ?? 'Ulasan gagal disimpan.');
      return;
    }
    setReviewBody('');
    setReviewCity('');
    setReviewMessage('Ulasan berhasil disimpan.');
    const fresh = await fetch('/api/reviews').then((x) => x.json());
    setReviews(fresh.reviews ?? []);
  }
  function changeItem(productId: string, variantIndex: number, delta: number) {
    const key = `${productId}:${variantIndex}`;
    setCart((current) => {
      const next = Math.max(0, (current[key]?.quantity || 0) + delta);
      const result = {
        ...current,
        [key]: { productId, variantIndex, quantity: next },
      };
      if (!next) delete result[key];
      if (account)
        fetch('/api/cart', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId, variantIndex, quantity: next }),
        }).catch(() => {});
      else localStorage.setItem('sg_cart', JSON.stringify(result));
      return result;
    });
  }
  async function submitOrder() {
    setOrderBusy(true);
    setOrderError('');
    const items = cartRows.map(({ product, quantity, key }) => ({
      id: product.id,
      variantIndex: Number(key.split(':').pop()),
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
        Belanja mudah · Pembayaran transfer bank · Bantuan via WhatsApp
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
          {account ? (
            <div className="flex items-center gap-2">
              <UserRound size={18} />
              <div className="hidden max-w-28 sm:block">
                <p className="truncate text-xs font-bold">{account.name}</p>
                <button
                  onClick={logoutCustomer}
                  className="text-[10px] text-[#66736a] underline"
                >
                  Keluar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              aria-label="Daftar atau masuk"
              className="flex h-10 items-center gap-1 rounded-xl border px-2 text-xs font-bold sm:px-3"
            >
              <UserRound size={17} />
              <span className="hidden sm:inline">Daftar / Masuk</span>
            </button>
          )}
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
        <div className="grid overflow-hidden rounded-[1.75rem] bg-[#dce8df] lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative z-10 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
            <span className="inline-flex rounded-md bg-white/80 px-3 py-1 text-xs font-bold text-[#9a4a28]">
              KOLEKSI SIMPLE GROUND
            </span>
            <h1 className="mt-4 font-serif text-3xl font-bold leading-tight sm:text-5xl">
              Seragam kerja yang terasa senyaman pakaian sehari-hari.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#4e6255] sm:text-base">
              Daily wear dan kitchen wear dengan material pilihan, potongan
              fungsional, dan karakter tenang khas Simple Ground.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#koleksi" className="inline-flex items-center gap-2 rounded-xl bg-[#173c2b] px-5 py-3 text-sm font-bold text-white">
                Lihat koleksi <ArrowRight size={17} />
              </a>
              <a href="#cerita" className="rounded-xl border border-[#173c2b]/25 px-5 py-3 text-sm font-bold text-[#173c2b]">
                Cerita kami
              </a>
            </div>
            <p className="mt-6 text-xs font-semibold text-[#4e6255]">Pengiriman ke seluruh Indonesia · Bantuan via WhatsApp</p>
          </div>
          <div className="relative min-h-72 lg:min-h-[430px]">
            {products[0] ? (
              <img
                src={products[0].images?.[0] ?? products[0].image}
                alt="Produk Simple Ground"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#d9d2c3] via-[#e9e4da] to-[#c7d1c6]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#173c2b]/30 to-transparent" />
            <span className="absolute bottom-5 left-5 rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-[#173c2b] backdrop-blur">Chef & Kitchen Wear</span>
          </div>
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
                {productsLoading ? 'Memuat katalog…' : `${filtered.length} produk ditemukan`}
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
          <div className="mt-6 grid gap-3 rounded-2xl border border-[#173c2b]/10 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-bold text-[#526158]">
              HARGA MAKSIMAL
              <input type="range" min="150000" max="500000" step="25000" value={priceLimit} onChange={(event) => setPriceLimit(Number(event.target.value))} className="mt-2 block w-full accent-[#276344]" />
              <span className="mt-1 block font-normal text-[#6d786f]">Sampai {rupiah(priceLimit)}</span>
            </label>
            <label className="text-xs font-bold text-[#526158]">
              URUTKAN
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-2 block w-full rounded-xl border bg-[#f8faf7] px-3 py-2.5 text-sm font-semibold outline-none">
                <option value="rekomendasi">Rekomendasi</option>
                <option value="terlaris">Terlaris</option>
                <option value="terbaru">Terbaru</option>
                <option value="termurah">Termurah</option>
                <option value="termahal">Tertinggi</option>
              </select>
            </label>
            <div className="rounded-xl bg-[#edf4ee] px-4 py-3 text-sm font-bold text-[#24593d]">{wishlist.length} wishlist</div>
          </div>
          {productsLoading && (
            <div aria-label="Memuat produk" className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-black/5 bg-white">
                  <div className="aspect-square animate-pulse bg-[#e2e7e1]" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-[#e2e7e1]" />
                    <div className="h-5 w-2/3 animate-pulse rounded bg-[#e2e7e1]" />
                    <div className="h-9 animate-pulse rounded-xl bg-[#edf0ec]" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!productsLoading && <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {filtered.slice(0, visibleCount).map((p, productIndex) => {
              const variantIndex = selectedVariants[p.id] ?? 0;
              const productImages = p.images?.length ? p.images : [p.image];
              const imageIndex = selectedImages[p.id] ?? 0;
              const variant = p.variants[variantIndex] ?? {
                color: p.tone,
                size: 'All Size',
                price: p.price,
                stock: p.stock,
              };
              const productReviews = reviews.filter(
                (r) => r.product_id === p.id,
              );
              const average = productReviews.length
                ? productReviews.reduce((s, r) => s + r.rating, 0) /
                  productReviews.length
                : 0;
              return (
                <article
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <button
                    onClick={() => setDetailId(p.id)}
                    className="relative block aspect-square w-full overflow-hidden bg-[#ebe5d9] text-left"
                  >
                    <img
                      src={productImages[imageIndex] ?? productImages[0]}
                      alt={cleanLabel(p.name)}
                      loading={productIndex < 4 ? 'eager' : 'lazy'}
                      fetchPriority={productIndex < 4 ? 'high' : 'auto'}
                      decoding="async"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                    <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold">
                      {p.subcategory}
                    </span>
                  </button>
                  <button onClick={() => toggleWishlist(p.id)} aria-label={wishlist.includes(p.id) ? `Hapus ${cleanLabel(p.name)} dari wishlist` : `Simpan ${cleanLabel(p.name)} ke wishlist`} className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm" style={{ marginTop: 0 }}>
                    <Heart size={17} fill={wishlist.includes(p.id) ? 'currentColor' : 'none'} className={wishlist.includes(p.id) ? 'text-[#b4512d]' : 'text-[#34483b]'} />
                  </button>
                  <div className="p-3 sm:p-4">
                    <button
                      onClick={() => setDetailId(p.id)}
                      className="line-clamp-2 min-h-10 text-left text-sm font-semibold leading-5 sm:text-base"
                    >
                      {cleanLabel(p.name)}
                    </button>
                    <div className="mt-2">
                      <p className="text-base font-extrabold text-[#b4512d] sm:text-lg">
                        {rupiah(variant.price)}
                      </p>
                      {(variant.normalPrice ?? variant.price) >
                        variant.price && (
                        <p className="text-[11px]">
                          <span className="text-[#899188] line-through">
                            {rupiah(variant.normalPrice!)}
                          </span>
                          <span className="ml-2 rounded bg-[#fee8df] px-1.5 py-0.5 font-bold text-[#b4512d]">
                            -
                            {Math.round(
                              (1 - variant.price / variant.normalPrice!) * 100,
                            )}
                            %
                          </span>
                        </p>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-[#6d786f]">
                      {variant.color} · {variant.size} · {p.sold_count || 0} terjual
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#8a5a22]">
                      ★ {average ? average.toFixed(1) : 'Baru'}{' '}
                      {productReviews.length
                        ? `(${productReviews.length} ulasan)`
                        : ''}
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
          </div>}
          {!productsLoading && visibleCount < filtered.length && (
            <div className="mt-8 text-center">
              <button onClick={() => setVisibleCount((count) => count + 16)} className="rounded-xl border border-[#276344] bg-white px-6 py-3 text-sm font-bold text-[#24593d]">
                Muat produk lainnya ({filtered.length - visibleCount})
              </button>
            </div>
          )}
          {!productsLoading && filtered.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed bg-white py-16 text-center">
              <Search className="mx-auto text-[#8a958d]" />
              <p className="mt-3 font-semibold">{productsError || 'Produk tidak ditemukan'}</p>
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
              <b className="font-serif text-2xl sm:text-3xl">Mudah</b>
              <p className="mt-1 text-xs text-[#68736b]">pilih varian</p>
            </div>
            <div>
              <b className="font-serif text-2xl sm:text-3xl">Cepat</b>
              <p className="mt-1 text-xs text-[#68736b]">bantuan WhatsApp</p>
            </div>
            <div>
              <b className="font-serif text-2xl sm:text-3xl">Jelas</b>
              <p className="mt-1 text-xs text-[#68736b]">harga & stok</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#173c2b] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#d9b796]">Ulasan pelanggan</p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">Pengalaman asli dari pembeli Simple Ground.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <figure key={review.id} className="rounded-2xl bg-white/8 p-6 ring-1 ring-white/10">
                <div className="text-[#e7b264]">{'★'.repeat(review.rating)}</div>
                <blockquote className="mt-4 text-sm leading-7 text-[#e7ede8]">“{review.body}”</blockquote>
                <figcaption className="mt-5 text-xs font-bold text-white">{review.display_name}{review.city ? ` · ${review.city}` : ''}</figcaption>
              </figure>
            ))}
            {!reviews.length && <p className="text-sm text-[#d5ded7]">Ulasan pelanggan akan tampil di sini setelah disetujui.</p>}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[2rem] bg-[#efe7d8] p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a34f2c]">Ground Notes</p>
            <h2 className="mt-3 font-serif text-3xl">Koleksi baru, cerita bahan, dan penawaran khusus.</h2>
            <p className="mt-2 text-sm text-[#657066]">Kami mengirim seperlunya. Tidak ada pesan yang memenuhi kotak masuk.</p>
          </div>
          <form className="flex w-full min-w-0 max-w-md flex-col gap-2 sm:flex-row" onSubmit={submitNewsletter}>
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-4 py-3">
              <Mail size={17} className="shrink-0 text-[#68736b]" />
              <input type="email" required value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} aria-label="Alamat email" placeholder="Email kamu" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <button className="min-h-11 rounded-xl bg-[#173c2b] px-5 text-sm font-bold text-white">Daftar</button>
            {newsletterMessage && <p className="text-xs font-semibold text-[#526158] sm:hidden">{newsletterMessage}</p>}
          </form>
        </div>
      </section>

      <footer
        id="footer"
        className="bg-[#243b2c] px-5 py-14 text-[#f4efdf] sm:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.15fr]">
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
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em]">
              Temukan Kami
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-[#c6d0c6]">
              {[
                [
                  'Facebook',
                  'https://www.facebook.com/profile.php?id=61586255756281',
                ],
                ['Instagram', 'https://www.instagram.com/simple_ground'],
                ['TikTok', 'https://www.tiktok.com/@simple.ground'],
                ['X / Twitter', 'https://x.com/Simple_Ground'],
                [
                  'Shopee',
                  'https://shopee.co.id/simpleground?entryPoint=ShopBySearch&searchKeyword=simple%20ground',
                ],
                ['YouTube', 'https://youtube.com/@simple_ground'],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 transition-colors hover:text-white"
                  aria-label={`Kunjungi ${label} Simple Ground`}
                >
                  <span>{label}</span>
                  <ExternalLink
                    size={11}
                    className="opacity-45 transition-opacity group-hover:opacity-100"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-7xl border-t border-white/15 pt-5 text-xs text-[#9eae9f]">
          © 2026 Simple Ground. Dibuat dengan perhatian.
        </p>
      </footer>

      {loginOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setLoginOpen(false)
          }
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <button
              onClick={() => setLoginOpen(false)}
              className="ml-auto block"
              aria-label="Tutup"
            >
              <X />
            </button>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e7efe9]">
              <UserRound className="text-[#24593d]" />
            </div>
            <h2 className="mt-4 font-serif text-2xl font-bold">
              Masuk ke Simple Ground
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#657168]">
              Gunakan akun Google untuk memberi rating dan mengelola ulasan
              Anda.
            </p>
            <div
              id="google-login-button"
              className="mt-5 flex justify-center"
            />
            {reviewMessage && (
              <p className="mt-3 text-xs text-red-700">{reviewMessage}</p>
            )}
            <p className="mt-4 text-[11px] leading-5 text-[#7a857d]">
              Simple Ground hanya menerima nama dan email dari Google. Kami
              tidak menerima kata sandi Anda.
            </p>
          </div>
        </div>
      )}

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
            const productReviews = reviews.filter((r) => r.product_id === p.id);
            const average = productReviews.length
              ? productReviews.reduce((s, r) => s + r.rating, 0) /
                productReviews.length
                : 0;
            const relatedProducts = products
              .filter((item) => item.id !== p.id && (
                item.subcategory === p.subcategory || item.category === p.category
              ))
              .slice(0, 4);
            const moveImage = (direction: number) => {
              setSelectedImages((current) => ({
                ...current,
                [p.id]:
                  (imageIndex + direction + productImages.length) %
                  productImages.length,
              }));
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
                  aria-label={`Detail ${cleanLabel(p.name)}`}
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
                      <div
                        className="relative aspect-square touch-pan-y overflow-hidden rounded-2xl bg-white"
                        onTouchStart={(e) =>
                          setImageTouchStart(e.touches[0].clientX)
                        }
                        onTouchEnd={(e) => {
                          if (imageTouchStart === null) return;
                          const distance =
                            e.changedTouches[0].clientX - imageTouchStart;
                          if (Math.abs(distance) > 40)
                            moveImage(distance < 0 ? 1 : -1);
                          setImageTouchStart(null);
                        }}
                      >
                        <img
                          src={productImages[imageIndex] ?? productImages[0]}
                          alt={cleanLabel(p.name)}
                          className="h-full w-full select-none object-cover transition-opacity duration-200"
                          draggable={false}
                        />
                        {productImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => moveImage(-1)}
                              aria-label="Foto sebelumnya"
                              className="absolute left-3 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2 text-[#243b2c] shadow-md backdrop-blur transition hover:bg-white"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(1)}
                              aria-label="Foto berikutnya"
                              className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2 text-[#243b2c] shadow-md backdrop-blur transition hover:bg-white"
                            >
                              <ChevronRight size={20} />
                            </button>
                            <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                              {imageIndex + 1} / {productImages.length}
                            </span>
                          </>
                        )}
                      </div>
                      {productImages.length > 1 && (
                        <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
                          {productImages.map((src, index) => (
                            <button
                              key={`${src}-${index}`}
                              onClick={() =>
                                setSelectedImages((s) => ({
                                  ...s,
                                  [p.id]: index,
                                }))
                              }
                              className={`shrink-0 snap-start overflow-hidden rounded-lg border-2 transition ${imageIndex === index ? 'border-[#276344] opacity-100' : 'border-white opacity-65 hover:opacity-100'}`}
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
                        {cleanLabel(p.name)}
                      </h2>
                      <div className="mt-3">
                        <p className="text-2xl font-extrabold text-[#b4512d]">
                          {rupiah(variant.price)}
                        </p>
                        {(variant.normalPrice ?? variant.price) >
                          variant.price && (
                          <p className="mt-1 text-sm">
                            <span className="text-[#899188] line-through">
                              {rupiah(variant.normalPrice!)}
                            </span>
                            <span className="ml-2 rounded bg-[#fee8df] px-2 py-1 font-bold text-[#b4512d]">
                              Diskon{' '}
                              {Math.round(
                                (1 - variant.price / variant.normalPrice!) *
                                  100,
                              )}
                              %
                            </span>
                          </p>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold text-[#8a5a22]">
                        ★ {average ? average.toFixed(1) : 'Belum ada rating'}{' '}
                        {productReviews.length
                          ? `· ${productReviews.length} ulasan`
                          : ''}
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
                              {v.sku ? `${v.sku} · ` : ''}
                              {v.color} · {v.size} — {rupiah(v.price)}{' '}
                              {v.stock < 1 ? '(habis)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-2 text-xs text-[#6f7b72]">
                        Stok tersedia: {variant.stock}
                      </p>
                      <div className="mt-4 rounded-2xl border bg-[#fafbf9] p-4">
                        <h3 className="text-sm font-bold">Stok per warna & ukuran</h3>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {p.variants.map((item, index) => (
                            <button
                              type="button"
                              key={`${item.color}-${item.size}-${index}`}
                              onClick={() => setSelectedVariants((current) => ({ ...current, [p.id]: index }))}
                              className={`rounded-lg border p-2 text-left ${variantIndex === index ? 'border-[#276344] bg-[#edf6ef]' : 'bg-white'}`}
                            >
                              <b>{item.color} · {item.size}</b>
                              <span className={`mt-1 block ${item.stock > 0 ? 'text-[#276344]' : 'text-red-700'}`}>
                                {item.stock > 0 ? `${item.stock} tersedia` : 'Habis'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {(p.material || p.care_instructions || p.production_estimate || p.size_guide) && (
                        <div className="mt-4 space-y-3 rounded-2xl bg-[#f3f6f3] p-4 text-sm">
                          {p.material && <div><b>Bahan</b><p className="mt-1 whitespace-pre-line text-[#5f6b63]">{p.material}</p></div>}
                          {p.care_instructions && <div><b>Perawatan</b><p className="mt-1 whitespace-pre-line text-[#5f6b63]">{p.care_instructions}</p></div>}
                          {p.production_estimate && <div><b>Estimasi produksi</b><p className="mt-1 text-[#5f6b63]">{p.production_estimate}</p></div>}
                          {p.size_guide && <div><b>Panduan ukuran</b><p className="mt-1 whitespace-pre-line text-[#5f6b63]">{p.size_guide}</p></div>}
                        </div>
                      )}
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
                      <a
                        href={`https://wa.me/6285172381996?text=${encodeURIComponent(`Halo Simple Ground, saya ingin bertanya tentang ${cleanLabel(p.name)}${variant.sku ? ` (SKU ${variant.sku})` : ''}, warna ${variant.color}, ukuran ${variant.size}.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex w-full items-center justify-center rounded-xl border border-[#276344] py-3 text-sm font-bold text-[#24593d]"
                      >
                        Tanya produk via WhatsApp
                      </a>
                      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                        <span className="rounded-xl bg-[#f3f6f3] p-3">
                          ✓ Pembayaran transfer Mandiri
                        </span>
                        <span className="rounded-xl bg-[#f3f6f3] p-3">
                          ✓ Bantuan via WhatsApp
                        </span>
                      </div>
                      <div className="mt-6 border-t pt-5">
                        <h3 className="font-serif text-xl font-bold">
                          Rating & ulasan
                        </h3>
                        {productReviews.length ? (
                          <div className="mt-3 max-h-48 space-y-3 overflow-auto">
                            {productReviews.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-xl bg-[#f5f7f4] p-3"
                              >
                                <div className="flex justify-between gap-2">
                                  <b className="text-sm">{r.display_name}{r.city ? ` · ${r.city}` : ''}</b>
                                  <span className="text-sm text-amber-600">
                                    {'★'.repeat(r.rating)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-[#59665d]">
                                  {r.body}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-[#6b766e]">
                            Belum ada ulasan. Jadilah yang pertama.
                          </p>
                        )}
                        {account ? (
                          <div className="mt-4 rounded-xl border p-3">
                            <p className="text-sm font-bold">
                              Tulis ulasan sebagai {account.name}
                            </p>
                            <div className="mt-2 flex gap-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setReviewRating(n)}
                                  aria-label={`${n} bintang`}
                                  className={
                                    n <= reviewRating
                                      ? 'text-amber-500'
                                      : 'text-gray-300'
                                  }
                                >
                                  <Star size={24} fill="currentColor" />
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={reviewBody}
                              onChange={(e) => setReviewBody(e.target.value)}
                              maxLength={1000}
                              placeholder="Ceritakan pengalaman Anda dengan produk ini"
                              className="mt-2 min-h-20 w-full rounded-lg border p-3 text-sm"
                            />
                            <input
                              value={reviewCity}
                              onChange={(e) => setReviewCity(e.target.value)}
                              maxLength={80}
                              placeholder="Kota, contoh: Bandung"
                              className="mt-2 w-full rounded-lg border p-3 text-sm"
                            />
                            <button
                              onClick={() => submitReview(p.id)}
                              disabled={!reviewBody.trim() || !reviewCity.trim()}
                              className="mt-2 rounded-lg bg-[#173c2b] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                            >
                              Kirim ulasan
                            </button>
                            {reviewMessage && (
                              <p className="mt-2 text-xs">{reviewMessage}</p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setLoginOpen(true)}
                            className="mt-4 block rounded-xl border border-[#276344] p-3 text-center text-sm font-bold text-[#24593d]"
                          >
                            Daftar / masuk untuk memberi ulasan
                          </button>
                        )}
                      </div>
                    </div>
                    {relatedProducts.length > 0 && (
                      <div className="border-t p-5 md:col-span-2 sm:p-8">
                        <h3 className="font-serif text-xl font-bold">Produk serupa</h3>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {relatedProducts.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => {
                                setDetailId(item.id);
                                setSelectedImages((current) => ({ ...current, [item.id]: 0 }));
                              }}
                              className="overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <img src={item.image} alt={cleanLabel(item.name)} className="aspect-square w-full object-cover" loading="lazy" />
                              <span className="block p-3 text-xs font-bold">{cleanLabel(item.name)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                              <b className="text-sm">{cleanLabel(p.name)}</b>
                              <span className="mt-1 text-xs text-[#758078]">
                                {variant.color} · {variant.size}
                                {variant.sku ? ` · SKU ${variant.sku}` : ''}
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
