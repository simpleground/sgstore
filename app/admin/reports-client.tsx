'use client';

import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Summary = {
  orders: number;
  paidOrders: number;
  pending: number;
  cancelled: number;
  revenue: number;
  productRevenue: number;
  shipping: number;
  itemsSold: number;
  averageOrder: number;
};
type StoreSales = {
  storeId: string;
  storeName: string;
  orders: number;
  paidOrders: number;
  revenue: number;
  itemsSold: number;
};
type ProductSales = {
  summary: { products: number; quantity: number; revenue: number };
  products: {
    storeId: string;
    storeName: string;
    productId: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    orders: number;
  }[];
  categories: { category: string; quantity: number; revenue: number }[];
};
type Inventory = {
  summary: {
    products: number;
    variants: number;
    units: number;
    value: number;
    outOfStock: number;
    lowStock: number;
    lowStockLimit: number;
  };
  lines: {
    storeId: string;
    storeName: string;
    productId: string;
    name: string;
    category: string;
    variant: string;
    sku: string;
    price: number;
    stock: number;
    value: number;
    soldCount: number;
    preorder: boolean;
    active: boolean;
    status: 'habis' | 'menipis' | 'aman';
  }[];
};
type Tab = 'finance' | 'products' | 'inventory';
const TABS: { key: Tab; label: string; note: string }[] = [
  {
    key: 'finance',
    label: 'Keuangan',
    note: 'Omzet, pembayaran, dan status pesanan.',
  },
  {
    key: 'products',
    label: 'Penjualan produk',
    note: 'Produk & kategori yang terjual di periode ini.',
  },
  {
    key: 'inventory',
    label: 'Stok inventori',
    note: 'Stok saat ini per varian (tidak bergantung periode).',
  },
];

