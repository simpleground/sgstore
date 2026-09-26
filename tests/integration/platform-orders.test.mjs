// Multi-store phase 7: platform order center (all stores' orders in one list).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminCookie,
  adminLogin,
  call,
  createStoreAdmin,
  db,
} from './helpers.mjs';

const STORE = 'it-store-orders';
const s = {};
const platform = (path, options = {}) =>
  call(`/api/platform/orders${path}`, { cookie: s.superCookie, ...options });

async function insertOrder(storeId, orderNumber, { status, createdAt, name }) {
  await db.query(
    `INSERT INTO orders (store_id,order_number,customer_name,customer_phone,shipping_address,items_json,
       subtotal,shipping,total,payment_method,status,created_at,updated_at)
     VALUES ($1,$2,$3,'081200000000','Jalan Uji 1',$4,100000,10000,110000,'manual',$5,$6,$6)`,
    [
      storeId,
      orderNumber,
      name,
      JSON.stringify([{ name: 'Kaos', quantity: 2 }]),
      status,
      createdAt,
    ],
  );
}

before(async () => {
  await db.query(
    "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ($1,'toko-pusat','Toko Pusat','t','t')",
    [STORE],
  );
  await insertOrder('default', 'PO-DEF-1', {
    status: 'dibayar',
    createdAt: '2026-01-10T03:00:00.000Z',
    name: 'Budi Default',
  });
  await insertOrder(STORE, 'PO-PST-1', {
    status: 'menunggu_pembayaran',
    createdAt: '2026-01-11T03:00:00.000Z',
    name: 'Sari Pusat',
  });
  // 23:30 WIB on 12 Jan = 16:30 UTC; must count as 12 Jan in the date filter.
  await insertOrder(STORE, 'PO-PST-2', {
    status: 'dibayar',
    createdAt: '2026-01-12T16:30:00.000Z',
    name: 'Joko Pusat',
  });
  s.superCookie = await adminCookie();
  s.owner = await createStoreAdmin(STORE);
  s.owner.cookie = (
    await adminLogin({ ...s.owner, host: 'toko-pusat.platform.test' })
  ).cookie;
});

after(() => db.end());

const numbers = (body) => body.orders.map((order) => order.orderNumber);

describe('akses pusat pesanan', () => {
  it('tanpa login & admin toko biasa ditolak', async () => {
    assert.equal((await call('/api/platform/orders')).status, 403);
    for (const method of ['GET', 'PATCH'])
      assert.equal(
        (
          await call('/api/platform/orders', {
            method,
            cookie: s.owner.cookie,
            host: 'toko-pusat.platform.test',
            json:
              method === 'PATCH'
                ? {
                    storeId: STORE,
                    orderNumber: 'PO-PST-1',
                    status: 'selesai',
                  }
                : undefined,
          })
        ).status,
        403,
        method,
      );
    const { rows } = await db.query(
      "SELECT status FROM orders WHERE order_number='PO-PST-1'",
    );
    assert.equal(rows[0].status, 'menunggu_pembayaran');
  });
});

