/**
 * Sales reports for one store (admin panel) or several stores (platform).
 * Callers decide which stores are allowed; this module only receives the
 * store id to filter on (null = every store, platform super_admin only).
 *
 * Revenue counts paid orders only (dibayar, diproses, dikirim, selesai) and
 * includes shipping, like the admin dashboard. Days are Asia/Jakarta (WIB).
 */
import { getD1 } from '@/db';

export const PAID_STATUSES = ['dibayar', 'diproses', 'dikirim', 'selesai'];
const PAID_SQL = `o.status IN (${PAID_STATUSES.map((status) => `'${status}'`).join(',')})`;
const WIB_DAY =
  "((o.created_at)::timestamptz AT TIME ZONE 'Asia/Jakarta')::date";
const DAY_MS = 86_400_000;
const MAX_DAYS = 366 * 3;
const EXPORT_LIMIT = 50_000;

export class ReportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function reportErrorResponse(error: unknown) {
  if (error instanceof ReportError)
    return Response.json({ error: error.message }, { status: error.status });
  throw error;
}

export type ReportPeriod = { from: string; to: string; unit: 'day' | 'month' };

/** Today's date (yyyy-mm-dd) in WIB. */
function todayWib() {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

const parseDay = (value: string) => Date.parse(`${value}T00:00:00Z`);
const formatDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Period from ?from=&to= (yyyy-mm-dd, WIB); default the last 30 days. */
export function readPeriod(params: URLSearchParams): ReportPeriod {
  const today = todayWib();
  const to = params.get('to') || today;
  const from = params.get('from') || formatDay(parseDay(to) - 29 * DAY_MS);
  for (const value of [from, to])
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parseDay(value)))
      throw new ReportError('Tanggal tidak valid.');
  const days = (parseDay(to) - parseDay(from)) / DAY_MS + 1;
  if (days < 1)
    throw new ReportError('Tanggal awal harus sebelum tanggal akhir.');
  if (days > MAX_DAYS)
    throw new ReportError('Periode laporan maksimal 3 tahun.');
  return { from, to, unit: days > 92 ? 'month' : 'day' };
}

/** WHERE conditions on orders `o` for a store (null = all) and period. */
function orderConditions(storeId: string | null, period: ReportPeriod) {
  const values: string[] = [period.from, period.to];
  let sql = `${WIB_DAY} BETWEEN ?::date AND ?::date`;
  if (storeId) {
    sql += ' AND o.store_id=?';
    values.push(storeId);
  }
  return { sql, values };
}

export async function assertStoreExists(storeId: string) {
  if (
    !(await getD1()
      .prepare('SELECT 1 FROM stores WHERE id=?')
      .bind(storeId)
      .first())
  )
    throw new ReportError('Toko tidak ditemukan.', 404);
}

export type StoreSales = {
  storeId: string;
  storeName: string;
  orders: number;
  paidOrders: number;
  pending: number;
  cancelled: number;
  revenue: number;
  productRevenue: number;
  shipping: number;
  itemsSold: number;
};

