/**
 * Tampilan per toko: tema (warna, font, logo, favicon), konten beranda, SEO.
 * Disimpan di store_settings.appearance_json. Satu kode storefront untuk semua
 * toko; yang berbeda hanya konfigurasi ini.
 *
 * Gambar (logo, favicon, foto "Tentang", gambar bagikan) diunggah lewat
 * /api/admin/settings/branding dan disimpan sebagai kunci storage milik toko
 * (stores/<id>/branding/…). Aset bawaan Simple Ground berupa path publik (/…).
 */
import { getD1 } from '@/db';
import { storeOwnsFileKey } from '@/lib/tenant';

export type HeroSlide = {
  eyebrow: string;
  title: string;
  body: string;
  /** Kategori yang dibuka tombol slide ("Semua" = seluruh katalog). */
  category: string;
  label: string;
  /**
   * Uploaded banner image (storage key, '' = a product photo). Set only
   * through the image upload endpoint; it moves with the slide.
   */
  image: string;
};
export type Highlight = { title: string; caption: string };
/** Kategori yang selalu tampil di menu, dengan subkategori yang disarankan. */
export type CatalogEntry = { category: string; subcategories: string[] };
/** Tautan kolom "Belanja" di footer. */
export type ShopLink = { label: string; category: string; subcategory: string };
export const FONT_PRESETS = [
  'classic',
  'modern',
  'elegant',
  'editorial',
  'friendly',
  'bold',
] as const;
export type FontPreset = (typeof FONT_PRESETS)[number];
export const MAX_SLIDES = 6;
export const IMAGE_FIELDS = ['logo', 'favicon', 'about', 'share'] as const;
export type ImageField = (typeof IMAGE_FIELDS)[number];

/**
 * Layout choices for the storefront. The first option of each list is the
 * original Simple Ground layout (the default).
 */
export const LAYOUT_OPTIONS = {
  header: ['classic', 'centered', 'brand'],
  hero: ['split', 'banner', 'simple'],
  productCard: ['classic', 'framed', 'minimal'],
  corners: ['rounded', 'soft', 'sharp'],
  background: ['neutral', 'white', 'warm', 'tint'],
  footer: ['dark', 'light'],
} as const;
type LayoutChoice = {
  [K in keyof typeof LAYOUT_OPTIONS]: (typeof LAYOUT_OPTIONS)[K][number];
};
export const HOME_SECTIONS = [
  'catalog',
  'about',
  'reviews',
  'newsletter',
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];
export type StoreLayout = LayoutChoice & {
  productColumns: 3 | 4;
  /** Order of the homepage sections below the banner. */
  sections: HomeSection[];
  /** The three small boxes (payment, shipping, products) under the banner. */
  showTrustBar: boolean;
};

export function defaultLayout(): StoreLayout {
  return {
    header: 'classic',
    hero: 'split',
    productCard: 'classic',
    corners: 'rounded',
    background: 'neutral',
    footer: 'dark',
    productColumns: 4,
    sections: [...HOME_SECTIONS],
    showTrustBar: true,
  };
}

export type StoreAppearance = {
  theme: {
    /** '' = warna bawaan. Harus cukup gelap untuk teks putih. */
    primaryColor: string;
    accentColor: string;
    font: FontPreset;
  };
  layout: StoreLayout;
  content: {
    announcement: string;
    searchPlaceholder: string;
    tagline: string;
    heroSlides: HeroSlide[];
    about: {
      enabled: boolean;
      eyebrow: string;
      title: string;
      body: string;
      imageAlt: string;
      highlights: Highlight[];
    };
    showReviews: boolean;
    catalogOrder: CatalogEntry[];
    hiddenSubcategories: string[];
    shopLinks: ShopLink[];
    newsletter: {
      enabled: boolean;
      eyebrow: string;
      title: string;
      body: string;
    };
  };
  seo: { title: string; description: string; shareDescription: string };
  /** Storage keys (or public paths); changed only through the upload endpoint. */
  images: Record<ImageField, string>;
};

