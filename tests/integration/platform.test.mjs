// Multi-store phase 6: platform console (super admin), domains, store status.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminCookie,
  adminLogin,
  call,
  createStoreAdmin,
  db,
  enableManualPayment,
  orderBody,
  productForm,
} from './helpers.mjs';

const s = {};
const platform = (path, method = 'GET', json) =>
  call(`/api/platform${path}`, { method, json, cookie: s.superCookie });

before(async () => {
  s.superCookie = await adminCookie();
  s.storeAdmin = await createStoreAdmin('default');
  s.storeAdmin.cookie = (await adminLogin(s.storeAdmin)).cookie;
});

after(() => db.end());

describe('akses panel platform', () => {
  it('admin toko biasa ditolak', async () => {
    const list = await call('/api/platform/stores', {
      cookie: s.storeAdmin.cookie,
    });
    assert.equal(list.status, 403);
    const create = await call('/api/platform/stores', {
      method: 'POST',
      cookie: s.storeAdmin.cookie,
      json: {
        name: 'Toko Liar',
        slug: 'toko-liar',
        ownerEmail: 'x@integration.test',
      },
    });
    assert.equal(create.status, 403);
    const page = await call('/platform', { cookie: s.storeAdmin.cookie });
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('Khusus admin platform'));
  });

  it('tanpa login diarahkan ke halaman login', async () => {
    assert.equal((await call('/api/platform/stores')).status, 403);
    const page = await call('/platform');
    assert.match(
      page.headers.get('location') || '',
      /\/admin\/login\?next=%2Fplatform|\/admin\/login\?next=\/platform/,
    );
  });

  it('super admin melihat semua toko', async () => {
    const response = await platform('/stores');
    assert.equal(response.status, 200);
    const simpleGround = response.body.stores.find(
      (store) => store.id === 'default',
    );
    assert.equal(simpleGround.slug, 'simple-ground');
    assert.equal(response.body.rootDomain, 'platform.test');
  });
});