export async function buildReport(
  storeId: string | null,
  period: ReportPeriod,
) {
  const d1 = getD1();
  const where = orderConditions(storeId, period);

  // Every store (also those without orders) so websites can be compared.
  const { results: stores } = await d1
    .prepare(
      `SELECT s.id AS "storeId", s.name AS "storeName",
        COUNT(o.id)::int AS orders,
        COUNT(o.id) FILTER (WHERE ${PAID_SQL})::int AS "paidOrders",
        COUNT(o.id) FILTER (WHERE o.status='menunggu_pembayaran')::int AS pending,
        COUNT(o.id) FILTER (WHERE o.status='dibatalkan')::int AS cancelled,
        COALESCE(SUM(o.total) FILTER (WHERE ${PAID_SQL}),0)::float8 AS revenue,
        COALESCE(SUM(o.subtotal) FILTER (WHERE ${PAID_SQL}),0)::float8 AS "productRevenue",
        COALESCE(SUM(o.shipping) FILTER (WHERE ${PAID_SQL}),0)::float8 AS shipping,
        0 AS "itemsSold"
       FROM stores s LEFT JOIN orders o ON o.store_id=s.id AND ${where.sql}
       ${storeId ? 'WHERE s.id=?' : ''}
       GROUP BY s.id, s.name ORDER BY revenue DESC, s.name`,
    )
    .bind(...where.values, ...(storeId ? [storeId] : []))
    .all<StoreSales>();

  const bucket =
    period.unit === 'month'
      ? `to_char(${WIB_DAY}, 'YYYY-MM')`
      : `to_char(${WIB_DAY}, 'YYYY-MM-DD')`;
  const { results: trendRows } = await d1
    .prepare(
      `SELECT ${bucket} AS period, COUNT(*)::int AS orders,
        COUNT(*) FILTER (WHERE ${PAID_SQL})::int AS "paidOrders",
        COALESCE(SUM(o.total) FILTER (WHERE ${PAID_SQL}),0)::float8 AS revenue
       FROM orders o WHERE ${where.sql} GROUP BY 1`,
    )
    .bind(...where.values)
    .all<{
      period: string;
      orders: number;
      paidOrders: number;
      revenue: number;
    }>();

  const { results: statusRows } = await d1
    .prepare(
      `SELECT o.status, COUNT(*)::int AS count FROM orders o WHERE ${where.sql} GROUP BY o.status`,
    )
    .bind(...where.values)
    .all<{ status: string; count: number }>();

  // Items sold per product (from the order snapshot), paid orders only.
  const { results: productRows } = await d1
    .prepare(
      `SELECT o.store_id AS "storeId", s.name AS "storeName",
        COALESCE(item->>'id','') AS "productId", COALESCE(item->>'name','') AS name,
        SUM(COALESCE((item->>'quantity')::numeric,0))::float8 AS quantity,
        SUM(COALESCE((item->>'price')::numeric,0) * COALESCE((item->>'quantity')::numeric,0))::float8 AS revenue
       FROM orders o JOIN stores s ON s.id=o.store_id
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(o.items_json::jsonb)='array' THEN o.items_json::jsonb ELSE '[]'::jsonb END
       ) AS item
       WHERE ${where.sql} AND ${PAID_SQL}
       GROUP BY 1,2,3,4`,
    )
    .bind(...where.values)
    .all<{
      storeId: string;
      storeName: string;
      productId: string;
      name: string;
      quantity: number;
      revenue: number;
    }>();

  // Money by payment method (paid orders) and the value still open or lost.
  const { results: paymentRows } = await d1
    .prepare(
      `SELECT o.payment_method AS method, COUNT(*)::int AS orders,
        COALESCE(SUM(o.total),0)::float8 AS revenue
       FROM orders o WHERE ${where.sql} AND ${PAID_SQL} GROUP BY 1 ORDER BY 3 DESC`,
    )
    .bind(...where.values)
    .all<{ method: string; orders: number; revenue: number }>();
  const open = await d1
    .prepare(
      `SELECT COALESCE(SUM(o.total) FILTER (WHERE o.status='menunggu_pembayaran'),0)::float8 AS pending,
        COALESCE(SUM(o.total) FILTER (WHERE o.status='dibatalkan'),0)::float8 AS cancelled
       FROM orders o WHERE ${where.sql}`,
    )
    .bind(...where.values)
    .first<{ pending: number; cancelled: number }>();

  for (const store of stores)
    store.itemsSold = productRows
      .filter((row) => row.storeId === store.storeId)
      .reduce((sum, row) => sum + row.quantity, 0);

  const sum = (key: keyof Omit<StoreSales, 'storeId' | 'storeName'>) =>
    stores.reduce((total, store) => total + store[key], 0);
  const paidOrders = sum('paidOrders');
  const revenue = sum('revenue');
  const summary = {
    orders: sum('orders'),
    paidOrders,
    pending: sum('pending'),
    cancelled: sum('cancelled'),
    revenue,
    productRevenue: sum('productRevenue'),
    shipping: sum('shipping'),
    itemsSold: sum('itemsSold'),
    averageOrder: paidOrders ? Math.round(revenue / paidOrders) : 0,
  };

  return {
    period,
    summary,
    stores,
    trend: fillTrend(period, trendRows),
    statuses: Object.fromEntries(
      statusRows.map((row) => [row.status, row.count]),
    ),
    topProducts: productRows
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 10),
    finance: {
      byPayment: paymentRows.map((row) => ({
        ...row,
        label: PAYMENT_LABELS[row.method] ?? row.method,
      })),
      pendingValue: open?.pending ?? 0,
      cancelledValue: open?.cancelled ?? 0,
    },
  };
}

