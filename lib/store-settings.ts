/**
 * Pengaturan & integrasi per toko (tabel store_settings dan store_secrets).
 *
 * - Pengaturan biasa (kontak, rekening transfer, catatan checkout, dll.)
 *   disimpan sebagai JSON dan boleh ditampilkan ke pembeli.
 * - Kunci rahasia (server key Midtrans, API key Biteship) disimpan terenkripsi
 *   (lib/secrets.ts) dan tidak pernah dikirim ke browser.
 *
 * Kompatibilitas: kunci Midtrans di .env hanya berlaku untuk toko bawaan
 * (supaya pembayaran toko lain tidak masuk ke akun Midtrans pemilik platform).
 * API key Biteship di .env boleh dipakai semua toko (hanya untuk cek tarif).
 */
import { getD1 } from '@/db';
import { decryptSecret, encryptSecret } from '@/lib/secrets';
import { DEFAULT_STORE_ID, type Store } from '@/lib/tenant';

export type SocialLink = { label: string; url: string };
export type PaymentMethod = 'manual' | 'midtrans';

export type StoreSettings = {
  /** Nomor WhatsApp format internasional tanpa +, mis. 6281234567890. */
  whatsapp: string;
  socialLinks: SocialLink[];
  checkoutNoticeTitle: string;
  checkoutNotice: string;
  recommendedPayment: PaymentMethod | '';
  /** Awalan nomor pesanan, mis. SG → SG-XXXX. */
  orderPrefix: string;
  /** Kode pos gudang asal pengiriman. */
  shippingOriginPostalCode: string;
  manualPayment: {
    enabled: boolean;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  midtrans: {
    enabled: boolean;
    clientKey: string;
    /** null = ikuti MIDTRANS_IS_PRODUCTION (toko bawaan) / sandbox (toko lain). */
    production: boolean | null;
  };
};

export const SECRET_NAMES = [
  'midtrans_server_key',
  'biteship_api_key',
] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

const DEFAULTS: StoreSettings = {
  whatsapp: '',
  socialLinks: [],
  checkoutNoticeTitle: '',
  checkoutNotice: '',
  recommendedPayment: '',
  orderPrefix: '',
  shippingOriginPostalCode: '',
  manualPayment: {
    enabled: false,
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  },
  midtrans: { enabled: true, clientKey: '', production: null },
};

/** Input admin yang tidak valid; pesannya aman ditampilkan. */
export class SettingsError extends Error {}

const isDefaultStore = (storeId: string) => storeId === DEFAULT_STORE_ID;
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const obj = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// ---- Validation ------------------------------------------------------------

function limit(value: string, max: number, label: string) {
  if (value.length > max)
    throw new SettingsError(`${label} maksimal ${max} karakter.`);
  return value;
}

/** 0812… / +62 812… / 62812… → 62812…; kosong boleh. */
export function normalizeWhatsapp(value: unknown) {
  const raw = str(value);
  if (!raw) return '';
  let digits = raw.replace(/[\s().+-]/g, '');
  if (!/^\d+$/.test(digits))
    throw new SettingsError('Nomor WhatsApp hanya boleh berisi angka.');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.length < 9 || digits.length > 15)
    throw new SettingsError('Nomor WhatsApp tidak valid.');
  return digits;
}

function httpUrl(value: unknown, label: string) {
  const url = limit(str(value), 300, label);
  if (!url) return '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SettingsError(
      `${label} harus berupa alamat web lengkap (https://…).`,
    );
  }
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new SettingsError(`${label} harus diawali http:// atau https://.`);
  return url;
}

/**
 * Validate a complete settings object from the admin panel. Throws
 * SettingsError with a message for the first invalid field.
 */
