// Multi-store phase 4: per-store settings, payment methods and encrypted keys.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminLogin,
  call,
  createStoreAdmin,
  db,
  orderBody,
  productForm,
  sha512,
} from './helpers.mjs';

const HOST = 'toko-atur.platform.test';
const STORE = 'it-store-settings';
const SERVER_KEY = 'SB-Mid-server-RAHASIA-T123';
const BITESHIP_KEY = 'biteship-toko-atur-K999';
const s = {};

const as = (who, path, options = {}) =>
  call(path, { host: HOST, cookie: s[who].cookie, ...options });
const rates = (host, productId) =>
  call('/api/shipping/rates', {
    method: 'POST',
    host,
    json: { destinationPostalCode: '40111', items: orderBody(productId).items },
  });

before(async () => {
  await db.query(
    "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ($1,'toko-atur','Toko Atur','t','t')",
    [STORE],
  );
  for (const role of ['store_owner', 'store_admin', 'store_staff']) {
    const account = await createStoreAdmin(STORE, role);
    const { cookie } = await adminLogin({ ...account, host: HOST });
    s[role] = { ...account, cookie };
  }
  const product = await as('store_owner', '/api/admin/products', {
    method: 'POST',
    form: productForm('Produk Atur', { sku: 'T' }),
  });
  s.productId = product.body.id;
  const defaultProducts = await call('/api/products');
  s.defaultProductId = defaultProducts.body.products[0]?.id;
});

after(() => db.end());

describe('toko bawaan tetap seperti sebelumnya', () => {
  it('kontak, rekening, dan catatan checkout lama tetap tampil', async () => {
    const home = await call('/');
    assert.equal(home.status, 200);
    for (const text of [
      '6285172381996',
      '9000027694984',
      'Muhammad Arifin',
      'instagram.com/simple_ground',
    ])
      assert.ok(home.text.includes(text), text);
    const checkout = await call('/checkout');
    assert.ok(checkout.text.includes('Pemeliharaan pembayaran QRIS'));
  });

  it('ongkir memakai kunci & kode pos dari server', async () => {
    const response = await rates(undefined, s.defaultProductId);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.match(
      response.body.options[0].serviceName,
      /origin=44163 key=integration-test/,
    );
  });
});

describe('toko baru tanpa pengaturan', () => {
  it('tidak memakai kontak atau rekening toko lain', async () => {
    const home = await call('/', { host: HOST });
    assert.equal(home.status, 200);
    for (const text of ['6285172381996', '9000027694984', 'Muhammad Arifin'])
      assert.ok(!home.text.includes(text), text);
  });

  it('transfer manual & Midtrans belum tersedia (kunci Midtrans server tidak dipinjam)', async () => {
    const manual = await call('/api/orders', {
      method: 'POST',
      host: HOST,
      json: orderBody(s.productId),
    });
    assert.equal(manual.status, 409);
    const midtrans = await call('/api/orders', {
      method: 'POST',
      host: HOST,
      json: { ...orderBody(s.productId), paymentMethod: 'midtrans' },
    });
    assert.equal(midtrans.status, 503);
    const { rowCount } = await db.query(
      'SELECT 1 FROM orders WHERE store_id=$1',
      [STORE],
    );
    assert.equal(rowCount, 0);
  });

  it('ongkir butuh kode pos gudang toko', async () => {
    const response = await rates(HOST, s.productId);
    assert.equal(response.status, 502);
    assert.match(response.body.error, /kode pos asal/);
  });
});

describe('izin pengaturan', () => {
  it('staf tidak boleh membuka pengaturan', async () => {
    assert.equal((await as('store_staff', '/api/admin/settings')).status, 403);
    assert.equal(
      (
        await as('store_staff', '/api/admin/settings', {
          method: 'PATCH',
          json: {},
        })
      ).status,
      403,
    );
  });

  it('admin boleh mengubah kontak, tetapi tidak rekening & kunci', async () => {
    const general = await as('store_admin', '/api/admin/settings', {
      method: 'PATCH',
      json: { settings: { whatsapp: '0812 3456 7890' } },
    });
    assert.equal(general.status, 200);
    const loaded = await as('store_admin', '/api/admin/settings');
    assert.equal(loaded.body.settings.whatsapp, '6281234567890');
    assert.equal(loaded.body.canManagePayments, false);
    const payments = await as('store_admin', '/api/admin/settings/payments', {
      method: 'PATCH',
      json: {
        manualPayment: {
          enabled: true,
          bankName: 'X',
          accountNumber: '1111',
          accountHolder: 'X',
        },
      },
    });
    assert.equal(payments.status, 403);
  });

  it('pengaturan umum tidak bisa dipakai untuk mengubah rekening', async () => {
    const response = await as('store_admin', '/api/admin/settings', {
      method: 'PATCH',
      json: {
        settings: {
          manualPayment: {
            enabled: true,
            bankName: 'Bank Penipu',
            accountNumber: '666666',
            accountHolder: 'Penipu',
          },
        },
      },
    });
    assert.equal(response.status, 200);
    const loaded = await as('store_owner', '/api/admin/settings');
    assert.equal(loaded.body.settings.manualPayment.enabled, false);
    assert.equal(loaded.body.settings.manualPayment.bankName, '');
  });
});

