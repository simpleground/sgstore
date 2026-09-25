'use client';
import { formatWhatsapp, useStoreConfig, whatsappLink } from '@/app/store-config';
import { quantityLimit, preorderLabel } from '@/lib/preorder';

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
import { productPath } from '@/lib/product-slug';
import { availableSizes } from '@/lib/product-sizes';

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
 preorder_enabled?: number;
 preorder_days?: number;
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
type ShippingOption = {
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName: string;
  price: number;
  duration: string;
};

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
  return corrected.replace(
    /\b(kaos|celana|kemeja)\b/gi,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
};

export default function Home() {
  const store = useStoreConfig();
  const manualPayment = store.payments.manual;
  const look = store.appearance;
  const brandName = store.name.toLowerCase();
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
  const [directPurchase, setDirectPurchase] = useState<CartLine | null>(null);
  const [ordered, setOrdered] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [destinationPostalCode, setDestinationPostalCode] = useState('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] =
    useState<ShippingOption | null>(null);
  const [shippingBusy, setShippingBusy] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'midtrans' | 'manual'>(
    () => store.payments.recommended ?? 'manual',
  );
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
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const heroSlides = useMemo(() => {
    const newest = [...products].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')),
    )[0];
    const popular = [...products].sort(
      (a, b) => (b.sold_count || 0) - (a.sold_count || 0),
    )[0];
    // Background tones cycle through the original palette.
    const tones = ['bg-[#dce8df]', 'bg-[#d9d2c3]', 'bg-[#dce2dc]', 'bg-[#e7dfd1]', 'bg-[#d8e0d5]'];
    const slides = look.content.heroSlides.length
      ? look.content.heroSlides
      : [{ eyebrow: '', title: store.name, body: '', category: 'Semua', label: 'Semua koleksi' }];
    const firstAll = slides.findIndex((slide) => slide.category === 'Semua');
    return slides.map((slide, index) => {
      // First "Semua" slide shows the first product, later ones the most popular;
      // category slides show the first product of that category.
      const image =
        slide.category === 'Semua'
          ? index === firstAll
            ? products[0]
            : popular || newest || products[index]
          : products.find(
              (product) => product.category.toLowerCase() === slide.category.toLowerCase(),
            ) || products[index];
      return { ...slide, image: image || products[0], tone: tones[index % tones.length] };
    });
  }, [products, look.content.heroSlides, store.name]);
  useEffect(() => {
    if (
      heroPaused ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const timer = window.setInterval(
      () => setHeroIndex((index) => (index + 1) % heroSlides.length),
      5500,
    );
    return () => window.clearInterval(timer);
  }, [heroPaused, heroSlides.length]);
  useEffect(() => {
    heroSlides.forEach((slide) => {
      const src = slide.image?.images?.[0] ?? slide.image?.image;
      if (src) {
        const preload = new Image();
        preload.src = src;
      }
    });
  }, [heroSlides]);
  const filtered = useMemo(() => {
    const result = products.filter(
      (p) =>
        (category === 'Semua' || cleanCategory(p.category) === category) &&
        (subcategory === 'Semua' ||
          cleanLabel(p.subcategory) === subcategory) &&
        cleanLabel(p.name).toLowerCase().includes(query.toLowerCase()) &&
        (p.variants.length ? Math.min(...p.variants.map((variant) => variant.price)) : p.price) <= priceLimit,
    );
    if (sort === 'termurah')
      return [...result].sort((a, b) => a.price - b.price);
    if (sort === 'terlaris')
      return [...result].sort(
        (a, b) => (b.sold_count || 0) - (a.sold_count || 0),
      );
    if (sort === 'terbaru')
      return [...result].sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
      );
    if (sort === 'termahal')
      return [...result].sort((a, b) => b.price - a.price);
    if (sort === 'stok') return [...result].sort((a, b) => b.stock - a.stock);
    return result;
  }, [category, subcategory, query, products, priceLimit, sort]);
  const catalog = useMemo(() => {
    // Pinned categories (store appearance) first, then whatever the products use.
    const suggestions: Record<string, string[]> = Object.fromEntries(
      look.content.catalogOrder.map((entry) => [entry.category, [...entry.subcategories]]),
    );
    for (const p of products) {
      const normalizedCategory = cleanCategory(p.category);
      const normalizedSubcategory = cleanLabel(p.subcategory);
      if (!look.content.hiddenSubcategories.includes(normalizedSubcategory)) {
        suggestions[normalizedCategory] = Array.from(
          new Set([
            ...(suggestions[normalizedCategory] ?? []),
            normalizedSubcategory,
          ]),
        );
      }
    }
    return suggestions;
  }, [products, look.content.catalogOrder, look.content.hiddenSubcategories]);
  useEffect(
    () => setVisibleCount(16),
    [category, subcategory, query, priceLimit, sort],
  );
  const count = Object.values(cart).reduce((a, b) => a + b.quantity, 0);
  const purchaseCart = directPurchase
    ? {
        [`${directPurchase.productId}:${directPurchase.variantIndex}`]:
          directPurchase,
      }
    : cart;
  const cartRows = Object.entries(purchaseCart).flatMap(([key, line]) => {
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
  const shipping = selectedShipping?.price ?? 0;
  useEffect(() => {
    try {
      setWishlist(JSON.parse(localStorage.getItem('sg_wishlist') || '[]'));
    } catch {}
    fetch('/api/products')
      .then((r) => r.json())
      .then((d: { products?: Product[] }) => {
        if (d.products?.length) setProducts(d.products);
        else setProductsError('Katalog belum memiliki produk aktif.');
      })
      .catch(() =>
        setProductsError(
          'Katalog belum dapat dimuat. Coba muat ulang halaman.',
        ),
      )
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
          process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
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
  useEffect(() => {
    if (productsLoading || !products.length) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== '1') return;
    window.location.replace('/checkout?buy=1');
    return;
  }, [products, productsLoading]);
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
  function buyNow(productId: string, variantIndex: number) {
    sessionStorage.setItem('sg_buy_now', JSON.stringify({productId, variantIndex, quantity:1}));
    window.location.assign('/checkout?buy=1');
  }
  async function checkShippingRates() {
    setShippingBusy(true);
    setShippingError('');
    setSelectedShipping(null);
    const items = cartRows.map(({ product, quantity, key }) => ({
      id: product.id,
      variantIndex: Number(key.split(':').pop()),
      quantity,
    }));
    try {
      const response = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ destinationPostalCode, items }),
      });
      const data = (await response.json()) as {
        options?: ShippingOption[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Ongkir belum tersedia.');
      const options = data.options || [];
      setShippingOptions(options);
      if (!options.length)
        setShippingError('Belum ada layanan kurir untuk tujuan ini.');
    } catch (error) {
      setShippingOptions([]);
      setShippingError(
        error instanceof Error ? error.message : 'Gagal memeriksa ongkir.',
      );
    } finally {
      setShippingBusy(false);
    }
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
          destinationPostalCode,
          shippingOption: selectedShipping
            ? {
                courierCode: selectedShipping.courierCode,
                serviceCode: selectedShipping.serviceCode,
              }
            : null,
          paymentMethod,
          items,
        }),
      });
      const data = (await response.json()) as {
        orderNumber?: string;
        redirectUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.orderNumber)
        throw new Error(data.error || 'Pesanan gagal disimpan.');
      setOrderNumber(data.orderNumber);
      if (paymentMethod === 'midtrans') {
        if (!data.redirectUrl)
          throw new Error('Link pembayaran belum tersedia.');
        window.location.assign(data.redirectUrl);
        return;
      }
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
    <main className="min-h-screen bg-[#f5f6f4] text-[var(--brand-ink)]">
      {look.content.announcement && (
        <div className="bg-[var(--brand)] px-4 py-2 text-center text-[11px] font-semibold text-white sm:text-xs">
          {look.content.announcement}
        </div>
      )}
      <header className="sticky top-0 z-30 border-b bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-8">
          <a
            href="#home"
            className="shrink-0 font-serif text-xl font-bold tracking-[-.04em] sm:text-2xl"
          >
            {look.logoUrl ? (
              // oxlint-disable-next-line nextjs/no-img-element -- uploaded store logo served by /api/product-image
              <img
                src={look.logoUrl}
                alt={store.name}
                className="h-8 w-auto max-w-[180px] object-contain sm:h-9"
              />
            ) : (
              <>
                {brandName}
                <span className="text-[var(--brand-accent)]">.</span>
              </>
            )}
          </a>
          <label className="order-last flex w-full min-w-0 items-center gap-2 rounded-xl border-2 border-[var(--brand-mid)]/25 bg-[#f7faf7] px-3 py-2.5 focus-within:border-[var(--brand-mid)] sm:order-none sm:w-auto sm:flex-1">
            <Search size={18} className="shrink-0 text-[var(--brand-soft-2)]" />
            <input
              aria-label={`Cari produk ${store.name}`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder={look.content.searchPlaceholder}
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
            className="relative flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-white sm:px-4"
          >
            <ShoppingBag size={19} />
            <span className="hidden text-sm font-semibold sm:inline">
              Keranjang
            </span>
            {count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand-accent-bright)] px-1 text-[10px] font-bold">
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
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold ${category === item ? 'bg-[#e5efe8] text-[var(--brand-2)]' : 'bg-[#f3f4f2] text-[#58645c]'}`}
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
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${subcategory === item ? 'bg-[var(--brand)] text-white' : 'border bg-white'}`}
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
        <div
          className={`relative grid min-h-[520px] overflow-hidden rounded-[1.75rem] transition-colors duration-700 lg:min-h-[430px] lg:grid-cols-[1.05fr_.95fr] ${heroSlides[heroIndex].tone}`}
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          aria-roledescription="carousel"
          aria-label={`Koleksi pilihan ${store.name}`}
        >
          <div className="relative z-10 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
            <span className="inline-flex rounded-md bg-white/80 px-3 py-1 text-xs font-bold text-[var(--brand-accent-deeper)]">
              {heroSlides[heroIndex].eyebrow}
            </span>
            <h1
              key={`title-${heroIndex}`}
              className="mt-4 animate-in fade-in slide-in-from-left-3 font-serif text-3xl font-bold leading-tight duration-500 sm:text-5xl"
            >
              {heroSlides[heroIndex].title}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--brand-soft)] sm:text-base">
              {heroSlides[heroIndex].body}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setCategory(heroSlides[heroIndex].category);
                  setSubcategory('Semua');
                  document
                    .querySelector('#koleksi')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white"
              >
                Lihat koleksi <ArrowRight size={17} />
              </button>
              {look.content.about.enabled && (
                <a
                  href="#cerita"
                  className="rounded-xl border border-[var(--brand)]/25 px-5 py-3 text-sm font-bold text-[var(--brand)]"
                >
                  Cerita kami
                </a>
              )}
            </div>
            <p className="mt-6 text-xs font-semibold text-[var(--brand-soft)]">
              {`Pilih produk · Cek ongkir · ${store.payments.midtrans ? 'Bayar VA / QRIS' : manualPayment ? `Transfer ${manualPayment.bankName}` : 'Pesan online'}`}
            </p>
            <div
              className="mt-6 flex items-center gap-2"
              aria-label="Pilih banner"
            >
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.eyebrow}
                  onClick={() => setHeroIndex(index)}
                  aria-label={`Banner ${index + 1}: ${slide.eyebrow}`}
                  aria-current={heroIndex === index}
                  className={`h-2.5 rounded-full transition-all ${heroIndex === index ? 'w-8 bg-[var(--brand)]' : 'w-2.5 bg-[var(--brand)]/30 hover:bg-[var(--brand)]/60'}`}
                />
              ))}
            </div>
          </div>
          <div className="relative min-h-72 lg:min-h-[430px]">
            {heroSlides[heroIndex].image ? (
              <img
                key={`hero-image-${heroIndex}`}
                src={
                  heroSlides[heroIndex].image?.images?.[0] ??
                  heroSlides[heroIndex].image?.image
                }
                alt={
                  heroSlides[heroIndex].image?.name || `Produk ${store.name}`
                }
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full animate-in fade-in object-cover duration-700"
              />
            ) : (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#d9d2c3] via-[#e9e4da] to-[#c7d1c6]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand)]/30 to-transparent" />
            <button
              onClick={() => setHeroIndex((heroIndex - 1 + heroSlides.length) % heroSlides.length)}
              aria-label="Banner sebelumnya"
              className="absolute left-4 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2 text-[var(--brand)] shadow"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              onClick={() => setHeroIndex((heroIndex + 1) % heroSlides.length)}
              aria-label="Banner berikutnya"
              className="absolute right-4 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2 text-[var(--brand)] shadow"
            >
              <ChevronRight size={19} />
            </button>
            <span className="absolute bottom-5 left-5 rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-[var(--brand)] backdrop-blur">
              {heroSlides[heroIndex].label}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold sm:text-sm">
            <ShieldCheck className="shrink-0 text-[var(--brand-mid-3)]" size={20} />{' '}
            {store.payments.midtrans
              ? 'Pembayaran VA / QRIS'
              : manualPayment
                ? `Transfer ${manualPayment.bankName}`
                : 'Pesan online'}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold sm:text-sm">
            <Truck className="shrink-0 text-[var(--brand-mid-3)]" size={20} /> Siap dikirim
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold sm:text-sm">
            <Store className="shrink-0 text-[var(--brand-mid-3)]" size={20} /> Produk
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
                {productsLoading
                  ? 'Memuat katalog…'
                  : `${filtered.length} produk ditemukan`}
              </p>
            </div>
            {(query || category !== 'Semua' || subcategory !== 'Semua' || priceLimit !== 500000) && (
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('Semua');
                  setSubcategory('Semua');
                  setPriceLimit(500000);
                }}
                className="text-sm font-semibold text-[var(--brand-mid)]"
              >
                Hapus filter
              </button>
            )}
          </div>
          <div className="mt-6 grid gap-3 rounded-2xl border border-[var(--brand)]/10 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-bold text-[#526158]">
              HARGA MAKSIMAL
              <input
                type="range"
                min="150000"
                max="500000"
                step="25000"
                value={priceLimit}
                onChange={(event) => setPriceLimit(Number(event.target.value))}
                className="mt-2 block w-full accent-[var(--brand-mid)]"
              />
              <span className="mt-1 block font-normal text-[#6d786f]">
                Sampai {rupiah(priceLimit)}
              </span>
            </label>
            <label className="text-xs font-bold text-[#526158]">
              URUTKAN
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="mt-2 block w-full rounded-xl border bg-[#f8faf7] px-3 py-2.5 text-sm font-semibold outline-none"
              >
                <option value="rekomendasi">Rekomendasi</option>
                <option value="terlaris">Terlaris</option>
                <option value="terbaru">Terbaru</option>
                <option value="termurah">Termurah</option>
                <option value="termahal">Tertinggi</option>
              </select>
            </label>
            <div className="rounded-xl bg-[#edf4ee] px-4 py-3 text-sm font-bold text-[var(--brand-mid-2)]">
              {wishlist.length} wishlist
            </div>
          </div>
          {productsLoading && (
            <div
              aria-label="Memuat produk"
              className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-black/5 bg-white"
                >
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
          {!productsLoading && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
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
                    <a
                      href={productPath(p.name)}
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
                    </a>
                    <button
                      onClick={() => toggleWishlist(p.id)}
                      aria-label={
                        wishlist.includes(p.id)
                          ? `Hapus ${cleanLabel(p.name)} dari wishlist`
                          : `Simpan ${cleanLabel(p.name)} ke wishlist`
                      }
                      className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm"
                      style={{ marginTop: 0 }}
                    >
                      <Heart
                        size={17}
                        fill={wishlist.includes(p.id) ? 'currentColor' : 'none'}
                        className={
                          wishlist.includes(p.id)
                            ? 'text-[var(--brand-accent-2)]'
                            : 'text-[var(--brand-muted)]'
                        }
                      />
                    </button>
                    <div className="p-3 sm:p-4">
                      <a
                        href={productPath(p.name)}
                        className="line-clamp-2 min-h-10 text-left text-sm font-semibold leading-5 sm:text-base"
                      >
                        {cleanLabel(p.name)}
                      </a>
                      <div className="mt-2">
                        <p className="text-base font-extrabold text-[var(--brand-accent-2)] sm:text-lg">
                          {rupiah(variant.price)}
                        </p>
                        {(variant.normalPrice ?? variant.price) >
                          variant.price && (
                          <p className="text-[11px]">
                            <span className="text-[#899188] line-through">
                              {rupiah(variant.normalPrice!)}
                            </span>
                            <span className="ml-2 rounded bg-[var(--brand-accent-tint)] px-1.5 py-0.5 font-bold text-[var(--brand-accent-2)]">
                              -
                              {Math.round(
                                (1 - variant.price / variant.normalPrice!) *
                                  100,
                              )}
                              %
                            </span>
                          </p>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#6d786f]">
                        {availableSizes(p.variants.length ? p.variants : [variant])}
                        {p.sold_count ? ` · ${p.sold_count} terjual` : ''}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-[#8a5a22]">
                        {average ? `★ ${average.toFixed(1)}` : 'Belum ada ulasan'}{' '}
                        {productReviews.length
                          ? `(${productReviews.length} ulasan)`
                          : ''}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!productsLoading && visibleCount < filtered.length && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setVisibleCount((count) => count + 16)}
                className="rounded-xl border border-[var(--brand-mid)] bg-white px-6 py-3 text-sm font-bold text-[var(--brand-mid-2)]"
              >
                Muat produk lainnya ({filtered.length - visibleCount})
              </button>
            </div>
          )}
          {!productsLoading && filtered.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed bg-white py-16 text-center">
              <Search className="mx-auto text-[#8a958d]" />
              <p className="mt-3 font-semibold">
                {productsError || 'Produk tidak ditemukan'}
              </p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('Semua');
                  setSubcategory('Semua');
                }}
                className="mt-2 text-sm font-semibold text-[var(--brand-mid)]"
              >
                Lihat semua produk
              </button>
            </div>
          )}
        </div>
      </section>

      {look.content.about.enabled && (
        <section
          id="cerita"
          className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center"
        >
          {look.aboutImageUrl && (
            <div className="overflow-hidden rounded-[2rem]">
              <img
                src={look.aboutImageUrl}
                alt={look.content.about.imageAlt}
                width={1536}
                height={1024}
                loading="lazy"
                decoding="async"
                className="h-auto w-full bg-[#e8e4db] object-contain"
              />
            </div>
          )}
          <div className="lg:pl-14">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--brand-accent-deep)]">
              {look.content.about.eyebrow}
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-.04em]">
              {look.content.about.title}
            </h2>
            <p className="mt-6 whitespace-pre-line leading-7 text-[#566158]">
              {look.content.about.body}
            </p>
            {look.content.about.highlights.length > 0 && (
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-[var(--brand-deep-2)]/15 pt-6">
                {look.content.about.highlights.map((item) => (
                  <div key={item.title + item.caption}>
                    <b className="font-serif text-2xl sm:text-3xl">{item.title}</b>
                    <p className="mt-1 text-xs text-[#68736b]">{item.caption}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {look.content.showReviews && (
      <section className="bg-[var(--brand)] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#d9b796]">
              Ulasan pelanggan
            </p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
              {`Pengalaman asli dari pembeli ${store.name}.`}
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <figure
                key={review.id}
                className="rounded-2xl bg-white/8 p-6 ring-1 ring-white/10"
              >
                <div className="text-[#e7b264]">
                  {'★'.repeat(review.rating)}
                </div>
                <blockquote className="mt-4 text-sm leading-7 text-[#e7ede8]">
                  “{review.body}”
                </blockquote>
                <figcaption className="mt-5 text-xs font-bold text-white">
                  {review.display_name}
                  {review.city ? ` · ${review.city}` : ''}
                </figcaption>
              </figure>
            ))}
            {!reviews.length && (
              <p className="text-sm text-[#d5ded7]">
                Ulasan pelanggan akan tampil di sini setelah disetujui.
              </p>
            )}
          </div>
        </div>
      </section>
      )}

      {look.content.newsletter.enabled && (
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[2rem] bg-[#efe7d8] p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--brand-accent-deep)]">
              {look.content.newsletter.eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-3xl">
              {look.content.newsletter.title}
            </h2>
            <p className="mt-2 text-sm text-[#657066]">
              {look.content.newsletter.body}
            </p>
          </div>
          <form
            className="flex w-full min-w-0 max-w-md flex-col gap-2 sm:flex-row"
            onSubmit={submitNewsletter}
          >
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-4 py-3">
              <Mail size={17} className="shrink-0 text-[#68736b]" />
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
                aria-label="Alamat email"
                placeholder="Email kamu"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <button className="min-h-11 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white">
              Daftar
            </button>
            {newsletterMessage && (
              <p className="text-xs font-semibold text-[#526158] sm:hidden">
                {newsletterMessage}
              </p>
            )}
          </form>
        </div>
      </section>
      )}

      <footer
        id="footer"
        className="bg-[var(--brand-deep)] px-5 py-14 text-[#f4efdf] sm:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.15fr]">
          <div>
            <p className="font-serif text-3xl font-bold">{`${brandName}.`}</p>
            {look.content.tagline && (
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#c6d0c6]">
                {look.content.tagline}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em]">
              Belanja
            </p>
            <div className="mt-4 space-y-3 text-sm text-[#c6d0c6]">
              {(look.content.shopLinks.length
                ? look.content.shopLinks
                : Object.keys(catalog)
                    .slice(0, 3)
                    .map((name) => ({ label: name, category: name, subcategory: 'Semua' }))
              ).map((link) => (
                <a key={link.label} className="block hover:underline" href="#koleksi" onClick={() => { setCategory(link.category); setSubcategory(link.subcategory); setQuery(''); }}>{link.label}</a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em]">
              Bantuan
            </p>
            <div className="mt-4 space-y-3 text-sm text-[#c6d0c6]">
              {store.whatsapp && (
                <a className="block hover:underline" href={whatsappLink(store, `Halo ${store.name}, saya ingin bertanya tentang pengiriman dan retur.`)}>Tanya pengiriman & retur</a>
              )}
              {store.payments.midtrans && <p>Bayar online dengan VA / QRIS</p>}
              {store.whatsapp && (
                <a href={whatsappLink(store)} className="block">
                  Konsultasi WhatsApp: {formatWhatsapp(store.whatsapp)}
                </a>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em]">
              Temukan Kami
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-[#c6d0c6]">
              {store.socialLinks.map(({ label, url: href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 transition-colors hover:text-white"
                  aria-label={`Kunjungi ${label} ${store.name}`}
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
          {`© ${new Date().getFullYear()} ${store.name}. Dibuat dengan perhatian.`}
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
              <UserRound className="text-[var(--brand-mid-2)]" />
            </div>
            <h2 className="mt-4 font-serif text-2xl font-bold">
              {`Masuk ke ${store.name}`}
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
              {`${store.name} hanya menerima nama dan email dari Google. Kami tidak menerima kata sandi Anda.`}
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
              .filter(
                (item) =>
                  item.id !== p.id &&
                  (item.subcategory === p.subcategory ||
                    item.category === p.category),
              )
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
                              className="absolute left-3 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2 text-[var(--brand-deep)] shadow-md backdrop-blur transition hover:bg-white"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(1)}
                              aria-label="Foto berikutnya"
                              className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2 text-[var(--brand-deep)] shadow-md backdrop-blur transition hover:bg-white"
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
                              className={`shrink-0 snap-start overflow-hidden rounded-lg border-2 transition ${imageIndex === index ? 'border-[var(--brand-mid)] opacity-100' : 'border-white opacity-65 hover:opacity-100'}`}
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
                        <p className="text-2xl font-extrabold text-[var(--brand-accent-2)]">
                          {rupiah(variant.price)}
                        </p>
                        {(variant.normalPrice ?? variant.price) >
                          variant.price && (
                          <p className="mt-1 text-sm">
                            <span className="text-[#899188] line-through">
                              {rupiah(variant.normalPrice!)}
                            </span>
                            <span className="ml-2 rounded bg-[var(--brand-accent-tint)] px-2 py-1 font-bold text-[var(--brand-accent-2)]">
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
                          className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand-mid)]"
                        >
                          {p.variants.map((v, index) => (
                            <option
                              key={`${v.color}-${v.size}-${index}`}
                              value={index}
                              disabled={quantityLimit(p,v) < 1}
                            >
                              {v.sku ? `${v.sku} · ` : ''}
                              {v.color} · {v.size} — {rupiah(v.price)}{' '}
                              {v.stock === 0 ? '(pre-order)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-2 text-xs text-[#6f7b72]">
                        Stok tersedia: {variant.stock}
                      </p>
                      <div className="mt-4 rounded-2xl border bg-[#fafbf9] p-4">
                        <h3 className="text-sm font-bold">
                          Stok per warna & ukuran
                        </h3>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {p.variants.map((item, index) => (
                            <button
                              type="button"
                              key={`${item.color}-${item.size}-${index}`}
                              onClick={() =>
                                setSelectedVariants((current) => ({
                                  ...current,
                                  [p.id]: index,
                                }))
                              }
                              className={`rounded-lg border p-2 text-left ${variantIndex === index ? 'border-[var(--brand-mid)] bg-[#edf6ef]' : 'bg-white'}`}
                            >
                              <b>
                                {item.color} · {item.size}
                              </b>
                              <span
                                className={`mt-1 block ${item.stock > 0 ? 'text-[var(--brand-mid)]' : 'text-red-700'}`}
                              >
                                {item.stock > 0
                                  ? `${item.stock} tersedia`
                                  : 'Pre-order'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {(p.material ||
                        p.care_instructions ||
                        p.production_estimate ||
                        p.size_guide) && (
                        <div className="mt-4 space-y-3 rounded-2xl bg-[#f3f6f3] p-4 text-sm">
                          {p.material && (
                            <div>
                              <b>Bahan</b>
                              <p className="mt-1 whitespace-pre-line text-[#5f6b63]">
                                {p.material}
                              </p>
                            </div>
                          )}
                          {p.care_instructions && (
                            <div>
                              <b>Perawatan</b>
                              <p className="mt-1 whitespace-pre-line text-[#5f6b63]">
                                {p.care_instructions}
                              </p>
                            </div>
                          )}
                          {p.production_estimate && (
                            <div>
                              <b>Estimasi produksi</b>
                              <p className="mt-1 text-[#5f6b63]">
                                {p.production_estimate}
                              </p>
                            </div>
                          )}
                          {p.size_guide && (
                            <div>
                              <b>Panduan ukuran</b>
                              <p className="mt-1 whitespace-pre-line text-[#5f6b63]">
                                {p.size_guide}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        <button
                          onClick={() => {
                            changeItem(p.id, variantIndex, 1);
                            setDetailId(null);
                            setCartOpen(true);
                          }}
                          disabled={quantityLimit(p,variant) < 1}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--brand)] py-3.5 font-bold text-[var(--brand)] disabled:border-gray-300 disabled:text-gray-400"
                        >
                          <ShoppingBag size={18} /> Tambah ke keranjang
                        </button>
                        <button
                          onClick={() => buyNow(p.id, variantIndex)}
                          disabled={quantityLimit(p,variant) < 1}
                          className="w-full rounded-xl bg-[var(--brand-accent)] py-3.5 font-bold text-white disabled:bg-gray-400"
                        >
                          Beli langsung
                        </button>
                      </div>
                      {store.whatsapp && (
                        <a
                          href={whatsappLink(store, `Halo ${store.name}, saya ingin bertanya tentang ${cleanLabel(p.name)}${variant.sku ? ` (SKU ${variant.sku})` : ''}, warna ${variant.color}, ukuran ${variant.size}.`)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 flex w-full items-center justify-center rounded-xl border border-[var(--brand-mid)] py-3 text-sm font-bold text-[var(--brand-mid-2)]"
                        >
                          Tanya produk via WhatsApp
                        </a>
                      )}
                      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                        <span className="rounded-xl bg-[#f3f6f3] p-3">
                          ✓ {manualPayment
                            ? `Pembayaran transfer ${manualPayment.bankName}`
                            : 'Pembayaran QRIS & Virtual Account'}
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
                                  <b className="text-sm">
                                    {r.display_name}
                                    {r.city ? ` · ${r.city}` : ''}
                                  </b>
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
                              disabled={
                                !reviewBody.trim() || !reviewCity.trim()
                              }
                              className="mt-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
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
                            className="mt-4 block rounded-xl border border-[var(--brand-mid)] p-3 text-center text-sm font-bold text-[var(--brand-mid-2)]"
                          >
                            Daftar / masuk untuk memberi ulasan
                          </button>
                        )}
                      </div>
                    </div>
                    {relatedProducts.length > 0 && (
                      <div className="border-t p-5 md:col-span-2 sm:p-8">
                        <h3 className="font-serif text-xl font-bold">
                          Produk serupa
                        </h3>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {relatedProducts.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => {
                                setDetailId(item.id);
                                setSelectedImages((current) => ({
                                  ...current,
                                  [item.id]: 0,
                                }));
                              }}
                              className="overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <img
                                src={item.image}
                                alt={cleanLabel(item.name)}
                                className="aspect-square w-full object-cover"
                                loading="lazy"
                              />
                              <span className="block p-3 text-xs font-bold">
                                {cleanLabel(item.name)}
                              </span>
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
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setCartOpen(false);
            setDirectPurchase(null);
          }}
        >
          <aside className="ml-auto flex h-full w-full max-w-md flex-col bg-[#fffdf8] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--brand-deep-2)]/10 p-5">
              <div>
                {checkout && (
                  <button
                    onClick={() => {
                      setCheckout(false);
                      setOrdered(false);
                      setDirectPurchase(null);
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
              <button
                onClick={() => {
                  setCartOpen(false);
                  setDirectPurchase(null);
                }}
                aria-label="Tutup"
              >
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
                                <span className="block mt-1">{preorderLabel(p,variant)}</span>
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
                      Ongkir dihitung sesuai alamat dan kurir saat checkout.
                    </p>
                    <button
                      onClick={() => window.location.assign('/checkout')}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-deep)] py-3.5 font-semibold text-white"
                    >
                      Lanjut checkout <ArrowRight size={17} />
                    </button>
                  </div>
                )}
              </>
            ) : ordered ? (
              <div className="grid flex-1 place-content-center overflow-auto p-8 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#dce8dc] text-[var(--brand-deep)]">
                  <Check size={28} />
                </span>
                <h3 className="mt-5 font-serif text-3xl">Pesanan tersimpan!</h3>
                <p className="mt-3 text-sm leading-6 text-[#637067]">
                  Nomor pesanan <b>{orderNumber}</b>. Admin sudah dapat melihat
                  pesanan ini.
                </p>
                <div className="mt-6 rounded-2xl bg-[#f1ecdf] p-5 text-left text-sm">
                  {manualPayment && (
                    <>
                      <p className="text-xs text-[#758078]">
                        Transfer {manualPayment.bankName}
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {manualPayment.accountNumber}
                      </p>
                      <p className="text-xs">a.n. {manualPayment.accountHolder}</p>
                      <div className="my-4 border-t border-[var(--brand-deep-2)]/10" />
                    </>
                  )}
                  <p className="text-xs text-[#758078]">Total transfer</p>
                  <p className="mt-1 text-lg font-bold text-[var(--brand-accent-deep)]">
                    {rupiah(subtotal + shipping)}
                  </p>
                </div>
                {store.whatsapp && (
                  <a
                    href={whatsappLink(store, `Halo ${store.name}, saya ingin konfirmasi pembayaran pesanan ${orderNumber} sebesar ${rupiah(subtotal + shipping)}.`)}
                    className="mt-4 rounded-full bg-[var(--brand-deep)] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Konfirmasi via WhatsApp
                  </a>
                )}
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
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider">
                    Kode pos tujuan
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={destinationPostalCode}
                      onChange={(event) => {
                        setDestinationPostalCode(
                          event.target.value.replace(/\D/g, '').slice(0, 5),
                        );
                        setShippingOptions([]);
                        setSelectedShipping(null);
                      }}
                      inputMode="numeric"
                      placeholder="5 digit"
                      className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 outline-none"
                    />
                    <button
                      type="button"
                      onClick={checkShippingRates}
                      disabled={
                        shippingBusy || destinationPostalCode.length !== 5
                      }
                      className="rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {shippingBusy ? 'Memeriksa…' : 'Cek ongkir'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[#758078]">
                    Masukkan 5 digit kode pos lalu tekan Cek ongkir. Dalam mode
                    Sandbox, harga yang bertanda estimasi belum merupakan tarif
                    kurir sungguhan.
                  </p>
                  {shippingError && (
                    <p className="mt-2 text-sm text-red-700">{shippingError}</p>
                  )}
                  {shippingOptions.length > 0 && (
                    <div className="mt-3 max-h-52 space-y-2 overflow-auto">
                      {shippingOptions.map((option) => {
                        const key = `${option.courierCode}:${option.serviceCode}`;
                        const selected =
                          selectedShipping?.courierCode ===
                            option.courierCode &&
                          selectedShipping?.serviceCode === option.serviceCode;
                        return (
                          <label
                            key={key}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${selected ? 'border-[var(--brand-deep)] bg-[#edf1e9]' : 'bg-white'}`}
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="shipping"
                                checked={selected}
                                onChange={() => setSelectedShipping(option)}
                                className="accent-[var(--brand-deep)]"
                              />
                              <span>
                                <b className="block text-sm">
                                  {option.courierName} {option.serviceName}
                                </b>
                                <span className="text-xs text-[#637067]">
                                  {option.duration ||
                                    'Estimasi mengikuti kurir'}
                                </span>
                              </span>
                            </span>
                            <b className="shrink-0 text-sm">
                              {rupiah(option.price)}
                            </b>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Pembayaran
                  </p>
                  <div className="mt-2 space-y-2">
                    {store.payments.midtrans && (
                      <label
                        className={`block cursor-pointer rounded-2xl border p-4 transition ${paymentMethod === 'midtrans' ? 'border-[var(--brand-deep)] bg-[#edf1e9]' : 'bg-white'}`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="payment"
                            checked={paymentMethod === 'midtrans'}
                            onChange={() => setPaymentMethod('midtrans')}
                            className="mt-1 accent-[var(--brand-deep)]"
                          />
                          <span>
                            <b>QRIS & Virtual Account</b>
                            <span className="mt-1 block text-sm text-[#637067]">
                              Bayar otomatis lewat QRIS atau VA bank. Status
                              pesanan diperbarui otomatis.
                            </span>
                            {store.payments.recommended === 'midtrans' && (
                              <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-mid-2)]">
                                Direkomendasikan
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                    )}
                    {manualPayment && (
                      <label
                        className={`block cursor-pointer rounded-2xl border p-4 transition ${paymentMethod === 'manual' ? 'border-[var(--brand-deep)] bg-[#edf1e9]' : 'bg-white'}`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="payment"
                            checked={paymentMethod === 'manual'}
                            onChange={() => setPaymentMethod('manual')}
                            className="mt-1 accent-[var(--brand-deep)]"
                          />
                          <span>
                            <b>Transfer manual {manualPayment.bankName}</b>
                            <span className="mt-1 block text-sm text-[#637067]">
                              {store.whatsapp
                                ? `Perlu bantuan? Konsultasikan melalui WhatsApp sebelum transfer manual ke ${manualPayment.bankName}.`
                                : 'Informasi rekening muncul setelah pesanan dibuat.'}
                            </span>
                            {store.payments.recommended === 'manual' && (
                              <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-mid-2)]">
                                Direkomendasikan
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                    )}
                    {!store.payments.midtrans && !manualPayment && (
                      <p className="rounded-2xl border bg-white p-4 text-sm text-[#637067]">
                        Toko ini belum membuka pembayaran online.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 rounded-2xl bg-[#f1ecdf] p-4 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{rupiah(subtotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span>Pengiriman</span>
                    <span>
                      {selectedShipping ? rupiah(shipping) : 'Pilih kurir'}
                    </span>
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
                    shippingAddress.trim().length < 10 ||
                    !selectedShipping
                  }
                  className="mt-5 w-full rounded-full bg-[var(--brand-accent)] py-3.5 font-semibold text-white disabled:opacity-60"
                >
                  {orderBusy
                    ? 'Menyiapkan pembayaran…'
                    : paymentMethod === 'midtrans'
                      ? 'Lanjut bayar QRIS / Virtual Account'
                      : 'Buat pesanan & lihat rekening'}
                </button>
                {orderError && (
                  <p className="mt-3 text-center text-sm text-red-700">
                    {orderError}
                  </p>
                )}
                <p className="mt-3 text-center text-[11px] leading-4 text-[#758078]">
                  {`Pembayaran otomatis diproses aman oleh Midtrans. ${store.name} tidak menyimpan data kartu atau PIN pembayaran Anda.`}
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