export class AppearanceError extends Error {}

export function defaultAppearance(storeName: string): StoreAppearance {
  return {
    theme: { primaryColor: '', accentColor: '', font: 'classic' },
    layout: defaultLayout(),
    content: {
      announcement: '',
      searchPlaceholder: 'Cari produk...',
      tagline: '',
      heroSlides: [
        {
          eyebrow: storeName.toUpperCase(),
          title: `Selamat datang di ${storeName}.`,
          body: 'Jelajahi koleksi kami dan temukan produk yang paling sesuai untukmu.',
          category: 'Semua',
          label: 'Semua koleksi',
          image: '',
        },
      ],
      about: {
        enabled: false,
        eyebrow: '',
        title: '',
        body: '',
        imageAlt: '',
        highlights: [],
      },
      showReviews: true,
      catalogOrder: [],
      hiddenSubcategories: [],
      shopLinks: [],
      newsletter: {
        enabled: true,
        eyebrow: 'Kabar terbaru',
        title: 'Koleksi baru dan penawaran khusus.',
        body: 'Daftarkan email untuk menerima kabar dari kami.',
      },
    },
    seo: {
      title: storeName,
      description: `Belanja online di ${storeName}.`,
      shareDescription: '',
    },
    images: { logo: '', favicon: '', about: '', share: '' },
  };
}

// ---- Validation ------------------------------------------------------------

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const obj = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const list = (value: unknown) => (Array.isArray(value) ? value : []);
function limited(value: unknown, max: number, label: string) {
  const items = list(value);
  if (items.length > max)
    throw new AppearanceError(`Maksimal ${max} ${label}.`);
  return items;
}

function text(value: unknown, max: number, label: string) {
  const result = str(value);
  if (result.length > max)
    throw new AppearanceError(`${label} maksimal ${max} karakter.`);
  return result;
}