export function validateSettings(input: unknown): StoreSettings {
  const source = obj(input);
  const links = Array.isArray(source.socialLinks) ? source.socialLinks : [];
  if (links.length > 10)
    throw new SettingsError('Maksimal 10 tautan media sosial.');
  const socialLinks = links
    .map((link) => ({
      label: limit(str(obj(link).label), 30, 'Nama tautan'),
      url: httpUrl(
        obj(link).url,
        `Tautan ${str(obj(link).label) || 'media sosial'}`,
      ),
    }))
    .filter((link) => link.label || link.url);
  if (socialLinks.some((link) => !link.label || !link.url))
    throw new SettingsError(
      'Setiap tautan media sosial perlu nama dan alamat.',
    );

  const recommended = str(source.recommendedPayment);
  if (recommended && recommended !== 'manual' && recommended !== 'midtrans')
    throw new SettingsError(
      'Metode pembayaran yang direkomendasikan tidak valid.',
    );

  const orderPrefix = str(source.orderPrefix).toUpperCase();
  if (!/^[A-Z0-9]{0,6}$/.test(orderPrefix))
    throw new SettingsError(
      'Awalan nomor pesanan: 1–6 huruf/angka, tanpa spasi.',
    );

  const postal = str(source.shippingOriginPostalCode);
  if (postal && !/^\d{5}$/.test(postal))
    throw new SettingsError('Kode pos asal pengiriman harus 5 angka.');

  const manual = obj(source.manualPayment);
  const manualPayment = {
    enabled: manual.enabled === true,
    bankName: limit(str(manual.bankName), 60, 'Nama bank'),
    accountNumber: limit(str(manual.accountNumber), 30, 'Nomor rekening'),
    accountHolder: limit(
      str(manual.accountHolder),
      80,
      'Nama pemilik rekening',
    ),
  };
  if (
    manualPayment.accountNumber &&
    !/^\d[\d .-]{3,29}$/.test(manualPayment.accountNumber)
  )
    throw new SettingsError('Nomor rekening hanya boleh berisi angka.');
  if (
    manualPayment.enabled &&
    (!manualPayment.bankName ||
      !manualPayment.accountNumber ||
      !manualPayment.accountHolder)
  )
    throw new SettingsError(
      'Lengkapi nama bank, nomor rekening, dan nama pemilik rekening.',
    );

  const midtrans = obj(source.midtrans);
  const clientKey = str(midtrans.clientKey);
  if (!/^[\w.:-]{0,120}$/.test(clientKey))
    throw new SettingsError('Client key Midtrans tidak valid.');
  const production = midtrans.production;
  if (
    production !== undefined &&
    production !== null &&
    typeof production !== 'boolean'
  )
    throw new SettingsError('Mode Midtrans tidak valid.');

  return {
    whatsapp: normalizeWhatsapp(source.whatsapp),
    socialLinks,
    checkoutNoticeTitle: limit(
      str(source.checkoutNoticeTitle),
      120,
      'Judul catatan checkout',
    ),
    checkoutNotice: limit(str(source.checkoutNotice), 600, 'Catatan checkout'),
    recommendedPayment: recommended as StoreSettings['recommendedPayment'],
    orderPrefix,
    shippingOriginPostalCode: postal,
    manualPayment,
    midtrans: {
      enabled: midtrans.enabled !== false,
      clientKey,
      production: typeof production === 'boolean' ? production : null,
    },
  };
}