describe('validasi', () => {
  const general = [
    { label: 'WhatsApp berisi huruf', body: { settings: { whatsapp: 'abc' } } },
    {
      label: 'tautan javascript:',
      body: {
        settings: {
          socialLinks: [{ label: 'IG', url: 'javascript:alert(1)' }],
        },
      },
    },
    {
      label: 'awalan pesanan terlalu panjang',
      body: { settings: { orderPrefix: 'TERLALU-PANJANG' } },
    },
    {
      label: 'kode pos bukan 5 angka',
      body: { settings: { shippingOriginPostalCode: '12' } },
    },
    { label: 'nama toko kosong', body: { store: { name: '' } } },
  ];
  for (const { label, body } of general)
    it(`${label} ditolak`, async () => {
      const response = await as('store_owner', '/api/admin/settings', {
        method: 'PATCH',
        json: body,
      });
      assert.equal(response.status, 400);
    });

  const payments = [
    {
      label: 'rekening tanpa nomor',
      body: {
        manualPayment: {
          enabled: true,
          bankName: 'BCA',
          accountNumber: '',
          accountHolder: 'A',
        },
      },
    },
    {
      label: 'kunci berisi spasi',
      body: { secrets: { midtrans_server_key: 'ada spasi di sini' } },
    },
    {
      label: 'nama kunci tak dikenal',
      body: { secrets: { aws_key: 'abcdefghijk' } },
    },
  ];
  for (const { label, body } of payments)
    it(`${label} ditolak`, async () => {
      const response = await as('store_owner', '/api/admin/settings/payments', {
        method: 'PATCH',
        json: body,
      });
      assert.equal(response.status, 400);
    });
});

