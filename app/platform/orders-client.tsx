'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { printLabel } from '../admin/admin-client';
import { openStoreAdmin } from './open-admin';

type Order = {
  storeId: string;
  storeName: string;
  storeSlug: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  itemsJson: string;
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
};
type Sender = { name: string; phone: string; address: string };
type Result = {
  orders: Order[];
  senders: Record<string, Sender>;
  total: number;
  page: number;
  pages: number;
  statusCounts: Record<string, number>;
};
export type OrderStore = { id: string; name: string; url: string };

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
const dateTime = (value: string) =>
  new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
const whatsappUrl = (phone: string) =>
  `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '62')}`;
function items(order: Order) {
  try {
    return JSON.parse(order.itemsJson) as {
      name: string;
      quantity: number;
      sku?: string;
      color?: string;
      size?: string;
      preorder?: boolean;
      preorderDays?: number;
    }[];
  } catch {
    return [];
  }
}

function Status({ value }: { value: string }) {
  const color =
    value === 'dibatalkan'
      ? 'bg-red-50 text-red-700'
      : ['dibayar', 'selesai'].includes(value)
        ? 'bg-emerald-50 text-emerald-700'
        : value === 'menunggu_pembayaran'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-blue-50 text-blue-700';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUSES[value] || value}
    </span>
  );
}

const EMPTY_FILTER = { store: '', status: '', q: '', from: '', to: '' };

