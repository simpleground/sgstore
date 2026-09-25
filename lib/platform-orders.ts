/**
 * Platform order center: orders of every store in one list for the platform
 * super_admin (callers must check requireSuperAdmin() first). The store filter
 * is only a filter; every change is still scoped with store_id + order_number.
 */
import { getD1 } from '@/db';
import {
  isOrderStatus,
  ORDER_STATUSES,
  type OrderStatus,
} from '@/lib/order-status';
import { PlatformError } from '@/lib/platform';
import { getStoreSettings } from '@/lib/store-settings';

export const PAGE_SIZE = 25;

export type PlatformOrder = {
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

/** Store contact printed as the sender on shipping labels. */
export type OrderSender = { name: string; phone: string; address: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-mm-dd in WIB → ISO timestamp (UTC) of the start of that day (+ days). */
function wibDayStart(value: string, addDays = 0) {
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime()))
    throw new PlatformError('Tanggal tidak valid.');
  date.setUTCDate(date.getUTCDate() + addDays);
  return date.toISOString();
}

export type OrderFilter = {
  storeId: string;
  status: string;
  q: string;
  from: string;
  to: string;
};

/** Reads and validates the filter from the query string. */
export function readOrderFilter(params: URLSearchParams): OrderFilter {
  const text = (name: string, max: number) =>
    (params.get(name) ?? '').trim().slice(0, max);
  const filter = {
    storeId: text('store', 100),
    status: text('status', 40),
    q: text('q', 100),
    from: text('from', 10),
    to: text('to', 10),
  };
  if (filter.status && !isOrderStatus(filter.status))
    throw new PlatformError('Status pesanan tidak valid.');
  for (const value of [filter.from, filter.to])
    if (value && !DATE.test(value))
      throw new PlatformError('Tanggal tidak valid.');
  return filter;
}

/** WHERE clause for the filter; `status` is left out when includeStatus is false. */
function where(filter: OrderFilter, includeStatus = true) {
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  if (filter.storeId) {
    clauses.push('o.store_id=?');
    values.push(filter.storeId);
  }
  if (includeStatus && filter.status) {
    clauses.push('o.status=?');
    values.push(filter.status);
  }
  if (filter.q) {
    const like = `%${filter.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    clauses.push(
      '(LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ? OR o.customer_phone LIKE ?)',
    );
    values.push(like, like, like);
  }
  if (filter.from) {
    clauses.push('o.created_at>=?');
    values.push(wibDayStart(filter.from));
  }
  if (filter.to) {
    clauses.push('o.created_at<?');
    values.push(wibDayStart(filter.to, 1));
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

async function assertStore(storeId: string) {
  if (
    storeId &&
    !(await getD1()
      .prepare('SELECT 1 FROM stores WHERE id=?')
      .bind(storeId)
      .first())
  )
    throw new PlatformError('Toko tidak ditemukan.', 404);
}

export async function listPlatformOrders(
  filter: OrderFilter,
  pageInput: number,
) {
  await assertStore(filter.storeId);
  const d1 = getD1();
  const filtered = where(filter);
  const total =
    (await d1
      .prepare(`SELECT COUNT(*)::int AS count FROM orders o ${filtered.sql}`)
      .bind(...filtered.values)
      .first<number>('count')) ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(pageInput) || 1), pages);
  const { results } = await d1
    .prepare(
      `SELECT o.store_id AS "storeId", s.name AS "storeName", s.slug AS "storeSlug",
        o.order_number AS "orderNumber", o.customer_name AS "customerName",
        o.customer_phone AS "customerPhone", o.shipping_address AS "shippingAddress",
        o.items_json AS "itemsJson", o.subtotal, o.shipping, o.total,
        o.payment_method AS "paymentMethod", o.status, o.created_at AS "createdAt"
       FROM orders o JOIN stores s ON s.id=o.store_id
       ${filtered.sql}
       ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...filtered.values, PAGE_SIZE, (page - 1) * PAGE_SIZE)
    .all<PlatformOrder>();

  // Counts per status for the same store/search/date filter (ignoring the status filter).
  const counted = where(filter, false);
  const { results: statusRows } = await d1
    .prepare(
      `SELECT o.status, COUNT(*)::int AS count FROM orders o ${counted.sql} GROUP BY o.status`,
    )
    .bind(...counted.values)
    .all<{ status: string; count: number }>();
  const statusCounts = Object.fromEntries(
    ORDER_STATUSES.map((status) => [
      status,
      statusRows.find((row) => row.status === status)?.count ?? 0,
    ]),
  ) as Record<OrderStatus, number>;

  return {
    orders: results,
    senders: await senders(results.map((order) => order.storeId)),
    total,
    page,
    pages,
    statusCounts,
  };
}

/** Label sender (name, phone, address) of each store on the page. */
async function senders(storeIds: string[]) {
  const ids = [...new Set(storeIds)];
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, OrderSender]> => {
      const [store, settings] = await Promise.all([
        getD1()
          .prepare('SELECT name, phone, address FROM stores WHERE id=?')
          .bind(id)
          .first<{
            name: string;
            phone: string | null;
            address: string | null;
          }>(),
        getStoreSettings(id),
      ]);
      const whatsapp = settings.whatsapp.startsWith('62')
        ? `0${settings.whatsapp.slice(2)}`
        : settings.whatsapp;
      return [
        id,
        {
          name: store?.name ?? '',
          phone: store?.phone || whatsapp,
          address: store?.address ?? '',
        },
      ];
    }),
  );
  return Object.fromEntries(entries) as Record<string, OrderSender>;
}

/** Changes an order's status. Returns the previous status. */
export async function updatePlatformOrderStatus(input: {
  storeId?: unknown;
  orderNumber?: unknown;
  status?: unknown;
}) {
  const { storeId, orderNumber, status } = input;
  if (
    typeof storeId !== 'string' ||
    !storeId ||
    typeof orderNumber !== 'string' ||
    !orderNumber ||
    !isOrderStatus(status)
  )
    throw new PlatformError('Data tidak valid.');
  const d1 = getD1();
  const previous = await d1
    .prepare('SELECT status FROM orders WHERE order_number=? AND store_id=?')
    .bind(orderNumber, storeId)
    .first<string>('status');
  if (!previous) throw new PlatformError('Pesanan tidak ditemukan.', 404);
  await d1
    .prepare(
      'UPDATE orders SET status=?, updated_at=? WHERE order_number=? AND store_id=?',
    )
    .bind(status, new Date().toISOString(), orderNumber, storeId)
    .run();
  return { storeId, orderNumber, previous, status };
}
