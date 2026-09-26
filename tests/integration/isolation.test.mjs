// Multi-store phase 2: data isolation between two stores.
//
// Store A = the default store (plain Host header of the test server).
// Store B = a second store reached as toko-b.platform.test (subdomain) or
//           belanja-b.test (registered custom domain).
// Every attack below is made by a real, logged-in admin or customer of store A
// using ids of store B, and each test re-reads the database to prove store B's
// data did not change.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminLogin,
  call,
  createStoreAdmin,
  enableManualPayment,
  customerCookie,
  db,
  orderBody,
  productForm,
  sha512,
} from './helpers.mjs';

const B = 'toko-b.platform.test';
const B_DOMAIN = 'belanja-b.test';
const STORE_B = 'it-store-b';
const s = {};

async function productRow(id) {
  const { rows } = await db.query('SELECT * FROM products WHERE id=$1', [id]);
  return rows[0];
}

before(async () => {
  const now = new Date().toISOString();
  await db.query(
    "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ($1,'toko-b','Toko B',$2,$2)",
    [STORE_B, now],
  );
  await db.query(
    'INSERT INTO store_domains (host,store_id,is_primary,created_at) VALUES ($1,$2,1,$3)',
    [B_DOMAIN, STORE_B, now],
  );

  await enableManualPayment(STORE_B);
  s.adminA = await createStoreAdmin('default');
  s.adminB = await createStoreAdmin(STORE_B);
  s.cookieA = (await adminLogin(s.adminA)).cookie;
  s.cookieB = (await adminLogin({ ...s.adminB, host: B })).cookie;
  assert.ok(s.cookieA && s.cookieB, 'login admin A dan B');

  const createA = await call('/api/admin/products', {
    method: 'POST',
    cookie: s.cookieA,
    form: productForm('Kaos Toko A', { sku: 'A' }),
  });
  const createB = await call('/api/admin/products', {
    method: 'POST',
    host: B,
    cookie: s.cookieB,
    form: productForm('Kaos Toko B', { category: 'Kategori B', sku: 'B' }),
  });
  assert.equal(createA.status, 200, JSON.stringify(createA.body));
  assert.equal(createB.status, 200, JSON.stringify(createB.body));
  s.productA = createA.body.id;
  s.productB = createB.body.id;

  // The same Google account shops at both stores.
  s.customerA = await customerCookie({
    storeId: 'default',
    userId: 'same-google-sub',
  });
  s.customerB = await customerCookie({
    storeId: STORE_B,
    userId: 'same-google-sub',
  });

  const orderA = await call('/api/orders', {
    method: 'POST',
    json: orderBody(s.productA),
  });
  const orderB = await call('/api/orders', {
    method: 'POST',
    host: B,
    json: orderBody(s.productB),
  });
  assert.equal(orderA.status, 200, JSON.stringify(orderA.body));
  assert.equal(orderB.status, 200, JSON.stringify(orderB.body));
  s.orderA = orderA.body;
  s.orderB = orderB.body;

  const review = await call('/api/reviews', {
    method: 'POST',
    host: B,
    cookie: s.customerB.cookie,
    json: {
      productId: s.productB,
      rating: 4,
      body: 'Ulasan rahasia toko B',
      city: 'Garut',
    },
  });
  assert.equal(review.status, 200, JSON.stringify(review.body));
  s.reviewB = (
    await db.query('SELECT id FROM reviews WHERE product_id=$1', [s.productB])
  ).rows[0].id;
});

after(() => db.end());

describe('data tersimpan di toko yang benar', () => {
  it('produk, pesanan, ulasan memakai toko dari host', async () => {
    assert.equal((await productRow(s.productA)).store_id, 'default');
    assert.equal((await productRow(s.productB)).store_id, STORE_B);
    const { rows } = await db.query(
      'SELECT order_number,store_id FROM orders WHERE order_number = ANY($1) ORDER BY store_id',
      [[s.orderA.orderNumber, s.orderB.orderNumber]],
    );
    assert.deepEqual(
      rows.map((row) => row.store_id),
      ['default', STORE_B],
    );
    const review = await db.query('SELECT store_id FROM reviews WHERE id=$1', [
      s.reviewB,
    ]);
    assert.equal(review.rows[0].store_id, STORE_B);
  });

  it('foto disimpan di folder milik tokonya', async () => {
    const images = (row) => JSON.parse(row.images_json);
    assert.match(
      images(await productRow(s.productA))[0],
      /^stores\/default\/products\//,
    );
    assert.match(
      images(await productRow(s.productB))[0],
      /^stores\/it-store-b\/products\//,
    );
  });

  it('store_id kiriman browser diabaikan', async () => {
    const form = productForm('Kaos Selundupan', { sku: 'X' });
    form.set('store_id', STORE_B);
    form.set('storeId', STORE_B);
    const response = await call('/api/admin/products?store_id=it-store-b', {
      method: 'POST',
      cookie: s.cookieA,
      form,
    });
    assert.equal(response.status, 200);
    assert.equal((await productRow(response.body.id)).store_id, 'default');
  });
});

