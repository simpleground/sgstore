import { NextResponse } from 'next/server';
import { authorizeStore } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { encryptionConfigured } from '@/lib/secrets';
import {
  getStoreSettings,
  SECRET_NAMES,
  saveStoreSettings,
  setSecret,
  SettingsError,
  validateSettings,
  type SecretName,
} from '@/lib/store-settings';

/**
 * Payment settings and integration keys (store owner only).
 * Body: { manualPayment?, midtrans?, secrets?: { midtrans_server_key?: string | null,
 * biteship_api_key?: string | null } } — a secret set to null is removed; a
 * secret that is left out keeps its value. Secrets are never sent back.
 */
export async function PATCH(request: Request) {
  const auth = await authorizeStore('payments.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const storeId = admin.store.id;
  const body = (await request.json().catch(() => ({}))) as {
    manualPayment?: unknown;
    midtrans?: unknown;
    secrets?: Partial<Record<string, unknown>>;
  };
  try {
    const secrets: [SecretName, string | null][] = [];
    for (const [name, value] of Object.entries(body.secrets ?? {})) {
      if (!(SECRET_NAMES as readonly string[]).includes(name))
        throw new SettingsError('Nama kunci tidak dikenal.');
      if (value === undefined) continue;
      if (
        value !== null &&
        (typeof value !== 'string' ||
          !/^[\x21-\x7e]{8,200}$/.test(value.trim()))
      )
        throw new SettingsError(
          'Kunci API tidak valid (8–200 karakter, tanpa spasi).',
        );
      secrets.push([name as SecretName, value === null ? null : value.trim()]);
    }
    if (secrets.some(([, value]) => value !== null) && !encryptionConfigured())
      throw new SettingsError(
        'APP_ENCRYPTION_KEY belum diatur di server, jadi kunci rahasia belum bisa disimpan. Hubungi pengelola server.',
      );

    const current = await getStoreSettings(storeId);
    const settings = validateSettings({
      ...current,
      ...(body.manualPayment !== undefined
        ? { manualPayment: body.manualPayment }
        : {}),
      ...(body.midtrans !== undefined ? { midtrans: body.midtrans } : {}),
    });
    const changed: string[] = [];
    for (const key of ['manualPayment', 'midtrans'] as const)
      for (const [field, value] of Object.entries(settings[key]))
        if (
          JSON.stringify(value) !==
          JSON.stringify((current[key] as Record<string, unknown>)[field])
        )
          changed.push(`${key}.${field}`);
    await saveStoreSettings(storeId, settings);
    for (const [name, value] of secrets) {
      await setSecret(storeId, name, value);
      changed.push(`${name}:${value === null ? 'dihapus' : 'diganti'}`);
    }
    if (changed.length)
      await audit(admin, {
        storeId,
        action: 'payments.update',
        // Never the secret values; for the bank account only the last digits.
        meta: {
          fields: changed.join(', '),
          ...(changed.includes('manualPayment.accountNumber')
            ? { rekening: `…${settings.manualPayment.accountNumber.slice(-4)}` }
            : {}),
        },
      });
    return NextResponse.json({ ok: true, changed });
  } catch (error) {
    if (error instanceof SettingsError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