/** All orders of every store in one list, filterable per store. */
export function PlatformOrders({ stores }: { stores: OrderStore[] }) {
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Search waits until typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter((current) =>
        current.q === query.trim() ? current : { ...current, q: query.trim() },
      );
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState('');
  const params = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(filter))
    if (value) params.set(key, value);
  const request = `${params}#${reloads}`;
  const loading = loaded !== request;
  useEffect(() => {
    let current = true;
    const [query] = request.split('#');
    fetch(`/api/platform/orders?${query}`)
      .then(async (response) => {
        const data = (await response.json()) as Result & { error?: string };
        if (!response.ok)
          throw new Error(data.error || 'Pesanan gagal dimuat.');
        if (current) {
          setResult(data);
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
  }, [request]);

  const change = (key: keyof typeof EMPTY_FILTER, value: string) => {
    setFilter((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  async function updateStatus(order: Order, status: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/platform/orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          storeId: order.storeId,
          orderNumber: order.orderNumber,
          status,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Status gagal disimpan.');
      const updated = { ...order, status };
      setSelected(updated);
      setResult(
        (current) =>
          current && {
            ...current,
            orders: current.orders.map((row) =>
              row.storeId === order.storeId &&
              row.orderNumber === order.orderNumber
                ? updated
                : row,
            ),
            statusCounts: {
              ...current.statusCounts,
              [order.status]: (current.statusCounts[order.status] ?? 1) - 1,
              [status]: (current.statusCounts[status] ?? 0) + 1,
            },
          },
      );
      setMessage('Status pesanan tersimpan.');
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : 'Koneksi terputus.',
      );
    } finally {
      setBusy(false);
    }
  }

  const counts = result?.statusCounts ?? {};
  const countAll = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const select = 'h-10 rounded-lg border bg-white px-3 text-sm';

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-2">
        {[['', 'Semua status', countAll] as readonly [string, string, number]]
          .concat(
            Object.entries(STATUSES).map(
              ([key, label]) => [key, label, counts[key] ?? 0] as const,
            ),
          )
          .map(([key, label, count]) => (
            <button
              key={key || 'all'}
              type="button"
              onClick={() => change('status', key)}
              className={`rounded-full border px-3 py-1.5 text-sm ${filter.status === key ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
            >
              {label} <b className="ml-1">{count}</b>
            </button>
          ))}
      </div>

      <div className="mt-4 rounded-xl border bg-white">
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <label className="text-xs font-semibold text-slate-500">
            Website
            <select
              aria-label="Filter website"
              className={`${select} mt-1 block min-w-48`}
              value={filter.store}
              onChange={(event) => change('store', event.target.value)}
            >
              <option value="">Semua website</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Dari
            <input
              type="date"
              className={`${select} mt-1 block`}
              value={filter.from}
              onChange={(event) => change('from', event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Sampai
            <input
              type="date"
              className={`${select} mt-1 block`}
              value={filter.to}
              onChange={(event) => change('to', event.target.value)}
            />
          </label>
          <div className="relative min-w-56 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-3 text-slate-400"
            />
            <Input
              className="h-10 pl-9"
              placeholder="Cari nomor pesanan, nama, atau telepon…"
              aria-label="Cari pesanan"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              setFilter(EMPTY_FILTER);
              setPage(1);
            }}
          >
            Reset
          </Button>
          <Button
            variant="outline"
            aria-label="Muat ulang"
            onClick={() => setReloads((count) => count + 1)}
          >
            <RefreshCw size={15} />
          </Button>
        </div>

        {error && (
          <p role="alert" className="p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <div className={loading ? 'opacity-60' : undefined}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="pl-5">Pesanan</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-5 text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result?.orders.length ? (
                result.orders.map((order) => (
                  <TableRow key={`${order.storeId}:${order.orderNumber}`}>
                    <TableCell className="py-4 pl-5 font-semibold text-blue-600">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(order);
                          setMessage('');
                        }}
                      >
                        {order.orderNumber}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {order.storeName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{order.customerName}</span>
                      <span className="block text-xs text-slate-500">
                        {items(order).reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        )}{' '}
                        barang
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {dateTime(order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Status value={order.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(order.total)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Detail ${order.orderNumber}`}
                        onClick={() => {
                          setSelected(order);
                          setMessage('');
                        }}
                      >
                        <ArrowUpRight size={17} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-16 text-center text-slate-500"
                  >
                    {loading
                      ? 'Memuat pesanan…'
                      : 'Belum ada pesanan yang sesuai.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-4 text-sm text-slate-500">
          <span>
            {result?.total ?? 0} pesanan · halaman {result?.page ?? 1}/
            {result?.pages ?? 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Halaman sebelumnya"
              disabled={!result || result.page <= 1}
              onClick={() => setPage((result?.page ?? 1) - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Halaman berikutnya"
              disabled={!result || result.page >= result.pages}
              onClick={() => setPage((result?.page ?? 1) + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setMessage('');
          }
        }}
      >
        <SheetContent className="admin-workspace w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b p-6">
            <SheetTitle>Detail pesanan</SheetTitle>
            <SheetDescription>
              {selected?.orderNumber} · {selected?.storeName}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Status value={selected.status} />
                <span className="text-xs text-slate-500">
                  {dateTime(selected.createdAt)} ·{' '}
                  {selected.paymentMethod === 'midtrans'
                    ? 'Midtrans'
                    : 'Transfer manual'}
                </span>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pelanggan & pengiriman
                </p>
                <h3>{selected.customerName}</h3>
                <a
                  className="text-sm text-blue-600"
                  href={whatsappUrl(selected.customerPhone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.customerPhone}
                </a>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {selected.shippingAddress}
                </p>
              </div>
              <div className="border-y py-4">
                {items(selected).map((item, index) => (
                  <div key={index} className="py-2 text-sm">
                    <b>
                      {item.quantity} × {item.name}
                    </b>
                    <p className="mt-1 text-slate-500">
                      {[
                        item.sku,
                        item.color,
                        item.size,
                        item.preorder
                          ? `Pre-order ${item.preorderDays || 2} hari setelah pembayaran`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{money(selected.subtotal)}</span>
                </p>
                <p className="flex justify-between text-slate-500">
                  <span>Ongkir</span>
                  <span>{money(selected.shipping)}</span>
                </p>
                <p className="flex justify-between font-semibold">
                  <span>Total pembayaran</span>
                  <span>{money(selected.total)}</span>
                </p>
              </div>
              <label className="block text-sm font-medium">
                Status pesanan
                <select
                  className="mt-2 block w-full border bg-white p-3"
                  disabled={busy}
                  value={selected.status}
                  onChange={(event) =>
                    void updateStatus(selected, event.target.value)
                  }
                >
                  {Object.entries(STATUSES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {message && <output className="block text-sm">{message}</output>}
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  printLabel(
                    {
                      order_number: selected.orderNumber,
                      customer_name: selected.customerName,
                      customer_phone: selected.customerPhone,
                      shipping_address: selected.shippingAddress,
                      items_json: selected.itemsJson,
                      total: selected.total,
                      status: selected.status,
                      created_at: selected.createdAt,
                    },
                    result?.senders[selected.storeId] ?? {
                      name: selected.storeName,
                      phone: '',
                      address: '',
                    },
                  )
                }
              >
                <Printer size={16} /> Cetak label pengiriman A6
              </Button>
              <button
                type="button"
                onClick={() =>
                  void openStoreAdmin(selected.storeId).then(
                    (error) => error && setMessage(error),
                  )
                }
                className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-blue-600"
              >
                Kelola di admin {selected.storeName} <ExternalLink size={15} />
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
