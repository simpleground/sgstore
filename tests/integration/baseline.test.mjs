// Baseline: existing single-store behaviour must keep working through every
// multi-store phase. Tests run in order and share the objects they create.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminCookie,
  call,
  customerCookie,
  db,
  sha512,
  tinyPng,
} from './helpers.mjs';

const state = {};

before(async () => {
  state.admin = await adminCookie();
  state.customer = await customerCookie();
});
after(() => db.end());

describe('health & akses', () => {
  it('health check melaporkan database aktif', async () => {
    const response = await call('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.database, 'up');
  });

  it('API admin menolak request tanpa login', async () => {
    for (const path of [
      '/api/admin/products',
      '/api/admin/reviews',
      '/api/admin/shipping-settings',
      '/api/admin/products/bulk',
    ])
      assert.equal((await call(path)).status, 403, path);
    assert.equal(
      (await call('/api/admin/orders', { method: 'PATCH', json: {} })).status,
      403,
    );
  });

  it('halaman admin mengalihkan ke login bila belum masuk', async () => {
    const response = await call('/admin');
    assert.ok(
      [303, 307, 308].includes(response.status),
      `status ${response.status}`,
    );
    assert.match(response.headers.get('location') || '', /\/admin\/login/);
  });

  it('login admin dengan password salah ditolak', async () => {
    const response = await call('/api/admin/login', {
      method: 'POST',
      json: { email: process.env.ADMIN_EMAIL, password: 'salah-sekali' },
    });
    assert.equal(response.status, 401);
  });
});

describe('produk (admin → katalog publik)', () => {
  it('admin membuat produk dengan foto', async () => {
    const form = new FormData();
    form.set('name', 'Kaos Uji Integrasi');
    form.set('category', 'daily basic');
    form.set('subcategory', 'kaos');
    form.set('description', 'Produk untuk integration test.');
    form.set('weightGrams', '300');
    form.set('preorder_days', '2');
    form.set(
      'variantsJson',
      JSON.stringify([
        {
          sku: 'IT-M',
          color: 'Hitam',
          size: 'M',
          price: 50000,
          normalPrice: 60000,
          stock: 5,
        },
        {
          sku: 'IT-L',
          color: 'Hitam',
          size: 'L',
          price: 55000,
          normalPrice: 55000,
          stock: 0,
        },
      ]),
    );
    form.append(
      'images',
      new File([tinyPng], 'foto.png', { type: 'image/png' }),
    );
    const response = await call('/api/admin/products', {
      method: 'POST',
      form,
      cookie: state.admin,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    state.productId = response.body.id;
  });

  it('produk baru tersimpan di toko bawaan', async () => {
    const { rows } = await db.query(
      'SELECT store_id,category FROM products WHERE id=$1',
      [state.productId],
    );
    assert.equal(rows[0].store_id, 'default');
    assert.equal(rows[0].category, 'Daily Basic');
  });

  it('produk tampil di katalog publik beserta fotonya', async () => {
    const response = await call('/api/products');
    assert.equal(response.status, 200);
    const product = response.body.products.find(
      (item) => item.id === state.productId,
    );
    assert.ok(product);
    assert.equal(product.variants.length, 2);
    state.imageUrl = product.images[0];
    assert.match(state.imageUrl, /^\/api\/product-image\/products\//);
    const image = await fetch(`${process.env.TEST_APP_URL}${state.imageUrl}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
  });

  it('halaman detail produk dirender', async () => {
    const response = await call('/produk/kaos_uji_integrasi');
    assert.equal(response.status, 200);
    assert.match(response.text, /Kaos Uji Integrasi/);
  });

  it('admin mengubah produk', async () => {
    const form = new FormData();
    form.set('id', state.productId);
    form.set('name', 'Kaos Uji Integrasi');
    form.set('category', 'Daily Basic');
    form.set('subcategory', 'Kaos');
    form.set('description', 'Deskripsi diperbarui.');
    form.set('weightGrams', '300');
    form.set('preorder_days', '2');
    form.set('active', 'true');
    form.set(
      'variantsJson',
      JSON.stringify([
        {
          sku: 'IT-M',
          color: 'Hitam',
          size: 'M',
          price: 50000,
          normalPrice: 60000,
          stock: 5,
        },
        {
          sku: 'IT-L',
          color: 'Hitam',
          size: 'L',
          price: 55000,
          normalPrice: 55000,
          stock: 0,
        },
      ]),
    );
    const response = await call('/api/admin/products', {
      method: 'PATCH',
      form,
      cookie: state.admin,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const { rows } = await db.query(
      'SELECT description FROM products WHERE id=$1',
      [state.productId],
    );
    assert.equal(rows[0].description, 'Deskripsi diperbarui.');
  });

  it('admin melihat daftar produk & ekspor CSV', async () => {
    const list = await call('/api/admin/products', { cookie: state.admin });
    assert.equal(list.status, 200);
    assert.ok(list.body.products.some((item) => item.id === state.productId));
    const csv = await call(`/api/admin/products/bulk?id=${state.productId}`, {
      cookie: state.admin,
    });
    assert.equal(csv.status, 200);
    assert.match(csv.text, /IT-M/);
  });
});

describe('keranjang, ongkir, dan pesanan', () => {
  it('pelanggan menyimpan keranjang', async () => {
    const put = await call('/api/cart', {
      method: 'PUT',
      cookie: state.customer.cookie,
      json: { productId: state.productId, variantIndex: 0, quantity: 2 },
    });
    assert.equal(put.status, 200);
    const get = await call('/api/cart', { cookie: state.customer.cookie });
    assert.deepEqual(get.body.items, [
      { product_id: state.productId, variant_index: 0, quantity: 2 },
    ]);
  });

  it('keranjang menolak jumlah melebihi stok', async () => {
    const response = await call('/api/cart', {
      method: 'PUT',
      cookie: state.customer.cookie,
      json: { productId: state.productId, variantIndex: 0, quantity: 6 },
    });
    assert.equal(response.status, 409);
  });

  it('keranjang tanpa login ditolak', async () => {
    assert.equal((await call('/api/cart')).status, 401);
  });

  it('cek ongkir memakai kurir aktif', async () => {
    const response = await call('/api/shipping/rates', {
      method: 'POST',
      json: {
        destinationPostalCode: '40111',
        items: [{ id: state.productId, variantIndex: 0, quantity: 1 }],
      },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(
      response.body.options.some((option) => option.courierCode === 'jne'),
    );
  });

  it('admin menonaktifkan & mengaktifkan kurir', async () => {
    const off = await call('/api/admin/shipping-settings', {
      method: 'PATCH',
      cookie: state.admin,
      json: { code: 'jne', active: false },
    });
    assert.equal(off.status, 200);
    const list = await call('/api/admin/shipping-settings', {
      cookie: state.admin,
    });
    assert.equal(
      list.body.couriers.find((courier) => courier.code === 'jne').active,
      false,
    );
    const rates = await call('/api/shipping/rates', {
      method: 'POST',
      json: {
        destinationPostalCode: '40111',
        items: [{ id: state.productId, variantIndex: 0, quantity: 1 }],
      },
    });
    assert.ok(
      !rates.body.options.some((option) => option.courierCode === 'jne'),
    );
    const on = await call('/api/admin/shipping-settings', {
      method: 'PATCH',
      cookie: state.admin,
      json: { code: 'jne', active: true },
    });
    assert.equal(on.status, 200);
  });

  it('pesanan transfer manual dibuat dengan harga dari server', async () => {
    const response = await call('/api/orders', {
      method: 'POST',
      json: {
        customerName: 'Pelanggan Uji',
        customerPhone: '081234567890',
        shippingAddress: 'Jalan Integrasi No. 1, Bandung',
        destinationPostalCode: '40111',
        paymentMethod: 'manual',
        shippingOption: { courierCode: 'jne', serviceCode: 'reg' },
        items: [{ id: state.productId, variantIndex: 0, quantity: 2 }],
      },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.match(response.body.orderNumber, /^SG-/);
    assert.equal(response.body.paymentAccessToken.length, 72);
    state.order = response.body;
    const { rows } = await db.query(
      'SELECT store_id,subtotal,total,status FROM orders WHERE order_number=$1',
      [state.order.orderNumber],
    );
    assert.equal(rows[0].store_id, 'default');
    assert.equal(rows[0].subtotal, 100000);
    assert.equal(rows[0].total, state.order.total);
    assert.equal(rows[0].status, 'menunggu_pembayaran');
  });

  it('status pesanan hanya bisa dibaca dengan token pembayaran', async () => {
    const path = `/api/orders/status?order=${encodeURIComponent(state.order.orderNumber)}`;
    assert.equal((await call(path)).status, 401);
    assert.equal(
      (
        await call(path, {
          headers: { authorization: `Bearer ${'x'.repeat(72)}` },
        })
      ).status,
      404,
    );
    const ok = await call(path, {
      headers: { authorization: `Bearer ${state.order.paymentAccessToken}` },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.paid, false);
  });

  it('notifikasi Midtrans dengan signature salah ditolak', async () => {
    const response = await call('/api/payments/midtrans/notification', {
      method: 'POST',
      json: {
        order_id: state.order.orderNumber,
        status_code: '200',
        gross_amount: `${state.order.total}.00`,
        signature_key: 'salah',
        transaction_status: 'settlement',
      },
    });
    assert.equal(response.status, 401);
  });

  it('notifikasi Midtrans yang sah menandai pesanan dibayar', async () => {
    const body = {
      order_id: state.order.orderNumber,
      status_code: '200',
      gross_amount: `${state.order.total}.00`,
      transaction_status: 'settlement',
    };
    body.signature_key = sha512(
      `${body.order_id}${body.status_code}${body.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`,
    );
    const response = await call('/api/payments/midtrans/notification', {
      method: 'POST',
      json: body,
    });
    assert.equal(response.status, 200);
    const status = await call(
      `/api/orders/status?order=${encodeURIComponent(state.order.orderNumber)}`,
      {
        headers: { authorization: `Bearer ${state.order.paymentAccessToken}` },
      },
    );
    assert.equal(status.body.paid, true);
  });

  it('admin melihat pesanan dan mengubah statusnya', async () => {
    const page = await call('/admin', { cookie: state.admin });
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(state.order.orderNumber));
    const invalid = await call('/api/admin/orders', {
      method: 'PATCH',
      cookie: state.admin,
      json: { orderNumber: state.order.orderNumber, status: 'hilang' },
    });
    assert.equal(invalid.status, 400);
    const response = await call('/api/admin/orders', {
      method: 'PATCH',
      cookie: state.admin,
      json: { orderNumber: state.order.orderNumber, status: 'dikirim' },
    });
    assert.equal(response.status, 200);
    const { rows } = await db.query(
      'SELECT status FROM orders WHERE order_number=$1',
      [state.order.orderNumber],
    );
    assert.equal(rows[0].status, 'dikirim');
  });
});

describe('ulasan, newsletter, kategori', () => {
  it('pelanggan menulis ulasan dan ulasan tampil publik', async () => {
    const post = await call('/api/reviews', {
      method: 'POST',
      cookie: state.customer.cookie,
      json: {
        productId: state.productId,
        rating: 5,
        body: 'Bahannya adem.',
        city: 'Bandung',
      },
    });
    assert.equal(post.status, 200);
    const list = await call('/api/reviews');
    assert.ok(
      list.body.reviews.some((review) => review.body === 'Bahannya adem.'),
    );
    const { rows } = await db.query(
      'SELECT store_id FROM reviews WHERE product_id=$1',
      [state.productId],
    );
    assert.equal(rows[0].store_id, 'default');
  });

  it('admin melihat ulasan', async () => {
    const response = await call('/api/admin/reviews', { cookie: state.admin });
    assert.equal(response.status, 200);
    assert.ok(
      response.body.reviews.some(
        (review) => review.product_id === state.productId,
      ),
    );
  });

  it('newsletter menyimpan email di toko bawaan', async () => {
    const response = await call('/api/newsletter', {
      method: 'POST',
      json: { email: 'Pembaca@Integration.Test' },
    });
    assert.equal(response.status, 200);
    const { rows } = await db.query(
      'SELECT store_id FROM newsletter_subscribers WHERE email=$1',
      ['pembaca@integration.test'],
    );
    assert.equal(rows[0].store_id, 'default');
  });

  it('admin mengganti nama kategori', async () => {
    const response = await call('/api/admin/categories', {
      method: 'PATCH',
      cookie: state.admin,
      json: { type: 'category', from: 'Daily Basic', to: 'Daily Basic Uji' },
    });
    assert.equal(response.status, 200);
    assert.ok(response.body.changed >= 1);
    const { rows } = await db.query(
      'SELECT category FROM products WHERE id=$1',
      [state.productId],
    );
    assert.equal(rows[0].category, 'Daily Basic Uji');
  });
});

describe('arsip & penghapusan produk', () => {
  it('produk yang diarsipkan hilang dari katalog publik', async () => {
    const archive = await call('/api/admin/products', {
      method: 'PUT',
      cookie: state.admin,
      json: { id: state.productId, active: 0 },
    });
    assert.equal(archive.status, 200);
    const list = await call('/api/products');
    assert.ok(!list.body.products.some((item) => item.id === state.productId));
  });

  it('produk masuk tong sampah lalu dihapus permanen beserta fotonya', async () => {
    const trash = await call('/api/admin/products', {
      method: 'DELETE',
      cookie: state.admin,
      json: { id: state.productId },
    });
    assert.equal(trash.status, 200);
    const remove = await call('/api/admin/products', {
      method: 'DELETE',
      cookie: state.admin,
      json: { id: state.productId, permanent: true },
    });
    assert.equal(remove.status, 200);
    const { rowCount } = await db.query('SELECT 1 FROM products WHERE id=$1', [
      state.productId,
    ]);
    assert.equal(rowCount, 0);
    const image = await fetch(`${process.env.TEST_APP_URL}${state.imageUrl}`);
    assert.equal(image.status, 404);
  });
});
