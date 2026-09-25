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
 * Sales report. `stores` given (platform) = a website filter and a comparison
 * of the websites; without it the endpoint reports only the current store.
 */
export function SalesReport({
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
  const [reloads, setReloads] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState('');

  const params = new URLSearchParams({ from: range[0], to: range[1] });
  if (storeId) params.set('store', storeId);
  const request = `${params}#${reloads}`;
  const loading = loaded !== request;
  useEffect(() => {
    let current = true;
    const [query] = request.split('#');
    fetch(`${endpoint}?${query}`)
      .then(async (response) => {
        const data = (await response.json()) as Report & { error?: string };
        if (!response.ok)
          throw new Error(data.error || 'Laporan gagal dimuat.');
        if (current) {
          setReport(data);
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
      {!report && !error && (
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
