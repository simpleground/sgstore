import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { adminCan, authorizeStore } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { encryptionConfigured } from '@/lib/secrets';
import {
  biteshipConfig,
  getStoreSettings,
  manualPaymentConfig,
  midtransConfig,
  saveStoreSettings,
  secretStatus,
  SettingsError,
  validateSettings,
  type StoreSettings,
} from '@/lib/store-settings';
import { clearStoreCache, DEFAULT_STORE_ID } from '@/lib/tenant';

/** Keys of StoreSettings that settings.manage may change (the rest: payments). */
const GENERAL_KEYS = [
  'whatsapp',
  'socialLinks',
  'checkoutNoticeTitle',
  'checkoutNotice',
  'recommendedPayment',
  'orderPrefix',
  'shippingOriginPostalCode',
] as const satisfies readonly (keyof StoreSettings)[];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const auth = await authorizeStore('settings.manage');
  if (!auth.ok) return auth.response;
  const { store } = auth.admin;
  const settings = await getStoreSettings(store.id);
  const secrets = await secretStatus(store.id);
  const shipping = await biteshipConfig(store.id, settings);
  const isDefault = store.id === DEFAULT_STORE_ID;
  return NextResponse.json(
    {
      store: {
        name: store.name,
        slug: store.slug,
        email: store.email,
        phone: store.phone,
        address: store.address,
      },
      settings,
      secrets,
      canManagePayments: adminCan(auth.admin, 'payments.manage'),
      encryptionConfigured: encryptionConfigured(),
      status: {
        midtrans: Boolean(await midtransConfig(store.id, settings)),
        manual: Boolean(manualPaymentConfig(settings)),
        shipping: Boolean(shipping.apiKey && shipping.originPostalCode),
        midtransFromEnv:
          isDefault &&
          !secrets.midtrans_server_key.set &&
          Boolean(process.env.MIDTRANS_SERVER_KEY),
        biteshipFromEnv:
          !secrets.biteship_api_key.set &&
          Boolean(process.env.BITESHIP_API_KEY),
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

/** Store profile and general settings (not payments). */
export async function PATCH(request: Request) {
  const auth = await authorizeStore('settings.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const body = (await request.json().catch(() => ({}))) as {
    store?: {
      name?: unknown;
      email?: unknown;
      phone?: unknown;
      address?: unknown;
    };
    settings?: Record<string, unknown>;
  };
  try {
    const changed: string[] = [];
    if (body.store) {
      const text = (value: unknown) =>
        typeof value === 'string' ? value.trim() : '';
      const profile = {
        name: text(body.store.name),
        email: text(body.store.email).toLowerCase(),
        phone: text(body.store.phone),
        address: text(body.store.address),
      };
      if (profile.name.length < 2 || profile.name.length > 80)
        throw new SettingsError('Nama toko 2–80 karakter.');
      if (
        profile.email &&
        (!emailPattern.test(profile.email) || profile.email.length > 254)
      )
        throw new SettingsError('Email toko tidak valid.');
      if (profile.phone.length > 30)
        throw new SettingsError('Telepon maksimal 30 karakter.');
      if (profile.address.length > 500)
        throw new SettingsError('Alamat maksimal 500 karakter.');
      for (const key of ['name', 'email', 'phone', 'address'] as const)
        if (profile[key] !== admin.store[key]) changed.push(`store.${key}`);
      await getD1()
        .prepare(
          'UPDATE stores SET name=?,email=?,phone=?,address=?,updated_at=? WHERE id=?',
        )
        .bind(
          profile.name,
          profile.email,
          profile.phone,
          profile.address,
          new Date().toISOString(),
          admin.store.id,
        )
        .run();
      clearStoreCache();
    }
    if (body.settings) {
      const current = await getStoreSettings(admin.store.id);
      const next = { ...current } as Record<string, unknown>;
      for (const key of GENERAL_KEYS)
        if (key in body.settings) next[key] = body.settings[key];
      const settings = validateSettings(next);
      for (const key of GENERAL_KEYS)
        if (JSON.stringify(settings[key]) !== JSON.stringify(current[key]))
          changed.push(key);
      await saveStoreSettings(admin.store.id, settings);
    }
    if (changed.length)
      await audit(admin, {
        storeId: admin.store.id,
        action: 'settings.update',
        meta: { fields: changed.join(', ') },
      });
    return NextResponse.json({ ok: true, changed });
  } catch (error) {
    if (error instanceof SettingsError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