describe('membuat toko', () => {
  it('slug & data yang tidak valid ditolak', async () => {
    for (const [label, json] of [
      [
        'slug huruf besar/spasi',
        { name: 'Toko', slug: 'Toko Baru', ownerEmail: 'a@integration.test' },
      ],
      [
        'slug dicadangkan',
        { name: 'Toko', slug: 'admin', ownerEmail: 'a@integration.test' },
      ],
      [
        'slug terlalu pendek',
        { name: 'Toko', slug: 'ab', ownerEmail: 'a@integration.test' },
      ],
      [
        'email salah',
        { name: 'Toko', slug: 'toko-valid', ownerEmail: 'bukan-email' },
      ],
      [
        'domain = domain platform',
        {
          name: 'Toko',
          slug: 'toko-valid',
          ownerEmail: 'a@integration.test',
          domain: 'platform.test',
        },
      ],
      [
        'domain berisi https://',
        {
          name: 'Toko',
          slug: 'toko-valid',
          ownerEmail: 'a@integration.test',
          domain: 'https://x.com/',
        },
      ],
    ])
      assert.equal(
        (await platform('/stores', 'POST', json)).status,
        400,
        label,
      );
    assert.equal(
      (
        await platform('/stores', 'POST', {
          name: 'Kembar',
          slug: 'simple-ground',
          ownerEmail: 'a@integration.test',
        })
      ).status,
      409,
    );
  });

  it('toko baru dibuat dengan pemilik tanpa password', async () => {
    const response = await platform('/stores', 'POST', {
      name: 'Kopi Senja',
      slug: 'kopi-senja',
      ownerEmail: 'Pemilik@KopiSenja.test',
      domain: 'kopisenja.test',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    s.store = response.body.store;
    assert.equal(s.store.owner.email, 'pemilik@kopisenja.test');
    assert.equal(s.store.owner.newAccount, true);
    const { rows } = await db.query(
      `SELECT a.password_hash, m.role FROM admin_users a JOIN store_memberships m ON m.user_id=a.user_id
       WHERE m.store_id=$1`,
      [s.store.id],
    );
    assert.deepEqual(rows, [{ password_hash: null, role: 'store_owner' }]);
  });

  it('langsung bisa dibuka lewat subdomain & domain sendiri', async () => {
    for (const host of [
      'kopi-senja.platform.test',
      'kopisenja.test',
      'www.kopisenja.test',
    ]) {
      const home = await call('/', { host });
      assert.equal(home.status, 200, host);
      assert.ok(home.text.includes('Selamat datang di Kopi Senja.'), host);
    }
    // No categories, links or texts of another store (it has no products yet).
    const home = await call('/', { host: 'kopisenja.test' });
    for (const text of [
      'Chef &amp; Kitchen Wear',
      'Koleksi Daily',
      'Simple Ground',
    ])
      assert.ok(!home.text.includes(text), text);
  });

  it('domain yang sudah dipakai ditolak', async () => {
    const response = await platform('/stores', 'POST', {
      name: 'Peniru',
      slug: 'peniru',
      ownerEmail: 'a@integration.test',
      domain: 'kopisenja.test',
    });
    assert.equal(response.status, 409);
  });

  it('akun yang sudah ada dijadikan pemilik tanpa mengubah passwordnya', async () => {
    const before = (
      await db.query('SELECT password_hash FROM admin_users WHERE user_id=$1', [
        s.storeAdmin.userId,
      ])
    ).rows[0];
    const response = await platform(`/stores/${s.store.id}/owners`, 'POST', {
      email: s.storeAdmin.email,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.newAccount, false);
    const after = (
      await db.query('SELECT password_hash FROM admin_users WHERE user_id=$1', [
        s.storeAdmin.userId,
      ])
    ).rows[0];
    assert.deepEqual(after, before);
    const login = await adminLogin({ ...s.storeAdmin, host: 'kopisenja.test' });
    assert.equal(login.status, 200);
    s.ownerCookie = login.cookie;
  });
});

describe('domain', () => {
  it('menambah, menjadikan utama, dan melepas domain', async () => {
    const add = await platform(`/stores/${s.store.id}/domains`, 'POST', {
      host: 'Belanja.KopiSenja.test',
    });
    assert.equal(add.status, 200);
    assert.equal(add.body.host, 'belanja.kopisenja.test');
    assert.equal(
      (
        await platform(`/stores/${s.store.id}/domains`, 'POST', {
          host: 'belanja.kopisenja.test',
        })
      ).status,
      409,
    );
    const primary = await platform(`/stores/${s.store.id}/domains`, 'PATCH', {
      host: 'belanja.kopisenja.test',
    });
    assert.equal(primary.status, 200);
    const { rows } = await db.query(
      'SELECT host FROM store_domains WHERE store_id=$1 AND is_primary=1',
      [s.store.id],
    );
    assert.deepEqual(rows, [{ host: 'belanja.kopisenja.test' }]);
    const remove = await platform(`/stores/${s.store.id}/domains`, 'DELETE', {
      host: 'belanja.kopisenja.test',
    });
    assert.equal(remove.status, 200);
    // A removed custom domain no longer opens this store (falls back to the default store).
    const home = await call('/', { host: 'belanja.kopisenja.test' });
    assert.ok(!home.text.includes('Kopi Senja'));
  });

  it('domain toko lain tidak bisa dilepas lewat toko ini', async () => {
    const response = await platform(`/stores/${s.store.id}/domains`, 'DELETE', {
      host: 'toko-tidak-ada.test',
    });
    assert.equal(response.status, 404);
  });

  it('subdomain yang tidak terdaftar memberi 404', async () => {
    assert.equal(
      (await call('/', { host: 'belum-ada.platform.test' })).status,
      404,
    );
    assert.equal(
      (await call('/checkout', { host: 'belum-ada.platform.test' })).status,
      404,
    );
  });
});

describe('status toko', () => {
  before(async () => {
    await enableManualPayment(s.store.id);
    const product = await call('/api/admin/products', {
      method: 'POST',
      host: 'kopisenja.test',
      cookie: s.ownerCookie,
      form: productForm('Kopi Arabika', { sku: 'K' }),
    });
    s.productId = product.body.id;
    const order = await call('/api/orders', {
      method: 'POST',
      host: 'kopisenja.test',
      json: orderBody(s.productId),
    });
    assert.equal(order.status, 200, JSON.stringify(order.body));
    s.order = order.body;
  });

  it('toko ditangguhkan: etalase tertutup, admin tetap bisa masuk', async () => {
    assert.equal(
      (
        await platform(`/stores/${s.store.id}`, 'PATCH', {
          status: 'suspended',
        })
      ).status,
      200,
    );
    const home = await call('/', { host: 'kopisenja.test' });
    assert.ok(home.text.includes('Toko sedang tidak aktif'));
    assert.ok(home.text.includes('noindex'));
    for (const path of ['/api/products', '/api/reviews'])
      assert.equal(
        (await call(path, { host: 'kopisenja.test' })).status,
        404,
        path,
      );
    const order = await call('/api/orders', {
      method: 'POST',
      host: 'kopisenja.test',
      json: orderBody(s.productId),
    });
    assert.equal(order.status, 404);
    const status = await call(
      `/api/orders/status?order=${encodeURIComponent(s.order.orderNumber)}`,
      {
        host: 'kopisenja.test',
        headers: { authorization: `Bearer ${s.order.paymentAccessToken}` },
      },
    );
    assert.equal(status.status, 200);
    const admin = await call('/api/admin/products', {
      host: 'kopisenja.test',
      cookie: s.ownerCookie,
    });
    assert.equal(admin.status, 200);
  });

  it('toko ditutup: admin toko tidak bisa masuk, super admin tetap bisa', async () => {
    assert.equal(
      (await platform(`/stores/${s.store.id}`, 'PATCH', { status: 'closed' }))
        .status,
      200,
    );
    const home = await call('/', { host: 'kopisenja.test' });
    assert.ok(home.text.includes('sudah tidak beroperasi'));
    assert.equal(
      (
        await call('/api/admin/products', {
          host: 'kopisenja.test',
          cookie: s.ownerCookie,
        })
      ).status,
      403,
    );
    assert.equal(
      (await adminLogin({ ...s.storeAdmin, host: 'kopisenja.test' })).status,
      403,
    );
    const superLogin = await adminLogin({ host: 'kopisenja.test' });
    assert.equal(superLogin.status, 200);
    const list = await call('/api/admin/products', {
      host: 'kopisenja.test',
      cookie: superLogin.cookie,
    });
    assert.equal(list.status, 200);
  });

  it('status tidak valid ditolak; toko bisa diaktifkan kembali', async () => {
    assert.equal(
      (await platform(`/stores/${s.store.id}`, 'PATCH', { status: 'dihapus' }))
        .status,
      400,
    );
    assert.equal(
      (
        await platform(`/stores/${s.store.id}`, 'PATCH', {
          status: 'active',
          name: 'Kopi Senja Baru',
        })
      ).status,
      200,
    );
    const home = await call('/', { host: 'kopisenja.test' });
    assert.ok(home.text.includes('Kopi Senja Baru'));
    assert.equal(
      (await call('/api/products', { host: 'kopisenja.test' })).status,
      200,
    );
  });

  it('toko tidak dikenal ditolak', async () => {
    assert.equal(
      (await platform('/stores/tidak-ada', 'PATCH', { status: 'active' }))
        .status,
      404,
    );
  });
});

describe('catatan aktivitas platform', () => {
  it('tindakan platform tercatat di toko terkait', async () => {
    const { rows } = await db.query(
      "SELECT action FROM audit_logs WHERE store_id=$1 AND action LIKE 'platform.%' ORDER BY id",
      [s.store.id],
    );
    const actions = rows.map((row) => row.action);
    for (const action of [
      'platform.store.create',
      'platform.owner.add',
      'platform.domain.add',
      'platform.domain.primary',
      'platform.domain.remove',
      'platform.store.update',
    ])
      assert.ok(actions.includes(action), action);
  });
});