type Report = {
  period: { from: string; to: string; unit: 'day' | 'month' };
  summary: Summary;
  stores: StoreSales[];
  trend: {
    period: string;
    orders: number;
    paidOrders: number;
    revenue: number;
  }[];
  statuses: Record<string, number>;
  finance: {
    byPayment: {
      method: string;
      label: string;
      orders: number;
      revenue: number;
    }[];
    pendingValue: number;
    cancelledValue: number;
  };
  topProducts: {
    storeId: string;
    storeName: string;
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
};

const STATUSES: Record<string, string> = {
  menunggu_pembayaran: 'Menunggu pembayaran',
  dibayar: 'Sudah dibayar',
  diproses: 'Diproses',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};
const money = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
const compact = (value: number) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(value);
const number = (value: number) => new Intl.NumberFormat('id-ID').format(value);

/** yyyy-mm-dd of today in WIB, shifted by `days`. */
function wibDay(days = 0) {
  return new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
const PRESETS: { key: string; label: string; range: () => [string, string] }[] =
  [
    { key: '7', label: '7 hari', range: () => [wibDay(-6), wibDay()] },
    { key: '30', label: '30 hari', range: () => [wibDay(-29), wibDay()] },
    {
      key: 'month',
      label: 'Bulan ini',
      range: () => [`${wibDay().slice(0, 8)}01`, wibDay()],
    },
    { key: '90', label: '3 bulan', range: () => [wibDay(-89), wibDay()] },
    {
      key: 'year',
      label: 'Tahun ini',
      range: () => [`${wibDay().slice(0, 4)}-01-01`, wibDay()],
    },
  ];
function periodLabel(value: string, unit: 'day' | 'month', long = false) {
  const date = new Date(
    unit === 'month' ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`,
  );
  return date.toLocaleDateString('id-ID', {
    timeZone: 'UTC',
    ...(unit === 'month'
      ? { month: long ? 'long' : 'short', year: 'numeric' }
      : {
          day: 'numeric',
          month: 'short',
          ...(long ? { year: 'numeric' } : {}),
        }),
  });
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-slate-500">{note}</p>
    </div>
  );
}

/** Revenue per day/month: one series, bars with a hover tooltip. */
function TrendChart({ report }: { report: Report }) {
  const [active, setActive] = useState<number | null>(null);
  const { trend, period } = report;
  const maximum = Math.max(1, ...trend.map((point) => point.revenue));
  const labelEvery = Math.max(1, Math.ceil(trend.length / 10));
  const point = active === null ? null : trend[active];
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base">
          Omzet per {period.unit === 'month' ? 'bulan' : 'hari'}
        </h2>
        <span className="text-xs text-slate-500">
          IDR · WIB · pesanan dibayar
        </span>
      </div>
      <div className="relative mt-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
        <span className="absolute -top-5 left-0 text-[11px] text-slate-500">
          {compact(maximum)}
        </span>
        <div
          className="flex h-48 items-end gap-[2px] border-b border-slate-300"
          onMouseLeave={() => setActive(null)}
        >
          {trend.map((item, index) => (
            <button
              key={item.period}
              type="button"
              aria-label={`${periodLabel(item.period, period.unit, true)}: ${money(item.revenue)}, ${item.paidOrders} pesanan dibayar`}
              className="flex h-full min-w-0 flex-1 items-end focus:outline-none"
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span
                className={`block w-full rounded-t-[4px] ${active === index ? 'bg-blue-700' : 'bg-blue-600'}`}
                style={{
                  height: item.revenue
                    ? `${Math.max(2, (item.revenue / maximum) * 100)}%`
                    : '1px',
                  opacity: item.revenue ? 1 : 0.35,
                }}
              />
            </button>
          ))}
        </div>
        {point && active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border bg-white p-3 text-xs shadow-lg"
            style={
              active < trend.length / 2
                ? {
                    left: `calc(${((active + 1) / trend.length) * 100}% + 8px)`,
                  }
                : { right: `calc(${(1 - active / trend.length) * 100}% + 8px)` }
            }
          >
            <p className="font-semibold text-slate-900">
              {periodLabel(point.period, period.unit, true)}
            </p>
            <p className="mt-1.5 flex justify-between text-slate-600">
              <span>Omzet</span>
              <b className="text-slate-900">{money(point.revenue)}</b>
            </p>
            <p className="flex justify-between text-slate-600">
              <span>Pesanan dibayar</span>
              <b className="text-slate-900">{point.paidOrders}</b>
            </p>
            <p className="flex justify-between text-slate-600">
              <span>Semua pesanan</span>
              <b className="text-slate-900">{point.orders}</b>
            </p>
          </div>
        )}
        <div className="mt-2 flex gap-[2px]">
          {trend.map((item, index) => (
            <span
              key={item.period}
              className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-slate-500"
            >
              {index % labelEvery === 0 && (
                <span
                  className={
                    (index / labelEvery) % 2 ? 'hidden sm:inline' : undefined
                  }
                >
                  {periodLabel(item.period, period.unit)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Reports: finance, product sales and inventory. `stores` given (platform
 * super_admin) = a website filter and a comparison of the websites; without
 * it the endpoint reports only the current store.
 */
export function ReportsCenter({
  endpoint,
  stores,
}: {
  endpoint: string;
  stores?: { id: string; name: string }[];
}) {
  const [preset, setPreset] = useState('30');
  const [range, setRange] = useState<[string, string]>(() => [
    wibDay(-29),
    wibDay(),
  ]);
  const [storeId, setStoreId] = useState('');
  const [tab, setTab] = useState<Tab>('finance');
  const [reloads, setReloads] = useState(0);
  const [data, setData] = useState<{ tab: Tab; value: unknown } | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState('');

  const params = new URLSearchParams({
    report: tab,
    from: range[0],
    to: range[1],
  });
  if (storeId) params.set('store', storeId);
  const request = `${params}#${reloads}`;
  const loading = loaded !== request;
  useEffect(() => {
    let current = true;
    const [query] = request.split('#');
    fetch(`${endpoint}?${query}`)
      .then(async (response) => {
        const value = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(value.error || 'Laporan gagal dimuat.');
        if (current) {
          setData({
            tab: new URLSearchParams(query).get('report') as Tab,
            value,
          });
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (current)
          setError(
            reason instanceof Error ? reason.message : 'Koneksi terputus.',
          );
      })
      .finally(() => {
        if (current) setLoaded(request);
      });
    return () => {
      current = false;
    };
  }, [endpoint, request]);

  const choosePreset = (key: string) => {
    setPreset(key);
    const found = PRESETS.find((item) => item.key === key);
    if (found) setRange(found.range());
  };
  const allStores = Boolean(stores) && !storeId;
  const report = data?.tab === 'finance' ? (data.value as Report) : null;
  const productSales =
    data?.tab === 'products' ? (data.value as ProductSales) : null;
  const inventory =
    data?.tab === 'inventory' ? (data.value as Inventory) : null;
  const summary = report?.summary;
  const maxStoreRevenue = Math.max(
    1,
    ...(report?.stores ?? []).map((s) => s.revenue),
  );
  const statusTotal = Object.values(report?.statuses ?? {}).reduce(
    (a, b) => a + b,
    0,
  );
  const field = 'h-10 rounded-lg border bg-white px-3 text-sm';

  return (
    <section className="space-y-6">
      <div>
        <div role="tablist" className="flex flex-wrap gap-1 border-b">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === item.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {TABS.find((item) => item.key === tab)?.note}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        {stores && (
          <label className="text-xs font-semibold text-slate-500">
            Website
            <select
              aria-label="Filter website"
              className={`${field} mt-1 block min-w-48`}
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
            >
              <option value="">Semua website</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {tab !== 'inventory' && (
          <>
            <div className="text-xs font-semibold text-slate-500">
              Periode
              <div className="mt-1 flex flex-wrap gap-1">
                {PRESETS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => choosePreset(item.key)}
                    className={`h-10 rounded-lg border px-3 text-sm font-medium ${preset === item.key ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-xs font-semibold text-slate-500">
              Dari
              <input
                type="date"
                className={`${field} mt-1 block`}
                value={range[0]}
                max={range[1]}
                onChange={(event) => {
                  if (!event.target.value) return;
                  setPreset('');
                  setRange([event.target.value, range[1]]);
                }}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Sampai
              <input
                type="date"
                className={`${field} mt-1 block`}
                value={range[1]}
                min={range[0]}
                onChange={(event) => {
                  if (!event.target.value) return;
                  setPreset('');
                  setRange([range[0], event.target.value]);
                }}
              />
            </label>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            aria-label="Muat ulang"
            onClick={() => setReloads((count) => count + 1)}
          >
            <RefreshCw size={15} />
          </Button>
          <a
            href={`${endpoint}?${params}&format=csv`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            <Download size={15} /> Unduh CSV
          </a>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {summary && report && (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm text-slate-500">
            {periodLabel(report.period.from, 'day', true)} –{' '}
            {periodLabel(report.period.to, 'day', true)}
            {stores
              ? ` · ${storeId ? stores.find((store) => store.id === storeId)?.name : 'semua website'}`
              : ''}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              label="Omzet terkonfirmasi"
              value={money(summary.revenue)}
              note={`Produk ${money(summary.productRevenue)} · ongkir ${money(summary.shipping)}`}
            />
            <Tile
              label="Pesanan dibayar"
              value={number(summary.paidOrders)}
              note={`dari ${number(summary.orders)} pesanan · ${number(summary.pending)} menunggu · ${number(summary.cancelled)} batal`}
            />
            <Tile
              label="Rata-rata per pesanan"
              value={money(summary.averageOrder)}
              note="Omzet dibagi jumlah pesanan dibayar"
            />
            <Tile
              label="Barang terjual"
              value={number(summary.itemsSold)}
              note="Jumlah barang di pesanan dibayar"
            />
          </div>

          <TrendChart report={report} />

          <FinanceDetails report={report} />

          <div
            className={`grid gap-6 ${allStores ? 'xl:grid-cols-2' : 'xl:grid-cols-[1.6fr_1fr]'}`}
          >
            {allStores && (
              <div className="rounded-xl border bg-white p-5">
                <h2 className="text-base">Perbandingan website</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Klik nama website untuk melihat laporannya saja.
                </p>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="pb-2 font-medium">Website</th>
                      <th className="pb-2 font-medium">Omzet</th>
                      <th className="pb-2 pl-3 text-right font-medium">
                        Dibayar
                      </th>
                      <th className="pb-2 pl-3 text-right font-medium">
                        Barang
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stores.map((store) => (
                      <tr key={store.storeId} className="border-t">
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            className="text-left font-medium text-blue-700"
                            onClick={() => setStoreId(store.storeId)}
                          >
                            {store.storeName}
                          </button>
                        </td>
                        <td
                          className="w-1/2 py-2.5 pr-3"
                          aria-label={money(store.revenue)}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"
                            >
                              <span
                                className="block h-full rounded-full bg-blue-600"
                                style={{
                                  width: `${(store.revenue / maxStoreRevenue) * 100}%`,
                                }}
                              />
                            </span>
                            <span className="w-24 text-right text-slate-900">
                              {compact(store.revenue)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-slate-700">
                          {number(store.paidOrders)}
                          <span className="text-slate-400">
                            /{number(store.orders)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-slate-700">
                          {number(store.itemsSold)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rounded-xl border bg-white p-5">
              <h2 className="text-base">Produk terlaris</h2>
              {report.topProducts.length ? (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Produk</th>
                      <th className="pb-2 pl-3 text-right font-medium">
                        Terjual
                      </th>
                      <th className="pb-2 pl-3 text-right font-medium">
                        Penjualan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.map((product, index) => (
                      <tr
                        key={`${product.storeId}:${product.productId}:${product.name}`}
                        className="border-t"
                      >
                        <td className="py-2.5 pr-2 text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="font-medium text-slate-900">
                            {product.name || '(tanpa nama)'}
                          </span>
                          {allStores && (
                            <span className="block text-xs text-slate-500">
                              {product.storeName}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {number(product.quantity)}
                        </td>
                        <td className="py-2.5 text-right">
                          {money(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-6 text-sm text-slate-500">
                  Belum ada barang terjual di periode ini.
                </p>
              )}
            </div>

            {!allStores && (
              <div className="rounded-xl border bg-white p-5">
                <h2 className="text-base">Status pesanan</h2>
                <StatusList statuses={report.statuses} total={statusTotal} />
              </div>
            )}
          </div>

          {allStores && (
            <div className="rounded-xl border bg-white p-5">
              <h2 className="text-base">Status pesanan</h2>
              <StatusList statuses={report.statuses} total={statusTotal} />
            </div>
          )}
        </div>
      )}
      {productSales && (
        <div className={loading ? 'opacity-60' : undefined}>
          <ProductSalesView data={productSales} showStore={allStores} />
        </div>
      )}
      {inventory && (
        <div className={loading ? 'opacity-60' : undefined}>
          <InventoryView data={inventory} showStore={allStores} />
        </div>
      )}
      {data?.tab !== tab && !error && (
        <p className="text-sm text-slate-500">Memuat laporan…</p>
      )}
    </section>
  );
}

function StatusList({
  statuses,
  total,
}: {
  statuses: Record<string, number>;
  total: number;
}) {
  return (
    <div className="mt-5 space-y-4">
      {Object.entries(STATUSES).map(([key, label]) => {
        const count = statuses[key] ?? 0;
        return (
          <div key={key}>
            <span className="mb-1.5 flex justify-between text-sm">
              <span className="text-slate-600">{label}</span>
              <b className="text-slate-900">{number(count)}</b>
            </span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-blue-600"
                style={{ width: `${total ? (count / total) * 100 : 0}%` }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="text-base">{title}</h2>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      {children}
    </div>
  );
}

/** Money by payment method, plus the value of unpaid and cancelled orders. */
function FinanceDetails({ report }: { report: Report }) {
  const { byPayment, pendingValue, cancelledValue } = report.finance;
  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card
        title="Pemasukan per metode pembayaran"
        note="Pesanan dibayar, termasuk ongkir."
      >
        {byPayment.length ? (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-medium">Metode</th>
                <th className="pb-2 pl-3 text-right font-medium">Pesanan</th>
                <th className="pb-2 pl-3 text-right font-medium">Jumlah</th>
                <th className="pb-2 pl-3 text-right font-medium">Porsi</th>
              </tr>
            </thead>
            <tbody>
              {byPayment.map((row) => (
                <tr key={row.method} className="border-t">
                  <td className="py-2.5 pr-3 font-medium">{row.label}</td>
                  <td className="py-2.5 text-right">{number(row.orders)}</td>
                  <td className="py-2.5 text-right">{money(row.revenue)}</td>
                  <td className="py-2.5 text-right text-slate-500">
                    {report.summary.revenue
                      ? `${Math.round((row.revenue / report.summary.revenue) * 100)}%`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Belum ada pembayaran di periode ini.
          </p>
        )}
      </Card>
      <Card title="Belum menjadi pemasukan">
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">
              Menunggu pembayaran ({number(report.summary.pending)})
            </dt>
            <dd className="font-semibold">{money(pendingValue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">
              Dibatalkan ({number(report.summary.cancelled)})
            </dt>
            <dd className="font-semibold">{money(cancelledValue)}</dd>
          </div>
          <div className="flex justify-between border-t pt-3">
            <dt className="text-slate-600">Ongkir yang ditagihkan</dt>
            <dd className="font-semibold">{money(report.summary.shipping)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

const PAGE = 20;

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>
        Halaman {page}/{pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

function ProductSalesView({
  data,
  showStore,
}: {
  data: ProductSales;
  showStore: boolean;
}) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const rows = data.products.filter((row) =>
    `${row.name} ${row.category} ${row.storeName}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
  const maxCategory = Math.max(1, ...data.categories.map((row) => row.revenue));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Penjualan produk"
          value={money(data.summary.revenue)}
          note="Tanpa ongkir, pesanan dibayar"
        />
        <Tile
          label="Barang terjual"
          value={number(data.summary.quantity)}
          note="Jumlah unit"
        />
        <Tile
          label="Produk terjual"
          value={number(data.summary.products)}
          note="Produk berbeda yang laku"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Semua produk terjual">
          <input
            aria-label="Cari produk"
            placeholder="Cari produk atau kategori…"
            className="mt-3 h-10 w-full rounded-lg border bg-white px-3 text-sm"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          {rows.length ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">Produk</th>
                  <th className="pb-2 pl-3 text-right font-medium">Terjual</th>
                  <th className="pb-2 pl-3 text-right font-medium">Pesanan</th>
                  <th className="pb-2 pl-3 text-right font-medium">
                    Penjualan
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((current - 1) * PAGE, current * PAGE).map((row) => (
                  <tr
                    key={`${row.storeId}:${row.productId}:${row.name}`}
                    className="border-t"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-slate-900">
                        {row.name || '(tanpa nama)'}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {[
                          row.category || 'Tanpa kategori',
                          showStore ? row.storeName : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {number(row.quantity)}
                    </td>
                    <td className="py-2.5 text-right">{number(row.orders)}</td>
                    <td className="py-2.5 text-right">{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Belum ada produk terjual di periode ini.
            </p>
          )}
          <Pager page={current} total={rows.length} onPage={setPage} />
        </Card>
        <Card title="Per kategori">
          <div className="mt-4 space-y-4">
            {data.categories.map((row) => (
              <div key={row.category}>
                <span className="mb-1.5 flex justify-between gap-3 text-sm">
                  <span className="text-slate-700">{row.category}</span>
                  <b className="text-slate-900">{money(row.revenue)}</b>
                </span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-blue-600"
                    style={{ width: `${(row.revenue / maxCategory) * 100}%` }}
                  />
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {number(row.quantity)} barang
                </span>
              </div>
            ))}
            {!data.categories.length && (
              <p className="text-sm text-slate-500">Belum ada data.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const STOCK_STYLE = {
  habis: 'bg-red-50 text-red-700',
  menipis: 'bg-amber-50 text-amber-800',
  aman: 'bg-emerald-50 text-emerald-700',
};
const STOCK_LABEL = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' };

function InventoryView({
  data,
  showStore,
}: {
  data: Inventory;
  showStore: boolean;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | 'habis' | 'menipis' | 'aman'>('');
  const [query, setQuery] = useState('');
  const rows = data.lines.filter(
    (line) =>
      (!status || (line.status === status && !line.preorder)) &&
      `${line.name} ${line.variant} ${line.sku} ${line.category} ${line.storeName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Nilai stok"
          value={money(data.summary.value)}
          note="Harga jual × stok"
        />
        <Tile
          label="Unit tersedia"
          value={number(data.summary.units)}
          note={`${number(data.summary.variants)} varian dari ${number(data.summary.products)} produk`}
        />
        <Tile
          label="Stok habis"
          value={number(data.summary.outOfStock)}
          note="Varian produk aktif"
        />
        <Tile
          label="Stok menipis"
          value={number(data.summary.lowStock)}
          note={`Sisa ${data.summary.lowStockLimit} atau kurang`}
        />
      </div>
      <Card title="Stok per varian">
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            aria-label="Cari stok"
            placeholder="Cari produk, varian, atau SKU…"
            className="h-10 min-w-56 flex-1 rounded-lg border bg-white px-3 text-sm"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filter status stok"
            className="h-10 rounded-lg border bg-white px-3 text-sm"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="">Semua status</option>
            <option value="habis">Habis</option>
            <option value="menipis">Menipis</option>
            <option value="aman">Aman</option>
          </select>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">Produk</th>
                  <th className="pb-2 font-medium">Varian</th>
                  <th className="pb-2 pl-3 text-right font-medium">Stok</th>
                  <th className="pb-2 pl-3 text-right font-medium">Nilai</th>
                  <th className="pb-2 pl-3 text-right font-medium">Terjual</th>
                  <th className="pb-2 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice((current - 1) * PAGE, current * PAGE)
                  .map((line, index) => (
                    <tr
                      key={`${line.productId}:${line.variant}:${line.sku}:${index}`}
                      className="border-t"
                    >
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-slate-900">
                          {line.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {[
                            line.category,
                            showStore ? line.storeName : '',
                            line.active ? '' : 'Nonaktif',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {line.variant || '-'}
                        {line.sku && (
                          <span className="block text-xs text-slate-400">
                            {line.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        {number(line.stock)}
                      </td>
                      <td className="py-2.5 text-right">{money(line.value)}</td>
                      <td className="py-2.5 text-right">
                        {number(line.soldCount)}
                      </td>
                      <td className="py-2.5 pl-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${line.preorder ? 'bg-blue-50 text-blue-700' : STOCK_STYLE[line.status]}`}
                        >
                          {line.preorder
                            ? 'Pre-order'
                            : STOCK_LABEL[line.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Tidak ada produk yang sesuai.
          </p>
        )}
        <Pager page={current} total={rows.length} onPage={setPage} />
      </Card>
    </div>
  );
}
