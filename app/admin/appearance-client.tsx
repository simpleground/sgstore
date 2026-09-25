'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  FontPreset,
  HeroSlide,
  HomeSection,
  ImageField,
  StoreAppearance,
  StoreLayout,
} from '@/lib/store-appearance';

const DEFAULT_PRIMARY = '#173c2b';
const DEFAULT_ACCENT = '#c0693c';
const input = 'mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal';

const FONTS: Record<FontPreset, string> = {
  classic: 'Klasik — judul serif (Lora)',
  modern: 'Modern — semua sans-serif (DM Sans)',
  elegant: 'Elegan — judul Playfair Display',
  editorial: 'Editorial — judul Fraunces',
  friendly: 'Ramah — semua Nunito (membulat)',
  bold: 'Tegas — semua Space Grotesk',
};

/** Choices per layout option; the first is the original layout. */
const LAYOUT_CHOICES = {
  header: {
    label: 'Header',
    options: {
      classic: 'Klasik — logo di kiri, latar putih',
      centered: 'Logo di tengah',
      brand: 'Berwarna — latar warna utama',
    },
  },
  hero: {
    label: 'Banner beranda',
    options: {
      split: 'Terbelah — teks & foto berdampingan',
      banner: 'Foto penuh — teks di atas foto',
      simple: 'Sederhana — teks di tengah, tanpa foto',
    },
  },
  productCard: {
    label: 'Kartu produk',
    options: {
      classic: 'Klasik — kartu putih berbayang',
      framed: 'Berbingkai — garis tepi, teks di tengah',
      minimal: 'Minimal — tanpa kartu',
    },
  },
  corners: {
    label: 'Sudut tombol & kartu',
    options: {
      rounded: 'Membulat',
      soft: 'Sedikit membulat',
      sharp: 'Tajam (kotak)',
    },
  },
  background: {
    label: 'Latar halaman',
    options: {
      neutral: 'Abu lembut',
      white: 'Putih',
      warm: 'Krem hangat',
      tint: 'Sentuhan warna utama',
    },
  },
  footer: {
    label: 'Footer',
    options: { dark: 'Gelap (warna utama)', light: 'Terang (putih)' },
  },
} satisfies {
  [K in Exclude<
    keyof StoreLayout,
    'productColumns' | 'sections' | 'showTrustBar'
  >]: { label: string; options: Record<StoreLayout[K], string> };
};

const SECTION_LABELS: Record<HomeSection, string> = {
  catalog: 'Katalog produk',
  about: 'Tentang toko',
  reviews: 'Ulasan pelanggan',
  newsletter: 'Newsletter',
};

const slideImageUrl = (key: string) =>
  !key ? '' : key.startsWith('/') ? key : `/api/product-image/${key}`;