describe('katalog publik terpisah', () => {
  const ids = (response) => response.body.products.map((product) => product.id);

  it('toko A hanya menampilkan produk A', async () => {
    const list = await call('/api/products');
    assert.ok(ids(list).includes(s.productA));
    assert.ok(!ids(list).includes(s.productB));
  });

  it('toko B (subdomain & domain sendiri) hanya menampilkan produk B', async () => {
    for (const host of [B, B_DOMAIN]) {
      const list = await call('/api/products', { host });
      assert.deepEqual(ids(list), [s.productB], host);
    }
  });

  it('halaman produk toko lain tidak ditemukan', async () => {
    assert.equal((await call('/produk/kaos_toko_b')).status, 404);
    assert.equal((await call('/produk/kaos_toko_b', { host: B })).status, 200);
    assert.equal((await call('/produk/kaos_toko_a', { host: B })).status, 404);
  });

  it('ulasan toko B tidak muncul di toko A', async () => {
    const reviewsA = await call('/api/reviews');
    assert.ok(!reviewsA.body.reviews.some((review) => review.id === s.reviewB));
    const reviewsB = await call('/api/reviews', { host: B });
    assert.ok(reviewsB.body.reviews.some((review) => review.id === s.reviewB));
  });

  it('foto toko B tidak bisa diambil lewat toko A', async () => {
    const [image] = JSON.parse((await productRow(s.productB)).images_json);
    assert.equal((await call(`/api/product-image/${image}`)).status, 404);
    assert.equal(
      (await call(`/api/product-image/${image}`, { host: B })).status,
      200,
    );
  });

  it('subdomain yang tidak terdaftar tidak menampilkan toko mana pun', async () => {
    const host = 'tidak-ada.platform.test';
    assert.equal((await call('/api/products', { host })).status, 404);
    assert.equal((await call('/api/reviews', { host })).status, 404);
    assert.equal((await call('/produk/kaos_toko_a', { host })).status, 404);
    const login = await call('/api/admin/login', {
      method: 'POST',
      host,
      json: { email: s.adminA.email, password: s.adminA.password },
    });
    assert.equal(login.status, 404);
  });
});

