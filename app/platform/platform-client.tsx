'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SalesReport } from '../admin/reports-client';
import { PlatformOrders } from './orders-client';

type Status = 'active' | 'suspended' | 'closed';
type StoreItem = {
  id: string;
  slug: string;
  name: string;
  status: Status;
  createdAt: string;
  products: number;
  orders: number;
  subdomain: string;
  domains: { host: string; primary: boolean }[];
  owners: string[];
};

const STATUS_LABEL: Record<Status, string> = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  closed: 'Ditutup',
};
const STATUS_STYLE: Record<Status, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  suspended: 'bg-amber-50 text-amber-800',
  closed: 'bg-slate-100 text-slate-600',
};
const input = 'w-full rounded-lg border bg-white px-3 py-2 text-sm';
const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

async function api(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    stores?: StoreItem[];
    rootDomain?: string;
  };
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

function storeUrl(store: StoreItem) {
  const host =
    store.domains.find((domain) => domain.primary)?.host || store.subdomain;
  return host ? `https://${host}` : '';
}

type Tab = 'toko' | 'pesanan' | 'laporan';

export function PlatformConsole({
  adminName,
  initialTab,
}: {
  adminName: string;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [rootDomain, setRootDomain] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    ownerEmail: '',
    domain: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [domainInput, setDomainInput] = useState<Record<string, string>>({});
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});

  const load = useCallback(
    () =>
      api('/api/platform/stores', 'GET')
        .then((data) => {
          setStores(data.stores ?? []);
          setRootDomain(data.rootDomain ?? '');
        })
        .catch((error: Error) => setMessage(error.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Koneksi terputus.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = (store: StoreItem, status: Status) => {
    const warning =
      status === 'active'
        ? `Aktifkan kembali ${store.name}?`
        : status === 'suspended'
          ? `Tangguhkan ${store.name}? Etalase ditutup untuk pembeli; admin toko tetap bisa masuk.`
          : `Tutup ${store.name}? Etalase ditutup dan admin toko tidak bisa masuk lagi. Data tetap disimpan.`;
    if (confirm(warning))
      void run(
        () => api(`/api/platform/stores/${store.id}`, 'PATCH', { status }),
        'Status toko diperbarui.',
      );
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">
            Platform
          </p>
          <h1 className="mt-1 text-3xl">
            {tab === 'toko'
              ? 'Semua toko'
              : tab === 'pesanan'
                ? 'Semua pesanan'
                : 'Laporan penjualan'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {stores.length} toko · masuk sebagai {adminName}
            {rootDomain
              ? ` · subdomain: <slug>.${rootDomain}`
              : ' · PLATFORM_ROOT_DOMAIN belum diatur'}
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
        >
          Admin toko ini
        </Link>
      </header>

      <nav className="mt-6 flex gap-1 border-b" aria-label="Menu platform">
        {(
          [
            ['toko', 'Toko'],
            ['pesanan', 'Pesanan'],
            ['laporan', 'Laporan'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => {
              setTab(key);
              history.replaceState(
                null,
                '',
                key === 'toko' ? '/platform' : `/platform?tab=${key}`,
              );
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'pesanan' && (
        <PlatformOrders
          stores={stores.map((store) => ({
            id: store.id,
            name: store.name,
            url: storeUrl(store),
          }))}
        />
      )}

      {tab === 'laporan' && (
        <div className="mt-6">
          <SalesReport
            endpoint="/api/platform/reports"
            stores={stores.map((store) => ({ id: store.id, name: store.name }))}
          />
        </div>
      )}

      {tab === 'toko' && (
        <>
          <form
            className="mt-6 grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.3fr_1.2fr_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => api('/api/platform/stores', 'POST', form),
                `Toko ${form.name} dibuat. Pemilik masuk ke /admin di domain toko dengan akun Google ${form.ownerEmail}.`,
              ).then((ok) => {
                if (ok) {
                  setForm({ name: '', slug: '', ownerEmail: '', domain: '' });
                  setSlugTouched(false);
                }
              });
            }}
          >
            <p className="text-lg font-semibold sm:col-span-2 lg:col-span-5">
              Buat toko baru
            </p>
            <label className="text-sm font-semibold">
              Nama toko
              <input
                required
                className={input}
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: slugTouched ? form.slug : slugify(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Slug (subdomain)
              <input
                required
                className={input}
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: e.target.value.toLowerCase() });
                }}
              />
            </label>
            <label className="text-sm font-semibold">
              Email pemilik
              <input
                required
                type="email"
                className={input}
                value={form.ownerEmail}
                onChange={(e) =>
                  setForm({ ...form, ownerEmail: e.target.value })
                }
              />
            </label>
            <label className="text-sm font-semibold">
              Domain sendiri (opsional)
              <input
                className={input}
                placeholder="tokoanda.com"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </label>
            <button
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Buat toko
            </button>
          </form>
          {message && (
            <output className="mt-4 block text-sm font-semibold text-slate-700">
              {message}
            </output>
          )}

          <div className="mt-6 space-y-4">
            {stores.map((store) => (
              <article
                key={store.id}
                className="rounded-xl border bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg">{store.name}</h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[store.status]}`}
                      >
                        {STATUS_LABEL[store.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {store.slug} · {store.products} produk · {store.orders}{' '}
                      pesanan · dibuat{' '}
                      {new Date(store.createdAt).toLocaleDateString('id-ID')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Pemilik: {store.owners.join(', ') || 'belum ada'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {storeUrl(store) && (
                      <>
                        <a
                          href={storeUrl(store)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border px-3 py-1.5 text-sm"
                        >
                          Buka toko
                        </a>
                        <a
                          href={`${storeUrl(store)}/admin`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border px-3 py-1.5 text-sm"
                        >
                          Admin toko
                        </a>
                      </>
                    )}
                    <select
                      aria-label={`Status ${store.name}`}
                      disabled={busy}
                      value={store.status}
                      onChange={(e) =>
                        changeStatus(store, e.target.value as Status)
                      }
                      className="rounded-lg border bg-white px-2 py-1.5 text-sm"
                    >
                      {(Object.keys(STATUS_LABEL) as Status[]).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold">Domain</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {store.subdomain && (
                        <li className="text-slate-500">
                          {store.subdomain} (subdomain otomatis)
                        </li>
                      )}
                      {store.domains.map((domain) => (
                        <li
                          key={domain.host}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span>{domain.host}</span>
                          {domain.primary ? (
                            <span className="rounded bg-blue-50 px-1.5 text-xs text-blue-700">
                              utama
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              className="text-xs text-blue-600"
                              onClick={() =>
                                void run(
                                  () =>
                                    api(
                                      `/api/platform/stores/${store.id}/domains`,
                                      'PATCH',
                                      { host: domain.host },
                                    ),
                                  `${domain.host} menjadi domain utama.`,
                                )
                              }
                            >
                              jadikan utama
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            className="text-xs text-red-700"
                            onClick={() => {
                              if (
                                confirm(
                                  `Lepas ${domain.host} dari ${store.name}?`,
                                )
                              )
                                void run(
                                  () =>
                                    api(
                                      `/api/platform/stores/${store.id}/domains`,
                                      'DELETE',
                                      { host: domain.host },
                                    ),
                                  `${domain.host} dilepas.`,
                                );
                            }}
                          >
                            lepas
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        aria-label={`Domain baru untuk ${store.name}`}
                        className={input}
                        placeholder="tokoanda.com"
                        value={domainInput[store.id] ?? ''}
                        onChange={(e) =>
                          setDomainInput({
                            ...domainInput,
                            [store.id]: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        disabled={busy || !domainInput[store.id]}
                        className="rounded-lg border px-3 text-sm font-semibold"
                        onClick={() =>
                          void run(
                            () =>
                              api(
                                `/api/platform/stores/${store.id}/domains`,
                                'POST',
                                { host: domainInput[store.id] },
                              ),
                            'Domain ditambahkan. Arahkan DNS domain ke server dan buat sertifikat SSL-nya.',
                          ).then(
                            (ok) =>
                              ok &&
                              setDomainInput({
                                ...domainInput,
                                [store.id]: '',
                              }),
                          )
                        }
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Tambah pemilik</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        aria-label={`Email pemilik baru ${store.name}`}
                        type="email"
                        className={input}
                        placeholder="nama@email.com"
                        value={ownerInput[store.id] ?? ''}
                        onChange={(e) =>
                          setOwnerInput({
                            ...ownerInput,
                            [store.id]: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        disabled={busy || !ownerInput[store.id]}
                        className="rounded-lg border px-3 text-sm font-semibold"
                        onClick={() =>
                          void run(
                            () =>
                              api(
                                `/api/platform/stores/${store.id}/owners`,
                                'POST',
                                { email: ownerInput[store.id] },
                              ),
                            'Pemilik ditambahkan. Ia masuk dengan akun Google memakai email tersebut.',
                          ).then(
                            (ok) =>
                              ok &&
                              setOwnerInput({ ...ownerInput, [store.id]: '' }),
                          )
                        }
                      >
                        Tambah
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Pengaturan lain (produk, pembayaran, tampilan) dikelola di
                      Admin toko.
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