const IMAGES: { field: ImageField; label: string; hint: string }[] = [
  {
    field: 'logo',
    label: 'Logo',
    hint: 'Tampil di header. PNG/JPG/WebP, maks. 1 MB. Tanpa logo, nama toko yang tampil.',
  },
  {
    field: 'favicon',
    label: 'Ikon tab browser',
    hint: 'Persegi, mis. 64×64 px. Maks. 256 KB.',
  },
  { field: 'about', label: 'Foto bagian Tentang', hint: 'Maks. 3 MB.' },
  {
    field: 'share',
    label: 'Gambar saat dibagikan',
    hint: 'Tampil di WhatsApp/media sosial, ideal 1200×630 px. Maks. 2 MB.',
  },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      {children}
      {hint && (
        <span className="mt-1 block text-xs font-normal text-[#7b847c]">
          {hint}
        </span>
      )}
    </label>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      {note && <p className="mt-1 text-sm leading-6 text-[#68736b]">{note}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

async function fetchAppearance() {
  const response = await fetch('/api/admin/appearance', { cache: 'no-store' });
  const data = (await response.json()) as {
    appearance?: StoreAppearance;
    imageUrls?: Record<ImageField, string>;
    error?: string;
  };
  if (!response.ok || !data.appearance || !data.imageUrls)
    throw new Error(data.error || 'Tampilan gagal dimuat.');
  return { appearance: data.appearance, imageUrls: data.imageUrls };
}

async function send(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'Perubahan gagal disimpan.');
}

export function AppearanceManager() {
  const [look, setLook] = useState<StoreAppearance | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<ImageField, string> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  // Free-text editors for lists, kept as typed while the admin edits.
  const [catalogText, setCatalogText] = useState('');
  const [hiddenText, setHiddenText] = useState('');
  const [message, setMessage] = useState('');
  // Last saved version: uploads reload the page data, so they wait until edits are saved.
  const [saved, setSaved] = useState('');

  const load = useCallback(
    () =>
      fetchAppearance()
        .then((data) => {
          setLook(data.appearance);
          setSaved(JSON.stringify(data.appearance));
          setImageUrls(data.imageUrls);
          setCatalogText(
            data.appearance.content.catalogOrder
              .map(
                (entry) =>
                  `${entry.category}: ${entry.subcategories.join(', ')}`,
              )
              .join('\n'),
          );
          setHiddenText(data.appearance.content.hiddenSubcategories.join(', '));
        })
        .catch((error: Error) => setMessage(error.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!look || !imageUrls)
    return (
      <p className="text-sm text-[#68736b]">{message || 'Memuat tampilan…'}</p>
    );

  const dirty = JSON.stringify(look) !== saved;
  const theme = (patch: Partial<StoreAppearance['theme']>) =>
    setLook({ ...look, theme: { ...look.theme, ...patch } });
  const layout = (patch: Partial<StoreLayout>) =>
    setLook({ ...look, layout: { ...look.layout, ...patch } });
  const moveSection = (index: number, offset: number) => {
    const next = [...look.layout.sections];
    const [item] = next.splice(index, 1);
    next.splice(index + offset, 0, item);
    layout({ sections: next });
  };
  const content = (patch: Partial<StoreAppearance['content']>) =>
    setLook({ ...look, content: { ...look.content, ...patch } });
  const about = (patch: Partial<StoreAppearance['content']['about']>) =>
    content({ about: { ...look.content.about, ...patch } });
  const newsletter = (
    patch: Partial<StoreAppearance['content']['newsletter']>,
  ) => content({ newsletter: { ...look.content.newsletter, ...patch } });
  const seo = (patch: Partial<StoreAppearance['seo']>) =>
    setLook({ ...look, seo: { ...look.seo, ...patch } });
  const slides = look.content.heroSlides;
  const setSlide = (index: number, patch: Partial<HeroSlide>) =>
    content({
      heroSlides: slides.map((slide, i) =>
        i === index ? { ...slide, ...patch } : slide,
      ),
    });
  const moveSlide = (index: number, offset: number) => {
    const next = [...slides];
    const [item] = next.splice(index, 1);
    next.splice(index + offset, 0, item);
    content({ heroSlides: next });
  };

  async function run(
    action: () => Promise<void>,
    success: string,
    reload = true,
  ) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(success);
      if (reload) await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Koneksi terputus. Coba lagi.',
      );
    } finally {
      setBusy(false);
    }
  }

  const upload = (field: ImageField | 'slide', file: File, index?: number) => {
    const form = new FormData();
    form.set('field', field);
    if (index !== undefined) form.set('index', String(index));
    form.set('file', file);
    void run(
      () =>
        send('/api/admin/appearance/images', { method: 'POST', body: form }),
      'Gambar tersimpan.',
    );
  };
  const removeImage = (field: ImageField | 'slide', index?: number) =>
    void run(
      () =>
        send('/api/admin/appearance/images', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ field, index }),
        }),
      'Gambar dihapus.',
    );
  const save = () =>
    run(
      () =>
        send('/api/admin/appearance', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(look),
        }),
      'Tampilan tersimpan. Buka toko untuk melihat hasilnya.',
    );

  const primary = look.theme.primaryColor || DEFAULT_PRIMARY;
  const accent = look.theme.accentColor || DEFAULT_ACCENT;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
          Toko
        </p>
        <h2 className="mt-1 font-serif text-3xl">Tampilan toko</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736b]">
          Logo, warna, huruf, tata letak, dan isi beranda. Kombinasikan pilihan
          di sini agar toko punya tampilan sendiri.
        </p>
      </div>

      <Card title="Logo & gambar">
        {IMAGES.map(({ field, label, hint }) => (
          <div key={field} className="rounded-xl border p-3">
            <p className="text-sm font-semibold">{label}</p>
            <div className="mt-2 grid h-24 place-items-center overflow-hidden rounded-lg bg-[#f3f4f2]">
              {imageUrls[field] ? (
                // oxlint-disable-next-line nextjs/no-img-element -- preview of an uploaded image
                <img
                  src={imageUrls[field]}
                  alt={label}
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-[#7b847c]">Belum ada</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-semibold">
                Unggah
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload(field, file);
                    event.target.value = '';
                  }}
                />
              </label>
              {imageUrls[field] && (
                <button
                  type="button"
                  disabled={busy}
                  className="text-sm font-semibold text-red-700"
                  onClick={() => removeImage(field)}
                >
                  Hapus
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-[#7b847c]">{hint}</p>
          </div>
        ))}
      </Card>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Card
          title="Warna & huruf"
          note="Warna utama dipakai untuk tombol, bar atas, dan footer; aksen untuk tombol beli dan sorotan. Keduanya harus cukup gelap agar teks putih terbaca."
        >
          {(
            [
              ['primaryColor', 'Warna utama', primary],
              ['accentColor', 'Warna aksen', accent],
            ] as const
          ).map(([key, label, value]) => (
            <Field
              key={key}
              label={label}
              hint={look.theme[key] ? '' : 'Memakai warna bawaan.'}
            >
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  aria-label={label}
                  value={value}
                  onChange={(e) => theme({ [key]: e.target.value })}
                  className="h-10 w-14 rounded-lg border"
                />
                <input
                  className="w-28 rounded-xl border px-3 py-2 font-mono text-sm font-normal"
                  value={look.theme[key]}
                  placeholder={value}
                  onChange={(e) => theme({ [key]: e.target.value })}
                />
                {look.theme[key] && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#566158] underline"
                    onClick={() => theme({ [key]: '' })}
                  >
                    Kembalikan
                  </button>
                )}
              </div>
            </Field>
          ))}
          <Field label="Gaya huruf">
            <select
              className={input}
              value={look.theme.font}
              onChange={(e) => theme({ font: e.target.value as FontPreset })}
            >
              {(Object.keys(FONTS) as FontPreset[]).map((key) => (
                <option key={key} value={key}>
                  {FONTS[key]}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-xl border p-3" aria-label="Pratinjau warna">
            <div
              className="rounded-lg px-3 py-2 text-center text-xs font-semibold text-white"
              style={{ background: primary }}
            >
              {look.content.announcement || 'Bar pengumuman'}
            </div>
            <div className="mt-2 flex gap-2">
              <span
                className="flex-1 rounded-lg py-2 text-center text-sm font-bold text-white"
                style={{ background: accent }}
              >
                Beli langsung
              </span>
              <span
                className="flex-1 rounded-lg py-2 text-center text-sm font-bold text-white"
                style={{ background: primary }}
              >
                Daftar
              </span>
            </div>
          </div>
        </Card>

        <Card
          title="Tata letak"
          note="Susunan halaman toko. Pilihan pertama di tiap daftar adalah tata letak awal."
        >
          {(
            Object.entries(LAYOUT_CHOICES) as [
              keyof typeof LAYOUT_CHOICES,
              { label: string; options: Record<string, string> },
            ][]
          ).map(([key, { label, options }]) => (
            <Field key={key} label={label}>
              <select
                className={input}
                value={look.layout[key]}
                onChange={(e) => layout({ [key]: e.target.value })}
              >
                {Object.entries(options).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <Field label="Kolom produk (layar lebar)">
            <select
              className={input}
              value={look.layout.productColumns}
              onChange={(e) =>
                layout({ productColumns: e.target.value === '3' ? 3 : 4 })
              }
            >
              <option value="4">4 kolom</option>
              <option value="3">3 kolom (foto lebih besar)</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end text-sm font-semibold">
            <input
              type="checkbox"
              checked={look.layout.showTrustBar}
              onChange={(e) => layout({ showTrustBar: e.target.checked })}
            />
            Tampilkan 3 kotak info di bawah banner (pembayaran, pengiriman,
            produk)
          </label>
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold">Urutan bagian beranda</p>
            <p className="mt-1 text-xs text-[#7b847c]">
              Di bawah banner. Bagian Tentang, Ulasan, dan Newsletter bisa
              dimatikan di pengaturan masing-masing.
            </p>
            <ol className="mt-2 space-y-2">
              {look.layout.sections.map((section, index) => (
                <li
                  key={section}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
                >
                  <span>
                    {index + 1}. {SECTION_LABELS[section]}
                  </span>
                  <span className="flex gap-3 font-semibold">
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`Naikkan ${SECTION_LABELS[section]}`}
                      onClick={() => moveSection(index, -1)}
                      className="disabled:opacity-40"
                    >
                      ↑ Naik
                    </button>
                    <button
                      type="button"
                      disabled={index === look.layout.sections.length - 1}
                      aria-label={`Turunkan ${SECTION_LABELS[section]}`}
                      onClick={() => moveSection(index, 1)}
                      className="disabled:opacity-40"
                    >
                      ↓ Turun
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Card>

        <Card title="Bagian atas beranda">
          <div className="sm:col-span-2">
            <Field
              label="Petunjuk di kolom pencarian"
              hint="Contoh: Cari kaos, kemeja, baju chef..."
            >
              <input
                className={input}
                value={look.content.searchPlaceholder}
                onChange={(e) => content({ searchPlaceholder: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Pengumuman (bar paling atas)"
              hint="Kosongkan untuk menyembunyikan."
            >
              <input
                className={input}
                value={look.content.announcement}
                onChange={(e) => content({ announcement: e.target.value })}
              />
            </Field>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <p className="text-sm font-semibold">Slide ({slides.length}/6)</p>
            {slides.map((slide, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2"
              >
                <Field label="Label kecil">
                  <input
                    className={input}
                    value={slide.eyebrow}
                    onChange={(e) =>
                      setSlide(index, { eyebrow: e.target.value })
                    }
                  />
                </Field>
                <Field label="Judul">
                  <input
                    className={input}
                    required
                    value={slide.title}
                    onChange={(e) => setSlide(index, { title: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Teks">
                    <textarea
                      className={input}
                      rows={2}
                      value={slide.body}
                      onChange={(e) =>
                        setSlide(index, { body: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field
                  label="Kategori yang dibuka"
                  hint='Nama kategori produk, atau "Semua".'
                >
                  <input
                    className={input}
                    value={slide.category}
                    onChange={(e) =>
                      setSlide(index, { category: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tulisan tombol">
                  <input
                    className={input}
                    value={slide.label}
                    onChange={(e) => setSlide(index, { label: e.target.value })}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <div className="grid h-16 w-28 place-items-center overflow-hidden rounded-lg bg-[#f3f4f2]">
                    {slide.image ? (
                      // oxlint-disable-next-line nextjs/no-img-element -- preview of an uploaded banner
                      <img
                        src={slideImageUrl(slide.image)}
                        alt={`Banner slide ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-2 text-center text-[11px] text-[#7b847c]">
                        Foto produk
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">Gambar banner</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <label
                        className={`rounded-xl border px-3 py-1.5 font-semibold ${busy || dirty ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        Unggah
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={busy || dirty}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) upload('slide', file, index);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      {slide.image && (
                        <button
                          type="button"
                          disabled={busy || dirty}
                          className="font-semibold text-red-700 disabled:opacity-50"
                          onClick={() => removeImage('slide', index)}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#7b847c]">
                      {dirty
                        ? 'Simpan perubahan dulu sebelum mengunggah.'
                        : 'Opsional, ideal 1600×900 px, maks. 3 MB. Tanpa gambar, foto produk yang dipakai.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm font-semibold sm:col-span-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveSlide(index, -1)}
                    className="disabled:opacity-40"
                  >
                    ↑ Naik
                  </button>
                  <button
                    type="button"
                    disabled={index === slides.length - 1}
                    onClick={() => moveSlide(index, 1)}
                    className="disabled:opacity-40"
                  >
                    ↓ Turun
                  </button>
                  {slides.length > 1 && (
                    <button
                      type="button"
                      className="text-red-700"
                      onClick={() =>
                        content({
                          heroSlides: slides.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Hapus slide
                    </button>
                  )}
                </div>
              </div>
            ))}
            {slides.length < 6 && (
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm font-semibold"
                onClick={() =>
                  content({
                    heroSlides: [
                      ...slides,
                      {
                        eyebrow: '',
                        title: '',
                        body: '',
                        category: 'Semua',
                        label: 'Lihat koleksi',
                        image: '',
                      },
                    ],
                  })
                }
              >
                + Tambah slide
              </button>
            )}
          </div>
        </Card>

        <Card title="Bagian lain beranda">
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input
              type="checkbox"
              checked={look.content.about.enabled}
              onChange={(e) => about({ enabled: e.target.checked })}
            />
            Tampilkan bagian “Tentang”
          </label>
          {look.content.about.enabled && (
            <>
              <Field label="Label kecil">
                <input
                  className={input}
                  value={look.content.about.eyebrow}
                  onChange={(e) => about({ eyebrow: e.target.value })}
                />
              </Field>
              <Field label="Judul">
                <input
                  className={input}
                  value={look.content.about.title}
                  onChange={(e) => about({ title: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Isi">
                  <textarea
                    className={input}
                    rows={3}
                    value={look.content.about.body}
                    onChange={(e) => about({ body: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Keterangan foto (untuk pembaca layar)">
                <input
                  className={input}
                  value={look.content.about.imageAlt}
                  onChange={(e) => about({ imageAlt: e.target.value })}
                />
              </Field>
              <div className="space-y-2 sm:col-span-2">
                <p className="text-sm font-semibold">Keunggulan (maks. 3)</p>
                {look.content.about.highlights.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
                  >
                    <input
                      aria-label="Judul keunggulan"
                      className={input}
                      value={item.title}
                      onChange={(e) =>
                        about({
                          highlights: look.content.about.highlights.map(
                            (h, i) =>
                              i === index ? { ...h, title: e.target.value } : h,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label="Keterangan keunggulan"
                      className={input}
                      value={item.caption}
                      onChange={(e) =>
                        about({
                          highlights: look.content.about.highlights.map(
                            (h, i) =>
                              i === index
                                ? { ...h, caption: e.target.value }
                                : h,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-700"
                      onClick={() =>
                        about({
                          highlights: look.content.about.highlights.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                {look.content.about.highlights.length < 3 && (
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm font-semibold"
                    onClick={() =>
                      about({
                        highlights: [
                          ...look.content.about.highlights,
                          { title: '', caption: '' },
                        ],
                      })
                    }
                  >
                    + Tambah keunggulan
                  </button>
                )}
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <Field
              label="Kategori yang selalu tampil (satu per baris)"
              hint="Format: Kategori: Subkategori 1, Subkategori 2. Kategori lain muncul otomatis dari produk."
            >
              <textarea
                className={input}
                rows={3}
                value={catalogText}
                onChange={(e) => {
                  setCatalogText(e.target.value);
                  content({
                    catalogOrder: e.target.value
                      .split('\n')
                      .map((line) => {
                        const [category, subs = ''] = line.split(':');
                        return {
                          category: category.trim(),
                          subcategories: subs
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean),
                        };
                      })
                      .filter((entry) => entry.category),
                  });
                }}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Subkategori yang disembunyikan dari menu"
              hint="Pisahkan dengan koma."
            >
              <input
                className={input}
                value={hiddenText}
                onChange={(e) => {
                  setHiddenText(e.target.value);
                  content({
                    hiddenSubcategories: e.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  });
                }}
              />
            </Field>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-semibold">
              Tautan “Belanja” di footer (maks. 6; kosong = otomatis dari
              kategori)
            </p>
            {look.content.shopLinks.map((link, index) => (
              <div
                key={index}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                {(['label', 'category', 'subcategory'] as const).map((key) => (
                  <input
                    key={key}
                    aria-label={
                      key === 'label'
                        ? 'Nama tautan'
                        : key === 'category'
                          ? 'Kategori'
                          : 'Subkategori'
                    }
                    placeholder={
                      key === 'label'
                        ? 'Nama tautan'
                        : key === 'category'
                          ? 'Kategori'
                          : 'Subkategori (Semua)'
                    }
                    className={input}
                    value={link[key]}
                    onChange={(e) =>
                      content({
                        shopLinks: look.content.shopLinks.map((item, i) =>
                          i === index
                            ? { ...item, [key]: e.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                ))}
                <button
                  type="button"
                  className="text-sm font-semibold text-red-700"
                  onClick={() =>
                    content({
                      shopLinks: look.content.shopLinks.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  Hapus
                </button>
              </div>
            ))}
            {look.content.shopLinks.length < 6 && (
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm font-semibold"
                onClick={() =>
                  content({
                    shopLinks: [
                      ...look.content.shopLinks,
                      { label: '', category: 'Semua', subcategory: 'Semua' },
                    ],
                  })
                }
              >
                + Tambah tautan
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input
              type="checkbox"
              checked={look.content.showReviews}
              onChange={(e) => content({ showReviews: e.target.checked })}
            />
            Tampilkan ulasan pelanggan
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input
              type="checkbox"
              checked={look.content.newsletter.enabled}
              onChange={(e) => newsletter({ enabled: e.target.checked })}
            />
            Tampilkan formulir newsletter
          </label>
          {look.content.newsletter.enabled && (
            <>
              <Field label="Label kecil newsletter">
                <input
                  className={input}
                  value={look.content.newsletter.eyebrow}
                  onChange={(e) => newsletter({ eyebrow: e.target.value })}
                />
              </Field>
              <Field label="Judul newsletter">
                <input
                  className={input}
                  value={look.content.newsletter.title}
                  onChange={(e) => newsletter({ title: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Teks newsletter">
                  <input
                    className={input}
                    value={look.content.newsletter.body}
                    onChange={(e) => newsletter({ body: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label="Slogan di footer">
              <input
                className={input}
                value={look.content.tagline}
                onChange={(e) => content({ tagline: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Pencarian & berbagi (SEO)">
          <Field
            label="Judul halaman"
            hint="Tampil di tab browser dan hasil Google. Maks. 70 karakter."
          >
            <input
              className={input}
              maxLength={70}
              value={look.seo.title}
              onChange={(e) => seo({ title: e.target.value })}
            />
          </Field>
          <Field
            label="Deskripsi saat dibagikan"
            hint="Kosongkan untuk memakai deskripsi di bawah."
          >
            <input
              className={input}
              value={look.seo.shareDescription}
              onChange={(e) => seo({ shareDescription: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Deskripsi"
              hint="Ringkasan toko untuk Google. Maks. 200 karakter."
            >
              <textarea
                className={input}
                rows={2}
                maxLength={200}
                value={look.seo.description}
                onChange={(e) => seo({ description: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <button
          disabled={busy}
          className="rounded-xl bg-[#243b2c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Simpan tampilan
        </button>
      </form>
      {message && (
        <output className="block text-sm font-semibold text-[#566158]">
          {message}
        </output>
      )}
    </section>
  );
}
