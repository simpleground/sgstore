'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  SecretName,
  SocialLink,
  StoreSettings,
} from '@/lib/store-settings';

type Profile = {
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
};
type SecretStatus = Record<
  SecretName,
  { set: boolean; hint: string; updatedAt: string }
>;
type Loaded = {
  store: Profile;
  settings: StoreSettings;
  secrets: SecretStatus;
  canManagePayments: boolean;
  encryptionConfigured: boolean;
  status: {
    midtrans: boolean;
    manual: boolean;
    shipping: boolean;
    midtransFromEnv: boolean;
    biteshipFromEnv: boolean;
  };
};

async function fetchSettings() {
  const response = await fetch('/api/admin/settings', { cache: 'no-store' });
  const data = (await response.json()) as Loaded & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Pengaturan gagal dimuat.');
  return data;
}

async function save(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'Pengaturan gagal disimpan.');
}

const input = 'mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal';

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

function Badge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
    >
      {children}
    </span>
  );
}

export function SettingsManager() {
  const [data, setData] = useState<Loaded | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [secrets, setSecrets] = useState<
    Partial<Record<SecretName, string | null>>
  >({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(
    () =>
      fetchSettings()
        .then((loaded) => {
          setData(loaded);
          setProfile(loaded.store);
          setSettings(loaded.settings);
          setSecrets({});
        })
        .catch((error: Error) => setMessage(error.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!data || !profile || !settings)
    return (
      <p className="text-sm text-[#68736b]">
        {message || 'Memuat pengaturan…'}
      </p>
    );

  const set = <K extends keyof StoreSettings>(
    key: K,
    value: StoreSettings[K],
  ) => setSettings({ ...settings, [key]: value });
  const setManual = (patch: Partial<StoreSettings['manualPayment']>) =>
    set('manualPayment', { ...settings.manualPayment, ...patch });
  const setMidtrans = (patch: Partial<StoreSettings['midtrans']>) =>
    set('midtrans', { ...settings.midtrans, ...patch });
  const setLink = (index: number, patch: Partial<SocialLink>) =>
    set(
      'socialLinks',
      settings.socialLinks.map((link, i) =>
        i === index ? { ...link, ...patch } : link,
      ),
    );

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Koneksi terputus. Coba lagi.',
      );
    } finally {
      setBusy(false);
    }
  }

  const saveGeneral = () =>
    run(
      () =>
        save('/api/admin/settings', {
          store: profile,
          settings: {
            whatsapp: settings.whatsapp,
            socialLinks: settings.socialLinks,
            checkoutNoticeTitle: settings.checkoutNoticeTitle,
            checkoutNotice: settings.checkoutNotice,
            recommendedPayment: settings.recommendedPayment,
            orderPrefix: settings.orderPrefix,
            shippingOriginPostalCode: settings.shippingOriginPostalCode,
          },
        }),
      'Pengaturan toko tersimpan.',
    );
  const savePayments = () =>
    run(
      () =>
        save('/api/admin/settings/payments', {
          manualPayment: settings.manualPayment,
          midtrans: settings.midtrans,
          secrets,
        }),
      'Pengaturan pembayaran tersimpan.',
    );

  const secretField = (name: SecretName, label: string, fromEnv: boolean) => {
    const status = data.secrets[name];
    const value = secrets[name];
    return (
      <Field
        label={label}
        hint={
          value === null
            ? 'Akan dihapus saat disimpan.'
            : status.set
              ? `Tersimpan (…${status.hint}). Kosongkan untuk tetap memakai kunci ini.`
              : fromEnv
                ? 'Belum diisi — saat ini memakai kunci dari server.'
                : 'Belum diisi.'
        }
      >
        <div className="flex gap-2">
          <input
            type="password"
            autoComplete="off"
            className={input}
            value={value ?? ''}
            placeholder={status.set ? `••••••••${status.hint}` : ''}
            onChange={(event) =>
              setSecrets({
                ...secrets,
                [name]: event.target.value || undefined,
              })
            }
          />
          {status.set && (
            <button
              type="button"
              className="mt-1 rounded-xl border px-3 text-xs font-semibold text-red-700"
              onClick={() => setSecrets({ ...secrets, [name]: null })}
            >
              Hapus
            </button>
          )}
        </div>
      </Field>
    );
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
          Toko
        </p>
        <h2 className="mt-1 font-serif text-3xl">Pengaturan toko</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge ok={data.status.manual}>
            Transfer manual {data.status.manual ? 'aktif' : 'belum aktif'}
          </Badge>
          <Badge ok={data.status.midtrans}>
            QRIS/VA Midtrans {data.status.midtrans ? 'aktif' : 'belum aktif'}
          </Badge>
          <Badge ok={data.status.shipping}>
            Cek ongkir {data.status.shipping ? 'siap' : 'belum siap'}
          </Badge>
        </div>
      </div>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void saveGeneral();
        }}
      >
        <Card title="Profil & kontak" note="Ditampilkan kepada pembeli.">
          <Field label="Nama toko">
            <input
              className={input}
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              className={input}
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
            />
          </Field>
          <Field
            label="WhatsApp"
            hint="Contoh: 0812 3456 7890. Kosongkan untuk menyembunyikan tombol WhatsApp."
          >
            <input
              className={input}
              inputMode="tel"
              value={settings.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
          </Field>
          <Field label="Telepon">
            <input
              className={input}
              value={profile.phone}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat">
              <textarea
                className={input}
                rows={2}
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-semibold">Media sosial & marketplace</p>
            {settings.socialLinks.map((link, index) => (
              <div
                key={index}
                className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
              >
                <input
                  aria-label="Nama tautan"
                  className={input}
                  placeholder="Instagram"
                  value={link.label}
                  onChange={(e) => setLink(index, { label: e.target.value })}
                />
                <input
                  aria-label="Alamat tautan"
                  className={input}
                  placeholder="https://…"
                  value={link.url}
                  onChange={(e) => setLink(index, { url: e.target.value })}
                />
                <button
                  type="button"
                  className="text-sm font-semibold text-red-700"
                  onClick={() =>
                    set(
                      'socialLinks',
                      settings.socialLinks.filter((_, i) => i !== index),
                    )
                  }
                >
                  Hapus
                </button>
              </div>
            ))}
            {settings.socialLinks.length < 10 && (
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm font-semibold"
                onClick={() =>
                  set('socialLinks', [
                    ...settings.socialLinks,
                    { label: '', url: '' },
                  ])
                }
              >
                + Tambah tautan
              </button>
            )}
          </div>
        </Card>

        <Card title="Checkout & pesanan">
          <Field
            label="Judul catatan checkout"
            hint="Kosongkan bila tidak ada pengumuman."
          >
            <input
              className={input}
              value={settings.checkoutNoticeTitle}
              onChange={(e) => set('checkoutNoticeTitle', e.target.value)}
            />
          </Field>
          <Field label="Metode pembayaran yang direkomendasikan">
            <select
              className={input}
              value={settings.recommendedPayment}
              onChange={(e) =>
                set(
                  'recommendedPayment',
                  e.target.value as StoreSettings['recommendedPayment'],
                )
              }
            >
              <option value="">Otomatis</option>
              <option value="manual">Transfer manual</option>
              <option value="midtrans">QRIS & Virtual Account</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Isi catatan checkout">
              <textarea
                className={input}
                rows={3}
                value={settings.checkoutNotice}
                onChange={(e) => set('checkoutNotice', e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Awalan nomor pesanan"
            hint="1–6 huruf/angka, mis. SG → SG-MUH8YOB5-2B79."
          >
            <input
              className={input}
              maxLength={6}
              value={settings.orderPrefix}
              onChange={(e) => set('orderPrefix', e.target.value.toUpperCase())}
            />
          </Field>
          <Field
            label="Kode pos gudang (asal pengiriman)"
            hint="Dipakai untuk menghitung ongkir."
          >
            <input
              className={input}
              inputMode="numeric"
              maxLength={5}
              value={settings.shippingOriginPostalCode}
              onChange={(e) => set('shippingOriginPostalCode', e.target.value)}
            />
          </Field>
        </Card>
        <button
          disabled={busy}
          className="rounded-xl bg-[#243b2c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Simpan pengaturan toko
        </button>
      </form>

      {data.canManagePayments ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void savePayments();
          }}
        >
          {!data.encryptionConfigured && (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              Server belum memiliki APP_ENCRYPTION_KEY, jadi kunci API belum
              bisa disimpan. Pengaturan lain tetap bisa diubah.
            </p>
          )}
          <Card
            title="Transfer manual"
            note="Rekening yang ditampilkan kepada pembeli setelah pesanan dibuat. Hanya pemilik toko yang dapat mengubahnya."
          >
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.manualPayment.enabled}
                onChange={(e) => setManual({ enabled: e.target.checked })}
              />
              Terima transfer manual
            </label>
            <Field label="Nama bank">
              <input
                className={input}
                placeholder="Bank Mandiri"
                value={settings.manualPayment.bankName}
                onChange={(e) => setManual({ bankName: e.target.value })}
              />
            </Field>
            <Field label="Nomor rekening">
              <input
                className={input}
                inputMode="numeric"
                value={settings.manualPayment.accountNumber}
                onChange={(e) => setManual({ accountNumber: e.target.value })}
              />
            </Field>
            <Field label="Atas nama">
              <input
                className={input}
                value={settings.manualPayment.accountHolder}
                onChange={(e) => setManual({ accountHolder: e.target.value })}
              />
            </Field>
          </Card>
          <Card
            title="QRIS & Virtual Account (Midtrans)"
            note="Pembayaran masuk ke akun Midtrans milik toko ini. Setel Payment Notification URL di dashboard Midtrans ke /api/payments/midtrans/notification pada domain toko."
          >
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.midtrans.enabled}
                onChange={(e) => setMidtrans({ enabled: e.target.checked })}
              />
              Terima pembayaran Midtrans
            </label>
            <Field label="Client key">
              <input
                className={input}
                value={settings.midtrans.clientKey}
                placeholder={
                  data.status.midtransFromEnv ? 'Memakai kunci dari server' : ''
                }
                onChange={(e) => setMidtrans({ clientKey: e.target.value })}
              />
            </Field>
            {secretField(
              'midtrans_server_key',
              'Server key',
              data.status.midtransFromEnv,
            )}
            <Field label="Mode">
              <select
                className={input}
                value={
                  settings.midtrans.production === null
                    ? ''
                    : String(settings.midtrans.production)
                }
                onChange={(e) =>
                  setMidtrans({
                    production:
                      e.target.value === '' ? null : e.target.value === 'true',
                  })
                }
              >
                <option value="">
                  {data.status.midtransFromEnv
                    ? 'Ikuti pengaturan server'
                    : 'Sandbox (uji coba)'}
                </option>
                <option value="false">Sandbox (uji coba)</option>
                <option value="true">Produksi</option>
              </select>
            </Field>
          </Card>
          <Card
            title="Ongkir (Biteship)"
            note="Opsional. Tanpa kunci sendiri, toko memakai akun Biteship platform bila tersedia."
          >
            {secretField(
              'biteship_api_key',
              'API key Biteship',
              data.status.biteshipFromEnv,
            )}
          </Card>
          <button
            disabled={busy}
            className="rounded-xl bg-[#243b2c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Simpan pembayaran & integrasi
          </button>
        </form>
      ) : (
        <p className="rounded-2xl bg-[#efe7d8] p-4 text-sm text-[#566158]">
          Rekening dan kunci pembayaran hanya dapat diubah oleh pemilik toko.
        </p>
      )}
      {message && (
        <output className="block text-sm font-semibold text-[#566158]">
          {message}
        </output>
      )}
    </section>
  );
}