describe('admin hanya bisa mengelola tokonya sendiri', () => {
  it('admin B tidak bisa login di toko A (password benar)', async () => {
    assert.equal((await adminLogin(s.adminB)).status, 403);
    assert.equal((await adminLogin({ ...s.adminA, host: B })).status, 403);
  });

  it('cookie admin A tidak berlaku di toko B', async () => {
    const list = await call('/api/admin/products', {
      host: B,
      cookie: s.cookieA,
    });
    assert.equal(list.status, 403);
    const page = await call('/admin', { host: B, cookie: s.cookieA });
    assert.match(page.headers.get('location') || '', /\/admin\/login/);
  });

  it('daftar admin A tidak berisi data toko B', async () => {
    const products = await call('/api/admin/products', { cookie: s.cookieA });
    assert.ok(
      !products.body.products.some((product) => product.id === s.productB),
    );
    const reviews = await call('/api/admin/reviews', { cookie: s.cookieA });
    assert.ok(!reviews.body.reviews.some((review) => review.id === s.reviewB));
    assert.ok(
      !reviews.body.products.some((product) => product.id === s.productB),
    );
    assert.ok(
      !reviews.body.buyers.some(
        (buyer) => buyer.order_number === s.orderB.orderNumber,
      ),
    );
    const page = await call('/admin', { cookie: s.cookieA });
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(s.orderA.orderNumber));
    assert.ok(!page.text.includes(s.orderB.orderNumber));
    const csv = await call(`/api/admin/products/bulk?id=${s.productB}`, {
      cookie: s.cookieA,
    });
    assert.ok(!csv.text.includes('B-M'));
  });

  it('mengubah produk B dengan ID-nya ditolak', async () => {
    const before = await productRow(s.productB);
    const form = productForm('Diretas', { sku: 'H' });
    form.set('id', s.productB);
    form.set('active', 'true');
    const response = await call('/api/admin/products', {
      method: 'PATCH',
      cookie: s.cookieA,
      form,
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await productRow(s.productB), before);
  });

  it('arsip, pulihkan, hapus, hapus permanen produk B ditolak', async () => {
    const before = await productRow(s.productB);
    for (const json of [
      { id: s.productB, active: 0 },
      { id: s.productB, restoreDeleted: true },
    ])
      assert.equal(
        (
          await call('/api/admin/products', {
            method: 'PUT',
            cookie: s.cookieA,
            json,
          })
        ).status,
        400,
      );
    for (const json of [
      { id: s.productB },
      { id: s.productB, permanent: true },
    ])
      assert.equal(
        (
          await call('/api/admin/products', {
            method: 'DELETE',
            cookie: s.cookieA,
            json,
          })
        ).status,
        400,
      );
    assert.deepEqual(await productRow(s.productB), before);
  });

  it('menyalin produk B ke toko A ditolak', async () => {
    const form = new FormData();
    form.set('copyId', s.productB);
    const response = await call('/api/admin/products', {
      method: 'POST',
      cookie: s.cookieA,
      form,
    });
    assert.equal(response.status, 400);
    const { rowCount } = await db.query(
      "SELECT 1 FROM products WHERE name LIKE 'Kaos Toko B (Salinan)%'",
    );
    assert.equal(rowCount, 0);
  });

  it('menggabungkan produk B ke produk A ditolak', async () => {
    const before = await productRow(s.productB);
    const response = await call('/api/admin/products/merge', {
      method: 'POST',
      cookie: s.cookieA,
      json: { targetId: s.productA, sourceIds: [s.productB] },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await productRow(s.productB), before);
  });

  it('impor CSV dengan product_id milik B ditolak', async () => {
    const before = await productRow(s.productB);
    const response = await call('/api/admin/products/bulk', {
      method: 'POST',
      cookie: s.cookieA,
      json: {
        rows: [
          {
            product_id: s.productB,
            name: 'Kaos Toko B',
            category: 'Kategori B',
            subcategory: 'Kaos',
            description: 'Diretas',
            color: 'Merah',
            size: 'XL',
            sku: 'B-XL',
            normal_price: 1000,
            discount_percent: 0,
            stock: 1,
          },
        ],
      },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await productRow(s.productB), before);
  });

  it('mengubah status pesanan B ditolak', async () => {
    const response = await call('/api/admin/orders', {
      method: 'PATCH',
      cookie: s.cookieA,
      json: { orderNumber: s.orderB.orderNumber, status: 'dibatalkan' },
    });
    assert.equal(response.status, 404);
    const { rows } = await db.query(
      'SELECT status FROM orders WHERE order_number=$1',
      [s.orderB.orderNumber],
    );
    assert.equal(rows[0].status, 'menunggu_pembayaran');
  });

  it('mengubah ulasan B atau menambah ulasan ke produk B ditolak', async () => {
    const patch = await call('/api/admin/reviews', {
      method: 'PATCH',
      cookie: s.cookieA,
      json: {
        id: s.reviewB,
        displayName: 'X',
        city: 'X',
        rating: 1,
        body: 'Diretas',
        active: false,
      },
    });
    assert.equal(patch.status, 404);
    const post = await call('/api/admin/reviews', {
      method: 'POST',
      cookie: s.cookieA,
      json: {
        productId: s.productB,
        orderNumber: s.orderB.orderNumber,
        displayName: 'X',
        city: 'X',
        rating: 1,
        body: 'Palsu',
      },
    });
    assert.equal(post.status, 404);
    const { rows } = await db.query(
      'SELECT body,active FROM reviews WHERE product_id=$1',
      [s.productB],
    );
    assert.deepEqual(rows, [{ body: 'Ulasan rahasia toko B', active: 1 }]);
  });

  it('ganti nama & normalisasi kategori tidak menyentuh toko B', async () => {
    const rename = await call('/api/admin/categories', {
      method: 'PATCH',
      cookie: s.cookieA,
      json: { type: 'category', from: 'Kategori B', to: 'Diretas' },
    });
    assert.equal(rename.status, 200);
    assert.equal(rename.body.changed, 0);
    await call('/api/admin/categories', { method: 'POST', cookie: s.cookieA });
    assert.equal((await productRow(s.productB)).category, 'Kategori B');
  });

  it('pengaturan kurir toko A tidak mengubah toko B', async () => {
    const off = await call('/api/admin/shipping-settings', {
      method: 'PATCH',
      cookie: s.cookieA,
      json: { code: 'sicepat', active: false },
    });
    assert.equal(off.status, 200);
    const b = await call('/api/admin/shipping-settings', {
      host: B,
      cookie: s.cookieB,
    });
    assert.equal(
      b.body.couriers.find((courier) => courier.code === 'sicepat').active,
      true,
    );
    await call('/api/admin/shipping-settings', {
      method: 'PATCH',
      cookie: s.cookieA,
      json: { code: 'sicepat', active: true },
    });
  });

  it('super admin platform bisa mengelola toko B', async () => {
    const { status, cookie } = await adminLogin({ host: B });
    assert.equal(status, 200);
    const list = await call('/api/admin/products', { host: B, cookie });
    assert.equal(list.status, 200);
    const ids = list.body.products.map((product) => product.id);
    assert.ok(ids.includes(s.productB));
    assert.ok(!ids.includes(s.productA));
  });
});

describe('pelanggan hanya ada di tokonya sendiri', () => {
  it('session pelanggan toko A tidak berlaku di toko B', async () => {
    assert.equal(
      (await call('/api/cart', { host: B, cookie: s.customerA.cookie })).status,
      401,
    );
    const account = await call('/api/account', {
      host: B,
      cookie: s.customerA.cookie,
    });
    assert.equal(account.body.user, null);
  });

  it('akun Google yang sama punya keranjang terpisah di tiap toko', async () => {
    await call('/api/cart', {
      method: 'PUT',
      host: B,
      cookie: s.customerB.cookie,
      json: { productId: s.productB, variantIndex: 0, quantity: 1 },
    });
    const cartA = await call('/api/cart', { cookie: s.customerA.cookie });
    assert.deepEqual(cartA.body.items, []);
    const cartB = await call('/api/cart', {
      host: B,
      cookie: s.customerB.cookie,
    });
    assert.deepEqual(
      cartB.body.items.map((item) => item.product_id),
      [s.productB],
    );
  });

  it('produk B tidak bisa dimasukkan ke keranjang, diulas, atau dibeli di toko A', async () => {
    const cart = await call('/api/cart', {
      method: 'PUT',
      cookie: s.customerA.cookie,
      json: { productId: s.productB, variantIndex: 0, quantity: 1 },
    });
    assert.equal(cart.status, 409);
    const review = await call('/api/reviews', {
      method: 'POST',
      cookie: s.customerA.cookie,
      json: { productId: s.productB, rating: 1, body: 'x', city: 'x' },
    });
    assert.equal(review.status, 404);
    const rates = await call('/api/shipping/rates', {
      method: 'POST',
      json: {
        destinationPostalCode: '40111',
        items: orderBody(s.productB).items,
      },
    });
    assert.equal(rates.status, 409);
    const order = await call('/api/orders', {
      method: 'POST',
      json: orderBody(s.productB),
    });
    assert.equal(order.status, 409);
  });

  it('status pesanan B tidak bisa dibaca lewat toko A walau token benar', async () => {
    const path = `/api/orders/status?order=${encodeURIComponent(s.orderB.orderNumber)}`;
    const headers = { authorization: `Bearer ${s.orderB.paymentAccessToken}` };
    assert.equal((await call(path, { headers })).status, 404);
    assert.equal((await call(path, { headers, host: B })).status, 200);
  });

  it('newsletter: email yang sama tersimpan terpisah per toko', async () => {
    for (const host of [undefined, B])
      await call('/api/newsletter', {
        method: 'POST',
        host,
        json: { email: 'kembar@integration.test' },
      });
    const { rows } = await db.query(
      'SELECT store_id FROM newsletter_subscribers WHERE email=$1 ORDER BY store_id',
      ['kembar@integration.test'],
    );
    assert.deepEqual(
      rows.map((row) => row.store_id),
      ['default', STORE_B],
    );
  });
});

describe('pembayaran & konsistensi data', () => {
  it('notifikasi Midtrans memperbarui pesanan di toko pemiliknya saja', async () => {
    const body = {
      order_id: s.orderB.orderNumber,
      status_code: '200',
      gross_amount: `${s.orderB.total}.00`,
      transaction_status: 'settlement',
    };
    // Store B has its own Midtrans account; the platform key must not work for it.
    const keyB = 'SB-Mid-server-toko-b-0001';
    const saved = await call('/api/admin/settings/payments', {
      method: 'PATCH',
      host: B,
      cookie: s.cookieB,
      json: { secrets: { midtrans_server_key: keyB } },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const sign = (key) =>
      sha512(`${body.order_id}${body.status_code}${body.gross_amount}${key}`);
    const withPlatformKey = await call('/api/payments/midtrans/notification', {
      method: 'POST',
      json: { ...body, signature_key: sign(process.env.MIDTRANS_SERVER_KEY) },
    });
    assert.equal(withPlatformKey.status, 401);
    const response = await call('/api/payments/midtrans/notification', {
      method: 'POST',
      json: { ...body, signature_key: sign(keyB) },
    });
    assert.equal(response.status, 200);
    const { rows } = await db.query(
      'SELECT order_number,status FROM orders WHERE order_number = ANY($1)',
      [[s.orderA.orderNumber, s.orderB.orderNumber]],
    );
    const status = Object.fromEntries(
      rows.map((row) => [row.order_number, row.status]),
    );
    assert.equal(status[s.orderB.orderNumber], 'dibayar');
    assert.equal(status[s.orderA.orderNumber], 'menunggu_pembayaran');
  });

  it('tidak ada data yang menunjuk produk atau pelanggan toko lain', async () => {
    const { rows } = await db.query(`
      SELECT
        (SELECT count(*) FROM cart_items c JOIN products p ON p.id=c.product_id WHERE p.store_id<>c.store_id)::int AS carts,
        (SELECT count(*) FROM reviews r JOIN products p ON p.id=r.product_id WHERE p.store_id<>r.store_id)::int AS reviews,
        (SELECT count(*) FROM customer_sessions s LEFT JOIN customers c ON c.store_id=s.store_id AND c.user_id=s.user_id WHERE c.user_id IS NULL)::int AS sessions`);
    assert.deepEqual(rows[0], { carts: 0, reviews: 0, sessions: 0 });
  });
});

describe('daftar pesanan & laporan admin toko', () => {
  it('GET /api/admin/orders hanya berisi pesanan toko sendiri; ?store= diabaikan', async () => {
    for (const query of [
      '',
      `?store=${STORE_B}`,
      `?q=${s.orderB.orderNumber}`,
    ]) {
      const response = await call(`/api/admin/orders${query}`, {
        cookie: s.cookieA,
      });
      assert.equal(response.status, 200, query);
      assert.ok(
        response.body.orders.every((order) => order.storeId === 'default'),
        query,
      );
      assert.ok(
        !response.body.orders.some(
          (order) => order.orderNumber === s.orderB.orderNumber,
        ),
        query,
      );
    }
  });

  it('laporan penjualan produk & stok toko A tidak memuat produk toko B', async () => {
    const products = await call(
      `/api/admin/reports?report=products&store=${STORE_B}`,
      { cookie: s.cookieA },
    );
    assert.ok(products.body.products.every((row) => row.storeId === 'default'));
    const stock = await call(
      `/api/admin/reports?report=inventory&store=${STORE_B}`,
      { cookie: s.cookieA },
    );
    assert.ok(stock.body.lines.length > 0);
    assert.ok(stock.body.lines.every((line) => line.storeId === 'default'));
    assert.ok(!stock.body.lines.some((line) => line.productId === s.productB));
  });

  it('admin toko A tidak bisa memakai laporan atau pesanan platform', async () => {
    for (const path of ['/api/platform/orders', '/api/platform/reports'])
      assert.equal((await call(path, { cookie: s.cookieA })).status, 403, path);
  });
});