const PAYMENT_LABELS: Record<string, string> = {
  manual: 'Transfer manual',
  midtrans: 'Midtrans (VA / QRIS)',
};

// ---- Product sales ---------------------------------------------------------

export type ProductSale = {
  storeId: string;
  storeName: string;
  productId: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  orders: number;
};

/** Every product sold in the period (paid orders), with its current category. */
export async function buildProductSales(
  storeId: string | null,
  period: ReportPeriod,
) {
  const where = orderConditions(storeId, period);
  const { results } = await getD1()
    .prepare(
      `SELECT o.store_id AS "storeId", s.name AS "storeName",
        COALESCE(item->>'id','') AS "productId", COALESCE(item->>'name','') AS name,
        COALESCE(MAX(p.category),'') AS category,
        SUM(COALESCE((item->>'quantity')::numeric,0))::float8 AS quantity,
        SUM(COALESCE((item->>'price')::numeric,0) * COALESCE((item->>'quantity')::numeric,0))::float8 AS revenue,
        COUNT(DISTINCT o.id)::int AS orders
       FROM orders o JOIN stores s ON s.id=o.store_id
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(o.items_json::jsonb)='array' THEN o.items_json::jsonb ELSE '[]'::jsonb END
       ) AS item
       LEFT JOIN products p ON p.store_id=o.store_id AND p.id=item->>'id'
       WHERE ${where.sql} AND ${PAID_SQL}
       GROUP BY 1,2,3,4
       ORDER BY quantity DESC, revenue DESC
       LIMIT ${EXPORT_LIMIT}`,
    )
    .bind(...where.values)
    .all<ProductSale>();
  const categories = new Map<
    string,
    { category: string; quantity: number; revenue: number }
  >();
  for (const row of results) {
    const key = row.category || 'Tanpa kategori';
    const entry = categories.get(key) ?? {
      category: key,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += row.quantity;
    entry.revenue += row.revenue;
    categories.set(key, entry);
  }
  const quantity = results.reduce((sum, row) => sum + row.quantity, 0);
  const revenue = results.reduce((sum, row) => sum + row.revenue, 0);
  return {
    period,
    summary: { products: results.length, quantity, revenue },
    products: results,
    categories: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
  };
}

// ---- Inventory -------------------------------------------------------------

export const LOW_STOCK = 5;

export type StockLine = {
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
};

/** Current stock per variant of every product that is not deleted. */
export async function buildInventory(storeId: string | null) {
  const { results } = await getD1()
    .prepare(
      `SELECT p.store_id AS "storeId", s.name AS "storeName", p.id AS "productId", p.name,
        p.category, p.variants_json AS "variantsJson", p.price, p.stock,
        p.sold_count AS "soldCount", p.preorder_enabled AS preorder, p.active
       FROM products p JOIN stores s ON s.id=p.store_id
       WHERE p.deleted_at IS NULL ${storeId ? 'AND p.store_id=?' : ''}
       ORDER BY s.name, p.category, p.name`,
    )
    .bind(...(storeId ? [storeId] : []))
    .all<{
      storeId: string;
      storeName: string;
      productId: string;
      name: string;
      category: string;
      variantsJson: string;
      price: number;
      stock: number;
      soldCount: number;
      preorder: number;
      active: number;
    }>();
  const lines: StockLine[] = [];
  for (const product of results) {
    let variants: {
      sku?: string;
      color?: string;
      size?: string;
      price?: number;
      stock?: number;
    }[] = [];
    try {
      const parsed = JSON.parse(product.variantsJson || '[]') as unknown;
      if (Array.isArray(parsed)) variants = parsed as typeof variants;
    } catch {}
    if (!variants.length)
      variants = [{ price: product.price, stock: product.stock }];
    for (const variant of variants) {
      const stock = Math.max(0, Number(variant.stock) || 0);
      const price = Number(variant.price) || product.price || 0;
      lines.push({
        storeId: product.storeId,
        storeName: product.storeName,
        productId: product.productId,
        name: product.name,
        category: product.category,
        variant: [variant.color, variant.size].filter(Boolean).join(' / '),
        sku: variant.sku ?? '',
        price,
        stock,
        value: price * stock,
        soldCount: product.soldCount || 0,
        preorder: Boolean(product.preorder),
        active: Boolean(product.active),
        status: stock <= 0 ? 'habis' : stock <= LOW_STOCK ? 'menipis' : 'aman',
      });
    }
  }
  const count = (status: StockLine['status']) =>
    lines.filter((line) => line.active && line.status === status).length;
  return {
    summary: {
      products: results.length,
      variants: lines.length,
      units: lines.reduce((sum, line) => sum + line.stock, 0),
      value: lines.reduce((sum, line) => sum + line.value, 0),
      outOfStock: count('habis'),
      lowStock: count('menipis'),
      lowStockLimit: LOW_STOCK,
    },
    lines,
  };
}

/** One entry per day/month of the period, zero when there were no orders. */
function fillTrend(
  period: ReportPeriod,
  rows: {
    period: string;
    orders: number;
    paidOrders: number;
    revenue: number;
  }[],
) {
  const found = new Map(rows.map((row) => [row.period, row]));
  const keys: string[] = [];
  if (period.unit === 'day')
    for (
      let day = parseDay(period.from);
      day <= parseDay(period.to);
      day += DAY_MS
    )
      keys.push(formatDay(day));
  else {
    const [endYear, endMonth] = period.to.split('-').map(Number);
    let [year, month] = period.from.split('-').map(Number);
    while (year < endYear || (year === endYear && month <= endMonth)) {
      keys.push(`${year}-${String(month).padStart(2, '0')}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return keys.map((key) => ({
    period: key,
    orders: found.get(key)?.orders ?? 0,
    paidOrders: found.get(key)?.paidOrders ?? 0,
    revenue: found.get(key)?.revenue ?? 0,
  }));
}

const STATUS_LABELS: Record<string, string> = {
  menunggu_pembayaran: 'Menunggu pembayaran',
  dibayar: 'Sudah dibayar',
  diproses: 'Diproses',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

/** A CSV cell; formulas are neutralised so spreadsheets never execute them. */
function cell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Orders of the period as CSV (semicolon-separated with a BOM, so Excel with
 * Indonesian regional settings opens it in columns).
 */
export async function exportOrdersCsv(
  storeId: string | null,
  period: ReportPeriod,
) {
  const where = orderConditions(storeId, period);
  const { results } = await getD1()
    .prepare(
      `SELECT to_char((o.created_at)::timestamptz AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') AS "createdAt",
        s.name AS "storeName", o.order_number AS "orderNumber", o.customer_name AS "customerName",
        o.customer_phone AS "customerPhone", o.status, o.payment_method AS "paymentMethod",
        o.subtotal, o.shipping, o.total, o.items_json AS "itemsJson"
       FROM orders o JOIN stores s ON s.id=o.store_id
       WHERE ${where.sql} ORDER BY o.created_at, o.id LIMIT ${EXPORT_LIMIT}`,
    )
    .bind(...where.values)
    .all<{
      createdAt: string;
      storeName: string;
      orderNumber: string;
      customerName: string;
      customerPhone: string;
      status: string;
      paymentMethod: string;
      subtotal: number;
      shipping: number;
      total: number;
      itemsJson: string;
    }>();
  const header = [
    'Tanggal (WIB)',
    'Website',
    'No. pesanan',
    'Pelanggan',
    'Telepon',
    'Status',
    'Dibayar',
    'Metode',
    'Subtotal',
    'Ongkir',
    'Total',
    'Barang',
  ];
  const lines = results.map((order) => {
    let items = '';
    try {
      items = (
        JSON.parse(order.itemsJson) as { name?: string; quantity?: number }[]
      )
        .map((item) => `${item.quantity ?? 0}x ${item.name ?? ''}`)
        .join(', ');
    } catch {}
    return [
      order.createdAt,
      order.storeName,
      order.orderNumber,
      order.customerName,
      order.customerPhone,
      STATUS_LABELS[order.status] ?? order.status,
      PAID_STATUSES.includes(order.status) ? 'Ya' : 'Tidak',
      order.paymentMethod === 'midtrans' ? 'Midtrans' : 'Transfer manual',
      order.subtotal,
      order.shipping,
      order.total,
      items,
    ]
      .map(cell)
      .join(';');
  });
  return `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`;
}

const csv = (header: string[], rows: (string | number)[][]) =>
  `\uFEFF${[header.join(';'), ...rows.map((row) => row.map(cell).join(';'))].join('\r\n')}\r\n`;

export async function exportProductSalesCsv(
  storeId: string | null,
  period: ReportPeriod,
) {
  const { products } = await buildProductSales(storeId, period);
  return csv(
    ['Website', 'Produk', 'Kategori', 'Terjual', 'Penjualan', 'Jumlah pesanan'],
    products.map((row) => [
      row.storeName,
      row.name,
      row.category,
      row.quantity,
      row.revenue,
      row.orders,
    ]),
  );
}

const STOCK_LABELS = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' };

export async function exportInventoryCsv(storeId: string | null) {
  const { lines } = await buildInventory(storeId);
  return csv(
    [
      'Website',
      'Produk',
      'Kategori',
      'Varian',
      'SKU',
      'Harga',
      'Stok',
      'Nilai stok',
      'Terjual (total)',
      'Status',
      'Aktif',
    ],
    lines.map((line) => [
      line.storeName,
      line.name,
      line.category,
      line.variant,
      line.sku,
      line.price,
      line.stock,
      line.value,
      line.soldCount,
      line.preorder ? 'Pre-order' : STOCK_LABELS[line.status],
      line.active ? 'Ya' : 'Tidak',
    ]),
  );
}

/** Response for a CSV download. */
export function csvResponse(csv: string, name: string, period: ReportPeriod) {
  const file = `laporan-${name}-${period.from}-sd-${period.to}.csv`.replace(
    /[^a-z0-9.-]+/gi,
    '-',
  );
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'no-store',
    },
  });
}

/**
 * GET handler shared by /api/admin/reports (one store) and
 * /api/platform/reports (storeId null = every store).
 *   ?report=finance (default) | products | inventory, &format=csv to download
 */
export async function reportResponse(
  storeId: string | null,
  params: URLSearchParams,
  fileName: string,
) {
  const period = readPeriod(params);
  const report = params.get('report') || 'finance';
  const download = params.get('format') === 'csv';
  if (report === 'products')
    return download
      ? csvResponse(
          await exportProductSalesCsv(storeId, period),
          `penjualan-produk-${fileName}`,
          period,
        )
      : Response.json(await buildProductSales(storeId, period), {
          headers: { 'cache-control': 'no-store' },
        });
  if (report === 'inventory')
    return download
      ? csvResponse(
          await exportInventoryCsv(storeId),
          `stok-${fileName}`,
          period,
        )
      : Response.json(await buildInventory(storeId), {
          headers: { 'cache-control': 'no-store' },
        });
  if (report !== 'finance')
    throw new ReportError('Jenis laporan tidak dikenal.');
  return download
    ? csvResponse(await exportOrdersCsv(storeId, period), fileName, period)
    : Response.json(await buildReport(storeId, period), {
        headers: { 'cache-control': 'no-store' },
      });
}