/** Stored JSON → settings; invalid parts fall back to defaults instead of failing. */
function readSettings(json: string | null | undefined): StoreSettings {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = obj(JSON.parse(json || '{}'));
  } catch {}
  const merged = {
    ...DEFAULTS,
    ...parsed,
    manualPayment: { ...DEFAULTS.manualPayment, ...obj(parsed.manualPayment) },
    midtrans: { ...DEFAULTS.midtrans, ...obj(parsed.midtrans) },
  };
  try {
    return validateSettings(merged);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

// ---- Storage ---------------------------------------------------------------

export async function getStoreSettings(storeId: string) {
  const json = await getD1()
    .prepare('SELECT settings_json FROM store_settings WHERE store_id=?')
    .bind(storeId)
    .first<string>('settings_json');
  return readSettings(json);
}

export async function saveStoreSettings(
  storeId: string,
  settings: StoreSettings,
) {
  await getD1()
    .prepare(
      'INSERT INTO store_settings (store_id,settings_json,updated_at) VALUES (?,?,?) ON CONFLICT (store_id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=excluded.updated_at',
    )
    .bind(storeId, JSON.stringify(settings), new Date().toISOString())
    .run();
}

async function getSecret(storeId: string, name: SecretName) {
  const stored = await getD1()
    .prepare(
      'SELECT value_encrypted FROM store_secrets WHERE store_id=? AND name=?',
    )
    .bind(storeId, name)
    .first<string>('value_encrypted');
  if (!stored) return null;
  try {
    return await decryptSecret(storeId, name, stored);
  } catch {
    return null;
  }
}

/** Save (value) or remove (null) a secret. */
export async function setSecret(
  storeId: string,
  name: SecretName,
  value: string | null,
) {
  if (value === null) {
    await getD1()
      .prepare('DELETE FROM store_secrets WHERE store_id=? AND name=?')
      .bind(storeId, name)
      .run();
    return;
  }
  await getD1()
    .prepare(
      'INSERT INTO store_secrets (store_id,name,value_encrypted,hint,updated_at) VALUES (?,?,?,?,?) ON CONFLICT (store_id,name) DO UPDATE SET value_encrypted=excluded.value_encrypted,hint=excluded.hint,updated_at=excluded.updated_at',
    )
    .bind(
      storeId,
      name,
      await encryptSecret(storeId, name, value),
      value.slice(-4),
      new Date().toISOString(),
    )
    .run();
}

/** What the admin panel may know about secrets: whether set, and last 4 chars. */
export async function secretStatus(storeId: string) {
  const { results } = await getD1()
    .prepare(
      'SELECT name,hint,updated_at AS "updatedAt" FROM store_secrets WHERE store_id=?',
    )
    .bind(storeId)
    .all<{ name: SecretName; hint: string; updatedAt: string }>();
  return Object.fromEntries(
    SECRET_NAMES.map((name) => {
      const row = results.find((item) => item.name === name);
      return [
        name,
        {
          set: Boolean(row),
          hint: row?.hint ?? '',
          updatedAt: row?.updatedAt ?? '',
        },
      ];
    }),
  ) as Record<SecretName, { set: boolean; hint: string; updatedAt: string }>;
}

// ---- Effective configuration -------------------------------------------------

/** Server key used to verify Midtrans notifications (even when new payments are off). */
export async function midtransServerKey(storeId: string) {
  return (
    (await getSecret(storeId, 'midtrans_server_key')) ??
    (isDefaultStore(storeId) ? process.env.MIDTRANS_SERVER_KEY || null : null)
  );
}

/** Midtrans for new payments, or null when disabled or not configured. */
export async function midtransConfig(storeId: string, settings: StoreSettings) {
  if (!settings.midtrans.enabled) return null;
  const serverKey = await midtransServerKey(storeId);
  const clientKey =
    settings.midtrans.clientKey ||
    (isDefaultStore(storeId) ? process.env.MIDTRANS_CLIENT_KEY || '' : '');
  if (!serverKey || !clientKey) return null;
  const production =
    settings.midtrans.production ??
    (isDefaultStore(storeId)
      ? process.env.MIDTRANS_IS_PRODUCTION !== 'false'
      : false);
  return { serverKey, clientKey, production };
}

export function manualPaymentConfig(settings: StoreSettings) {
  const { enabled, bankName, accountNumber, accountHolder } =
    settings.manualPayment;
  return enabled && bankName && accountNumber && accountHolder
    ? { bankName, accountNumber, accountHolder }
    : null;
}

export async function biteshipConfig(storeId: string, settings: StoreSettings) {
  return {
    apiKey:
      (await getSecret(storeId, 'biteship_api_key')) ??
      (process.env.BITESHIP_API_KEY || null),
    originPostalCode:
      settings.shippingOriginPostalCode ||
      (isDefaultStore(storeId)
        ? process.env.BITESHIP_ORIGIN_POSTAL_CODE || '44163'
        : ''),
  };
}

export function orderPrefix(
  store: Pick<Store, 'id' | 'slug'>,
  settings: StoreSettings,
) {
  if (settings.orderPrefix) return settings.orderPrefix;
  if (isDefaultStore(store.id)) return 'SG';
  return (
    store.slug
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'ORD'
  );
}

// ---- Public (storefront) configuration --------------------------------------

export type PublicStoreConfig = {
  name: string;
  email: string;
  phone: string;
  address: string;
  whatsapp: string;
  socialLinks: SocialLink[];
  checkoutNoticeTitle: string;
  checkoutNotice: string;
  payments: {
    manual: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    } | null;
    midtrans: boolean;
    recommended: PaymentMethod | null;
  };
};

export async function getPublicStoreConfig(
  store: Store,
): Promise<PublicStoreConfig> {
  const settings = await getStoreSettings(store.id);
  const manual = manualPaymentConfig(settings);
  const midtrans = Boolean(await midtransConfig(store.id, settings));
  const available: PaymentMethod[] = [
    ...(midtrans ? (['midtrans'] as const) : []),
    ...(manual ? (['manual'] as const) : []),
  ];
  const recommended =
    settings.recommendedPayment &&
    available.includes(settings.recommendedPayment)
      ? settings.recommendedPayment
      : (available[0] ?? null);
  return {
    name: store.name,
    email: store.email,
    phone: store.phone,
    address: store.address,
    whatsapp: settings.whatsapp,
    socialLinks: settings.socialLinks,
    checkoutNoticeTitle: settings.checkoutNoticeTitle,
    checkoutNotice: settings.checkoutNotice,
    payments: { manual, midtrans, recommended },
  };
}
