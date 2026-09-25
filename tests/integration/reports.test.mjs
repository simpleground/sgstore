// Multi-store phase 8: sales reports per store (admin) and across stores (platform).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminCookie,
  adminLogin,
  call,
  createStoreAdmin,
  db,
} from './helpers.mjs';

const STORE = 'it-store-report';
const HOST = 'toko-laporan.platform.test';
const PERIOD = 'from=2025-02-01&to=2025-02-03';
const s = {};

async function insertOrder(storeId, orderNumber, order) {
  await db.query(
    `INSERT INTO orders (store_id,order_number,customer_name,customer_phone,shipping_address,items_json,
       subtotal,shipping,total,payment_method,status,created_at,updated_at)
     VALUES ($1,$2,$3,'081200000000','Jalan Uji 1',$4,$5,$6,$7,'manual',$8,$9,$9)`,
    [
      storeId,
      orderNumber,
      order.name ?? 'Pembeli Laporan',
      JSON.stringify(order.items),
      order.subtotal,
      order.shipping,
      order.subtotal + order.shipping,
      order.status,
      order.createdAt,
    ],
  );
}

before(async () => {
  await db.query(
    "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ($1,'toko-laporan','Toko Laporan','t','t')",
    [STORE],
  );
  await insertOrder(STORE, 'RPT-1', {
    status: 'dibayar',
    createdAt: '2025-02-01T03:00:00.000Z',
    subtotal: 100000,
    shipping: 10000,
    items: [{ id: 'p1', name: 'Kaos', price: 50000, quantity: 2 }],
  });
  // 17:30 UTC on 1 Feb is 00:30 WIB on 2 Feb: the report counts it on 2 Feb.
  await insertOrder(STORE, 'RPT-2', {
    status: 'selesai',
    createdAt: '2025-02-01T17:30:00.000Z',
    subtotal: 60000,
    shipping: 5000,
    items: [{ id: 'p2', name: 'Topi', price: 20000, quantity: 3 }],
  });
  await insertOrder(STORE, 'RPT-3', {
    status: 'menunggu_pembayaran',
    createdAt: '2025-02-03T03:00:00.000Z',
    subtotal: 50000,
    shipping: 0,
    items: [{ id: 'p1', name: 'Kaos', price: 50000, quantity: 1 }],
  });
  await insertOrder(STORE, 'RPT-4', {
    status: 'dibatalkan',
    createdAt: '2025-02-03T04:00:00.000Z',
    subtotal: 20000,
    shipping: 0,
    name: '=HYPERLINK("http://jahat.test")',
    items: [{ id: 'p2', name: 'Topi', price: 20000, quantity: 1 }],
  });
  // Outside the period.
  await insertOrder(STORE, 'RPT-5', {
    status: 'dibayar',
    createdAt: '2025-02-05T03:00:00.000Z',
    subtotal: 999000,
    shipping: 0,
    items: [{ id: 'p1', name: 'Kaos', price: 999000, quantity: 1 }],
  });
  await insertOrder('default', 'RPT-DEF', {
    status: 'dibayar',
    createdAt: '2025-02-02T03:00:00.000Z',
    subtotal: 30000,
    shipping: 0,
    items: [{ id: 'd1', name: 'Apron', price: 30000, quantity: 1 }],
  });

  s.superCookie = await adminCookie();
  for (const role of ['store_owner', 'store_staff']) {
    const account = await createStoreAdmin(STORE, role);
    s[role] = (await adminLogin({ ...account, host: HOST })).cookie;
  }
});

after(() => db.end());

const platform = (query) =>
  call(`/api/platform/reports?${query}`, { cookie: s.superCookie });