/** Relative luminance (WCAG) of #rrggbb. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** '' or a colour dark enough for white text (contrast ≥ 3:1). */
function color(value: unknown, label: string) {
  const hex = str(value).toLowerCase();
  if (!hex) return '';
  if (!/^#[0-9a-f]{6}$/.test(hex))
    throw new AppearanceError(
      `${label} harus berupa kode warna, mis. #1f4d3a.`,
    );
  if (1.05 / (luminance(hex) + 0.05) < 3)
    throw new AppearanceError(
      `${label} terlalu terang: teks putih di atasnya sulit dibaca. Pilih warna yang lebih gelap.`,
    );
  return hex;
}

function choice<T extends string>(value: unknown, options: readonly T[]): T {
  return options.includes(value as T) ? (value as T) : options[0];
}

function validateLayout(input: unknown): StoreLayout {
  const source = obj(input);
  const picked = Object.fromEntries(
    Object.entries(LAYOUT_OPTIONS).map(([key, options]) => [
      key,
      choice(source[key], options),
    ]),
  ) as LayoutChoice;
  const sections = [
    ...new Set(
      list(source.sections).filter((item): item is HomeSection =>
        (HOME_SECTIONS as readonly string[]).includes(item as string),
      ),
    ),
  ];
  return {
    ...picked,
    productColumns: source.productColumns === 3 ? 3 : 4,
    // Sections left out keep their default position at the end.
    sections: [
      ...sections,
      ...HOME_SECTIONS.filter((item) => !sections.includes(item)),
    ],
    showTrustBar: source.showTrustBar !== false,
  };
}

/**
 * Validate appearance from the admin panel. Images always come from `current`;
 * a slide may only keep a banner image that one of the current slides has
 * (slides can be reordered, but images cannot be pointed at other files).
 */
export function validateAppearance(
  input: unknown,
  current: StoreAppearance,
  slideImages = new Set(
    current.content.heroSlides.map((slide) => slide.image).filter(Boolean),
  ),
): StoreAppearance {
  const source = obj(input);
  const theme = obj(source.theme);
  const content = obj(source.content);
  const about = obj(content.about);
  const newsletter = obj(content.newsletter);
  const seo = obj(source.seo);

  const slides = list(content.heroSlides);
  if (!slides.length || slides.length > MAX_SLIDES)
    throw new AppearanceError(
      `Isi 1–${MAX_SLIDES} slide di bagian atas beranda.`,
    );
  const heroSlides = slides.map((raw, index) => {
    const slide = obj(raw);
    const result = {
      eyebrow: text(slide.eyebrow, 60, `Label kecil slide ${index + 1}`),
      title: text(slide.title, 120, `Judul slide ${index + 1}`),
      body: text(slide.body, 300, `Teks slide ${index + 1}`),
      category:
        text(slide.category, 60, `Kategori slide ${index + 1}`) || 'Semua',
      label: text(slide.label, 40, `Tombol slide ${index + 1}`),
      image: slideImages.has(str(slide.image)) ? str(slide.image) : '',
    };
    if (!result.title)
      throw new AppearanceError(`Judul slide ${index + 1} wajib diisi.`);
    return result;
  });

  const highlights = list(about.highlights);
  if (highlights.length > 3)
    throw new AppearanceError('Maksimal 3 keunggulan.');

  const font = choice(str(theme.font), FONT_PRESETS);
  const result: StoreAppearance = {
    theme: {
      primaryColor: color(theme.primaryColor, 'Warna utama'),
      accentColor: color(theme.accentColor, 'Warna aksen'),
      font,
    },
    layout: validateLayout(source.layout),
    content: {
      announcement: text(content.announcement, 140, 'Pengumuman'),
      searchPlaceholder:
        text(content.searchPlaceholder, 80, 'Petunjuk kolom pencarian') ||
        'Cari produk...',
      tagline: text(content.tagline, 200, 'Slogan'),
      heroSlides,
      about: {
        enabled: about.enabled === true,
        eyebrow: text(about.eyebrow, 60, 'Label bagian Tentang'),
        title: text(about.title, 120, 'Judul bagian Tentang'),
        body: text(about.body, 1200, 'Isi bagian Tentang'),
        imageAlt: text(about.imageAlt, 160, 'Keterangan foto'),
        highlights: highlights
          .map((raw) => ({
            title: text(obj(raw).title, 30, 'Judul keunggulan'),
            caption: text(obj(raw).caption, 60, 'Keterangan keunggulan'),
          }))
          .filter((item) => item.title || item.caption),
      },
      showReviews: content.showReviews !== false,
      catalogOrder: limited(content.catalogOrder, 12, 'kategori tetap')
        .map((raw) => ({
          category: text(obj(raw).category, 60, 'Nama kategori'),
          subcategories: limited(obj(raw).subcategories, 20, 'subkategori')
            .map((item) => text(item, 60, 'Nama subkategori'))
            .filter(Boolean),
        }))
        .filter((entry) => entry.category),
      hiddenSubcategories: limited(
        content.hiddenSubcategories,
        20,
        'subkategori tersembunyi',
      )
        .map((item) => text(item, 60, 'Nama subkategori'))
        .filter(Boolean),
      shopLinks: limited(content.shopLinks, 6, 'tautan Belanja').map((raw) => {
        const link = obj(raw);
        const label = text(link.label, 40, 'Nama tautan Belanja');
        if (!label)
          throw new AppearanceError('Setiap tautan Belanja perlu nama.');
        return {
          label,
          category: text(link.category, 60, 'Kategori tautan') || 'Semua',
          subcategory:
            text(link.subcategory, 60, 'Subkategori tautan') || 'Semua',
        };
      }),
      newsletter: {
        enabled: newsletter.enabled !== false,
        eyebrow: text(newsletter.eyebrow, 60, 'Label newsletter'),
        title: text(newsletter.title, 120, 'Judul newsletter'),
        body: text(newsletter.body, 300, 'Teks newsletter'),
      },
    },
    seo: {
      title: text(seo.title, 70, 'Judul SEO'),
      description: text(seo.description, 200, 'Deskripsi SEO'),
      shareDescription: text(
        seo.shareDescription,
        200,
        'Deskripsi saat dibagikan',
      ),
    },
    images: current.images,
  };
  if (result.content.about.enabled && !result.content.about.title)
    throw new AppearanceError(
      'Isi judul bagian Tentang, atau matikan bagian tersebut.',
    );
  return result;
}

const PUBLIC_ASSET = /^\/[\w\-./]+\.(png|jpe?g|webp|svg|ico)$/;

/** Keep only image references this store may use. */
function safeImages(storeId: string, value: unknown) {
  const source = obj(value);
  return Object.fromEntries(
    IMAGE_FIELDS.map((field) => {
      const key = str(source[field]);
      const ok =
        PUBLIC_ASSET.test(key) || (key && storeOwnsFileKey(storeId, key));
      return [field, ok ? key : ''];
    }),
  ) as Record<ImageField, string>;
}

/** Stored JSON → appearance, falling back to defaults for anything invalid. */
export function readAppearance(
  storeId: string,
  storeName: string,
  json: string | null,
) {
  const defaults = defaultAppearance(storeName);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = obj(JSON.parse(json || '{}'));
  } catch {}
  const images = safeImages(storeId, parsed.images);
  const merged = {
    theme: { ...defaults.theme, ...obj(parsed.theme) },
    layout: { ...defaults.layout, ...obj(parsed.layout) },
    content: {
      ...defaults.content,
      ...obj(parsed.content),
      about: { ...defaults.content.about, ...obj(obj(parsed.content).about) },
      newsletter: {
        ...defaults.content.newsletter,
        ...obj(obj(parsed.content).newsletter),
      },
    },
    seo: { ...defaults.seo, ...obj(parsed.seo) },
  };
  // Stored banner images: only this store's own uploads.
  const slideImages = new Set(
    list(obj(parsed.content).heroSlides)
      .map((slide) => str(obj(slide).image))
      .filter((key) => key.startsWith(`stores/${storeId}/branding/`)),
  );
  try {
    return validateAppearance(merged, { ...defaults, images }, slideImages);
  } catch {
    return { ...defaults, images };
  }
}