describe('daftar & filter', () => {
  it('semua website: pesanan dari semua toko beserta nama tokonya', async () => {
    const response = await platform('?q=po-');
    assert.equal(response.status, 200);
    const mine = response.body.orders.filter((order) =>
      order.orderNumber.startsWith('PO-'),
    );
    assert.deepEqual(
      mine.map((order) => [order.orderNumber, order.storeName]),
      [
        ['PO-PST-2', 'Toko Pusat'],
        ['PO-PST-1', 'Toko Pusat'],
        ['PO-DEF-1', 'Simple Ground'],
      ],
    );
    assert.equal(response.body.senders[STORE].name, 'Toko Pusat');
  });

  it('filter per website', async () => {
    const response = await platform(`?store=${STORE}`);
    assert.deepEqual(numbers(response.body), ['PO-PST-2', 'PO-PST-1']);
    assert.equal(response.body.total, 2);
    assert.equal(response.body.statusCounts.dibayar, 1);
    assert.equal(response.body.statusCounts.menunggu_pembayaran, 1);
  });

  it('filter status, pencarian, dan tanggal (WIB)', async () => {
    assert.deepEqual(
      numbers((await platform(`?store=${STORE}&status=dibayar`)).body),
      ['PO-PST-2'],
    );
    assert.deepEqual(numbers((await platform('?q=budi%20def')).body), [
      'PO-DEF-1',
    ]);
    assert.deepEqual(
      numbers(
        (await platform(`?store=${STORE}&from=2026-01-12&to=2026-01-12`)).body,
      ),
      ['PO-PST-2'],
    );
    assert.deepEqual(
      numbers((await platform(`?store=${STORE}&to=2026-01-11`)).body),
      ['PO-PST-1'],
    );
    // LIKE wildcards are matched literally.
    assert.equal((await platform('?q=%25')).body.total, 0);
  });

  it('filter tidak valid ditolak', async () => {
    assert.equal((await platform('?status=dihapus')).status, 400);
    assert.equal((await platform('?from=12-01-2026')).status, 400);
    assert.equal((await platform('?store=tidak-ada')).status, 404);
  });
});

describe('memproses pesanan', () => {
  it('super admin mengubah status pesanan toko mana pun, tercatat di toko itu', async () => {
    const response = await platform('', {
      method: 'PATCH',
      json: { storeId: STORE, orderNumber: 'PO-PST-1', status: 'diproses' },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const { rows } = await db.query(
      "SELECT status FROM orders WHERE order_number='PO-PST-1' AND store_id=$1",
      [STORE],
    );
    assert.equal(rows[0].status, 'diproses');
    const log = await db.query(
      "SELECT store_id, meta_json FROM audit_logs WHERE action='order.status' AND target_id='PO-PST-1'",
    );
    assert.equal(log.rows.length, 1);
    assert.equal(log.rows[0].store_id, STORE);
    assert.deepEqual(JSON.parse(log.rows[0].meta_json), {
      from: 'menunggu_pembayaran',
      to: 'diproses',
      via: 'platform',
    });
  });

  it('pesanan harus cocok dengan tokonya', async () => {
    const response = await platform('', {
      method: 'PATCH',
      json: { storeId: 'default', orderNumber: 'PO-PST-2', status: 'selesai' },
    });
    assert.equal(response.status, 404);
    const { rows } = await db.query(
      "SELECT status FROM orders WHERE order_number='PO-PST-2'",
    );
    assert.equal(rows[0].status, 'dibayar');
  });

  it('data tidak valid ditolak', async () => {
    for (const json of [
      { storeId: STORE, orderNumber: 'PO-PST-2', status: 'dihapus' },
      { storeId: STORE, status: 'selesai' },
      { orderNumber: 'PO-PST-2', status: 'selesai' },
    ])
      assert.equal(
        (await platform('', { method: 'PATCH', json })).status,
        400,
        JSON.stringify(json),
      );
  });

  it('admin toko tetap memproses pesanannya sendiri, bukan milik toko lain', async () => {
    const own = await call('/api/admin/orders', {
      method: 'PATCH',
      host: 'toko-pusat.platform.test',
      cookie: s.owner.cookie,
      json: { orderNumber: 'PO-PST-2', status: 'dikirim' },
    });
    assert.equal(own.status, 200);
    const other = await call('/api/admin/orders', {
      method: 'PATCH',
      host: 'toko-pusat.platform.test',
      cookie: s.owner.cookie,
      json: { orderNumber: 'PO-DEF-1', status: 'selesai' },
    });
    assert.equal(other.status, 404);
  });
});

describe('halaman', () => {
  it('tautan lama panel platform membuka menu Pesanan di dashboard admin', async () => {
    const page = await call('/platform?tab=pesanan', { cookie: s.superCookie });
    assert.equal(page.headers.get('location'), '/admin?section=orders');
  });
});