describe('laporan satu website', () => {
  it('ringkasan hanya menghitung pesanan dibayar di periode', async () => {
    const response = await platform(`store=${STORE}&${PERIOD}`);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.summary, {
      orders: 4,
      paidOrders: 2,
      pending: 1,
      cancelled: 1,
      revenue: 175000,
      productRevenue: 160000,
      shipping: 15000,
      itemsSold: 5,
      averageOrder: 87500,
    });
    assert.equal(response.body.stores.length, 1);
    assert.deepEqual(response.body.statuses, {
      dibayar: 1,
      selesai: 1,
      menunggu_pembayaran: 1,
      dibatalkan: 1,
    });
  });

  it('tren harian memakai hari WIB dan mengisi hari tanpa penjualan', async () => {
    const { body } = await platform(`store=${STORE}&${PERIOD}`);
    assert.equal(body.period.unit, 'day');
    assert.deepEqual(
      body.trend.map((day) => [day.period, day.revenue, day.orders]),
      [
        ['2025-02-01', 110000, 1],
        ['2025-02-02', 65000, 1],
        ['2025-02-03', 0, 2],
      ],
    );
  });

  it('periode panjang dikelompokkan per bulan', async () => {
    const { body } = await platform(
      `store=${STORE}&from=2024-12-15&to=2025-03-10`,
    );
    assert.equal(body.period.unit, 'day');
    const long = await platform(`store=${STORE}&from=2024-11-01&to=2025-03-10`);
    assert.equal(long.body.period.unit, 'month');
    assert.deepEqual(
      long.body.trend.map((month) => [month.period, month.revenue]),
      [
        ['2024-11', 0],
        ['2024-12', 0],
        ['2025-01', 0],
        ['2025-02', 1174000],
        ['2025-03', 0],
      ],
    );
  });

  it('produk terlaris dari pesanan dibayar', async () => {
    const { body } = await platform(`store=${STORE}&${PERIOD}`);
    assert.deepEqual(
      body.topProducts.map((product) => [
        product.name,
        product.quantity,
        product.revenue,
      ]),
      [
        ['Topi', 3, 60000],
        ['Kaos', 2, 100000],
      ],
    );
  });
});

describe('laporan semua website', () => {
  it('menjumlahkan semua toko dan membandingkan per website', async () => {
    const { body } = await platform(PERIOD);
    const byStore = Object.fromEntries(
      body.stores.map((store) => [store.storeId, store]),
    );
    assert.equal(byStore[STORE].revenue, 175000);
    assert.equal(byStore.default.revenue >= 30000, true);
    assert.equal(
      body.summary.revenue,
      body.stores.reduce((sum, store) => sum + store.revenue, 0),
    );
    // Stores without orders are listed too (for comparison).
    assert.ok(body.stores.length >= 2);
  });

  it('parameter tidak valid ditolak', async () => {
    assert.equal((await platform('from=2025-13-01')).status, 400);
    assert.equal((await platform('from=2025-02-05&to=2025-02-01')).status, 400);
    assert.equal((await platform('from=2020-01-01&to=2025-02-01')).status, 400);
    assert.equal((await platform('store=tidak-ada')).status, 404);
  });
});

describe('ekspor CSV', () => {
  it('berisi pesanan periode & website yang dipilih, aman dibuka di Excel', async () => {
    const response = await platform(`store=${STORE}&${PERIOD}&format=csv`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/csv/);
    assert.match(
      response.headers.get('content-disposition'),
      /attachment; filename="laporan-toko-2025-02-01-sd-2025-02-03\.csv"/,
    );
    const text = response.text;
    assert.ok(text.startsWith('﻿Tanggal (WIB);Website;No. pesanan'));
    const lines = text.trim().split('\r\n');
    assert.equal(lines.length, 5);
    assert.ok(lines[1].startsWith('2025-02-01 10:00;Toko Laporan;RPT-1;'));
    assert.ok(lines[2].startsWith('2025-02-02 00:30;Toko Laporan;RPT-2;'));
    assert.ok(!text.includes('RPT-5') && !text.includes('RPT-DEF'));
    assert.ok(text.includes(`"'=HYPERLINK(""http://jahat.test"")"`));
  });
});

describe('laporan di admin toko', () => {
  it('pemilik melihat laporan tokonya sendiri saja', async () => {
    const response = await call(`/api/admin/reports?${PERIOD}&store=default`, {
      host: HOST,
      cookie: s.store_owner,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.summary.revenue, 175000);
    assert.deepEqual(
      response.body.stores.map((store) => store.storeId),
      [STORE],
    );
    const csv = await call(`/api/admin/reports?${PERIOD}&format=csv`, {
      host: HOST,
      cookie: s.store_owner,
    });
    assert.ok(csv.text.includes('RPT-1') && !csv.text.includes('RPT-DEF'));
  });

  it('staf dan admin toko tidak bisa membuka laporan platform', async () => {
    assert.equal(
      (
        await call(`/api/admin/reports?${PERIOD}`, {
          host: HOST,
          cookie: s.store_staff,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(`/api/platform/reports?${PERIOD}`, {
          host: HOST,
          cookie: s.store_owner,
        })
      ).status,
      403,
    );
    assert.equal((await call(`/api/platform/reports?${PERIOD}`)).status, 403);
  });

  it('tab Laporan tersedia di panel platform', async () => {
    const page = await call('/platform?tab=laporan', { cookie: s.superCookie });
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('Laporan penjualan'));
  });
});
