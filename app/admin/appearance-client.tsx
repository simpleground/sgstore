'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  HeroSlide,
  ImageField,
  StoreAppearance,
} from '@/lib/store-appearance';

const DEFAULT_PRIMARY = '#173c2b';
const DEFAULT_ACCENT = '#c0693c';
const input = 'mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal';

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
  const [message, setMessage] = useState('');

  const load = useCallback(
    () =>
      fetchAppearance()
        .then((data) => {
          setLook(data.appearance);
          setImageUrls(data.imageUrls);
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

  const theme = (patch: Partial<StoreAppearance['theme']>) =>
    setLook({ ...look, theme: { ...look.theme, ...patch } });
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

  const upload = (field: ImageField, file: File) => {
    const form = new FormData();
    form.set('field', field);
    form.set('file', file);
    void run(
      () =>
        send('/api/admin/appearance/images', { method: 'POST', body: form }),
      'Gambar tersimpan.',
    );
  };
  const removeImage = (field: ImageField) =>
    void run(
      () =>
        send('/api/admin/appearance/images', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ field }),
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
          Logo, warna, dan isi beranda. Semua toko memakai tata letak yang sama;
          yang berbeda hanya pengaturan di sini.
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
          <Field label="Gaya huruf judul">
            <select
              className={input}
              value={look.theme.font}
              onChange={(e) =>
                theme({
                  font: e.target.value === 'modern' ? 'modern' : 'classic',
                })
              }
            >
              <option value="classic">Klasik (serif)</option>
              <option value="modern">Modern (sans-serif)</option>
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