// ---- Storage ---------------------------------------------------------------

export async function getStoreAppearance(store: { id: string; name: string }) {
  const json = await getD1()
    .prepare('SELECT appearance_json FROM store_settings WHERE store_id=?')
    .bind(store.id)
    .first<string>('appearance_json');
  return readAppearance(store.id, store.name, json);
}

export async function saveStoreAppearance(
  storeId: string,
  appearance: StoreAppearance,
) {
  await getD1()
    .prepare(
      `INSERT INTO store_settings (store_id,appearance_json,updated_at) VALUES (?,?,?)
       ON CONFLICT (store_id) DO UPDATE SET appearance_json=excluded.appearance_json,updated_at=excluded.updated_at`,
    )
    .bind(storeId, JSON.stringify(appearance), new Date().toISOString())
    .run();
}

/** URL for an image reference ('' when none). */
export function imageUrl(key: string) {
  if (!key) return '';
  return key.startsWith('/') ? key : `/api/product-image/${key}`;
}

/** What the storefront needs (image references resolved to URLs). */
export function publicAppearance(appearance: StoreAppearance) {
  return {
    theme: appearance.theme,
    layout: appearance.layout,
    content: appearance.content,
    logoUrl: imageUrl(appearance.images.logo),
    /** Uploaded banner image per slide ('' = use a product photo). */
    slideImageUrls: appearance.content.heroSlides.map((slide) =>
      imageUrl(slide.image),
    ),
    aboutImageUrl: imageUrl(appearance.images.about),
  };
}
export type PublicAppearance = ReturnType<typeof publicAppearance>;