describe('pemilik mengatur toko', () => {
  before(async () => {
    const general = await as('store_owner', '/api/admin/settings', {
      method: 'PATCH',
      json: {
        store: {
          name: 'Toko Atur Baru',
          email: 'halo@tokoatur.test',
          phone: '022-123',
          address: 'Bandung',
        },
        settings: {
          whatsapp: '+62 813-0000-1111',
          socialLinks: [
            { label: 'Instagram', url: 'https://instagram.com/tokoatur' },
          ],
          orderPrefix: 'at',
          shippingOriginPostalCode: '40115',
          checkoutNoticeTitle: 'Libur lebaran',
          checkoutNotice: 'Pesanan dikirim setelah tanggal 10.',
          recommendedPayment: 'manual',
        },
      },
    });
    assert.equal(general.status, 200, JSON.stringify(general.body));
    const payments = await as('store_owner', '/api/admin/settings/payments', {
      method: 'PATCH',
      json: {
        manualPayment: {
          enabled: true,
          bankName: 'BCA',
          accountNumber: '1234567890',
          accountHolder: 'PT Toko Atur',
        },
        midtrans: {
          enabled: true,
          clientKey: 'SB-Mid-client-atur',
          production: false,
        },
        secrets: {
          midtrans_server_key: SERVER_KEY,
          biteship_api_key: BITESHIP_KEY,
        },
      },
    });
    assert.equal(payments.status, 200, JSON.stringify(payments.body));
  });

  it('kunci rahasia tidak pernah dikirim kembali, hanya 4 karakter terakhir', async () => {
    const loaded = await as('store_owner', '/api/admin/settings');
    assert.ok(!loaded.text.includes(SERVER_KEY));
    assert.ok(!loaded.text.includes(BITESHIP_KEY));
    assert.deepEqual(
      [
        loaded.body.secrets.midtrans_server_key.hint,
        loaded.body.secrets.biteship_api_key.hint,
      ],
      ['T123', 'K999'],
    );
    assert.equal(loaded.body.status.midtrans, true);
    assert.equal(loaded.body.status.manual, true);
  });

  it('kunci tersimpan terenkripsi di database', async () => {
    const { rows } = await db.query(
      'SELECT value_encrypted FROM store_secrets WHERE store_id=$1',
      [STORE],
    );
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.match(row.value_encrypted, /^v1:/);
      assert.ok(
        !row.value_encrypted.includes('RAHASIA') &&
          !row.value_encrypted.includes('K999'),
      );
    }
  });

  it('halaman toko memakai kontak, rekening, dan nama baru', async () => {
    const home = await call('/', { host: HOST });
    for (const text of [
      'Toko Atur Baru',
      '6281300001111',
      '1234567890',
      'PT Toko Atur',
      'instagram.com/tokoatur',
    ])
      assert.ok(home.text.includes(text), text);
    const checkout = await call('/checkout', { host: HOST });
    assert.ok(checkout.text.includes('Libur lebaran'));
    const other = await call('/');
    assert.ok(!other.text.includes('1234567890'));
  });

  it('ongkir memakai kode pos gudang & kunci Biteship toko', async () => {
    const response = await rates(HOST, s.productId);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.match(
      response.body.options[0].serviceName,
      new RegExp(`origin=40115 key=${BITESHIP_KEY}`),
    );
    const own = await rates(undefined, s.defaultProductId);
    assert.match(
      own.body.options[0].serviceName,
      /origin=44163 key=integration-test/,
    );
  });

  it('pesanan memakai awalan & rekening toko', async () => {
    const response = await call('/api/orders', {
      method: 'POST',
      host: HOST,
      json: orderBody(s.productId),
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.match(response.body.orderNumber, /^AT-/);
    assert.deepEqual(response.body.manualPayment, {
      bankName: 'BCA',
      accountNumber: '1234567890',
      accountHolder: 'PT Toko Atur',
    });
    s.order = response.body;
    const { rows } = await db.query(
      'SELECT payment_method FROM orders WHERE order_number=$1',
      [s.order.orderNumber],
    );
    assert.equal(rows[0].payment_method, 'BCA');
  });

  it('notifikasi Midtrans harus ditandatangani kunci toko ini', async () => {
    const notice = (key) => {
      const body = {
        order_id: s.order.orderNumber,
        status_code: '200',
        gross_amount: `${s.order.total}.00`,
        transaction_status: 'settlement',
      };
      return {
        ...body,
        signature_key: sha512(
          `${body.order_id}${body.status_code}${body.gross_amount}${key}`,
        ),
      };
    };
    const withPlatformKey = await call('/api/payments/midtrans/notification', {
      method: 'POST',
      json: notice(process.env.MIDTRANS_SERVER_KEY),
    });
    assert.equal(withPlatformKey.status, 401);
    const withStoreKey = await call('/api/payments/midtrans/notification', {
      method: 'POST',
      json: notice(SERVER_KEY),
    });
    assert.equal(withStoreKey.status, 200);
    const { rows } = await db.query(
      'SELECT status FROM orders WHERE order_number=$1',
      [s.order.orderNumber],
    );
    assert.equal(rows[0].status, 'dibayar');
  });

  it('menghapus kunci Biteship kembali ke kunci platform', async () => {
    const response = await as('store_owner', '/api/admin/settings/payments', {
      method: 'PATCH',
      json: { secrets: { biteship_api_key: null } },
    });
    assert.equal(response.status, 200);
    const shipping = await rates(HOST, s.productId);
    assert.match(
      shipping.body.options[0].serviceName,
      /origin=40115 key=integration-test/,
    );
  });

  it('transfer manual bisa dimatikan', async () => {
    await as('store_owner', '/api/admin/settings/payments', {
      method: 'PATCH',
      json: {
        manualPayment: {
          enabled: false,
          bankName: 'BCA',
          accountNumber: '1234567890',
          accountHolder: 'PT Toko Atur',
        },
      },
    });
    const response = await call('/api/orders', {
      method: 'POST',
      host: HOST,
      json: orderBody(s.productId),
    });
    assert.equal(response.status, 409);
  });

  it('aktivitas mencatat perubahan tanpa isi kunci rahasia', async () => {
    const response = await as('store_owner', '/api/admin/audit');
    const entries = response.body.entries.filter((entry) =>
      ['settings.update', 'payments.update'].includes(entry.action),
    );
    assert.ok(entries.some((entry) => entry.action === 'settings.update'));
    const payments = entries.find(
      (entry) =>
        entry.action === 'payments.update' &&
        entry.metaJson.includes('rekening'),
    );
    assert.ok(payments);
    assert.match(payments.metaJson, /…7890/);
    assert.ok(
      !response.text.includes(SERVER_KEY) &&
        !response.text.includes(BITESHIP_KEY),
    );
  });

  it('pengaturan toko lain tidak bisa dibuka', async () => {
    const response = await call('/api/admin/settings', {
      cookie: s.store_owner.cookie,
    });
    assert.equal(response.status, 403);
  });
});

describe('enkripsi kunci', () => {
  let secrets;
  before(async () => {
    secrets = await import('@/lib/secrets');
  });

  it('hanya bisa dibuka untuk toko & nama yang sama', async () => {
    const stored = await secrets.encryptSecret(
      'toko-1',
      'midtrans_server_key',
      'nilai-rahasia',
    );
    assert.equal(
      await secrets.decryptSecret('toko-1', 'midtrans_server_key', stored),
      'nilai-rahasia',
    );
    assert.equal(
      await secrets.decryptSecret('toko-2', 'midtrans_server_key', stored),
      null,
    );
    assert.equal(
      await secrets.decryptSecret('toko-1', 'biteship_api_key', stored),
      null,
    );
    const tampered = `${stored.slice(0, -4)}AAAA`;
    assert.equal(
      await secrets.decryptSecret('toko-1', 'midtrans_server_key', tampered),
      null,
    );
  });

  it('kunci salinan dari toko lain tidak dipakai', async () => {
    const { rows } = await db.query(
      "SELECT value_encrypted FROM store_secrets WHERE store_id=$1 AND name='midtrans_server_key'",
      [STORE],
    );
    assert.equal(
      await secrets.decryptSecret(
        'default',
        'midtrans_server_key',
        rows[0].value_encrypted,
      ),
      null,
    );
  });
});
