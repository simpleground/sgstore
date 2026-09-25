// Multi-store phase 3: roles (owner / admin / staff), member management and the
// audit log. Uses its own store so role changes never affect the other tests.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminLogin,
  call,
  createStoreAdmin,
  enableManualPayment,
  db,
  orderBody,
  productForm,
} from './helpers.mjs';

const HOST = 'toko-peran.platform.test';
const STORE = 'it-store-roles';
const OTHER_HOST = 'toko-lain.platform.test';
const OTHER = 'it-store-other';
const s = {};

async function login(account, host = HOST) {
  const { status, cookie } = await adminLogin({ ...account, host });
  assert.equal(status, 200, `login ${account.email}`);
  return cookie;
}
const as = (who, path, options = {}) =>
  call(path, { host: HOST, cookie: s[who].cookie, ...options });
const members = (who, method, json) =>
  as(who, '/api/admin/members', { method, json });
const roleOf = async (userId, store = STORE) =>
  (
    await db.query(
      'SELECT role FROM store_memberships WHERE store_id=$1 AND user_id=$2',
      [store, userId],
    )
  ).rows[0]?.role ?? null;

before(async () => {
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES
       ($1,'toko-peran','Toko Peran',$3,$3), ($2,'toko-lain','Toko Lain',$3,$3)`,
    [STORE, OTHER, now],
  );
  await enableManualPayment(STORE);
  for (const role of ['store_owner', 'store_admin', 'store_staff']) {
    const account = await createStoreAdmin(STORE, role);
    s[role] = { ...account, cookie: await login(account) };
  }
  s.otherOwner = await createStoreAdmin(OTHER, 'store_owner');
  s.otherOwner.cookie = await login(s.otherOwner, OTHER_HOST);

  const product = await as('store_owner', '/api/admin/products', {
    method: 'POST',
    form: productForm('Produk Peran', { sku: 'R' }),
  });
  s.productId = product.body.id;
  const order = await call('/api/orders', {
    method: 'POST',
    host: HOST,
    json: orderBody(s.productId),
  });
  s.orderNumber = order.body.orderNumber;
});

after(() => db.end());

describe('izin per peran', () => {
  const restricted = [
    { method: 'GET', path: '/api/admin/products/bulk' },
    { method: 'POST', path: '/api/admin/products/bulk', json: { rows: [] } },
    { method: 'POST', path: '/api/admin/products/merge', json: {} },
    { method: 'PATCH', path: '/api/admin/categories', json: {} },
    { method: 'POST', path: '/api/admin/categories' },
    { method: 'GET', path: '/api/admin/reviews' },
    { method: 'PATCH', path: '/api/admin/reviews', json: {} },
    { method: 'GET', path: '/api/admin/shipping-settings' },
    { method: 'PATCH', path: '/api/admin/shipping-settings', json: {} },
    { method: 'GET', path: '/api/admin/members' },
    { method: 'POST', path: '/api/admin/members', json: {} },
    { method: 'GET', path: '/api/admin/audit' },
  ];

  it('staf ditolak untuk impor, gabung, kategori, ulasan, pengiriman, anggota, log', async () => {
    for (const { method, path, json } of restricted) {
      const response = await as('store_staff', path, { method, json });
      assert.equal(response.status, 403, `${method} ${path}`);
    }
  });

  it('admin & pemilik boleh mengakses semuanya', async () => {
    for (const who of ['store_admin', 'store_owner'])
      for (const path of [
        '/api/admin/products/bulk',
        '/api/admin/reviews',
        '/api/admin/shipping-settings',
        '/api/admin/members',
        '/api/admin/audit',
      ])
        assert.equal((await as(who, path)).status, 200, `${who} ${path}`);
  });

  it('staf mengelola produk dan pesanan, tetapi tidak bisa hapus permanen', async () => {
    const created = await as('store_staff', '/api/admin/products', {
      method: 'POST',
      form: productForm('Produk Staf', { sku: 'S' }),
    });
    assert.equal(created.status, 200);
    const id = created.body.id;
    const trash = await as('store_staff', '/api/admin/products', {
      method: 'DELETE',
      json: { id },
    });
    assert.equal(trash.status, 200);
    const permanent = await as('store_staff', '/api/admin/products', {
      method: 'DELETE',
      json: { id, permanent: true },
    });
    assert.equal(permanent.status, 403);
    assert.equal(
      (await db.query('SELECT 1 FROM products WHERE id=$1', [id])).rowCount,
      1,
    );
    const order = await as('store_staff', '/api/admin/orders', {
      method: 'PATCH',
      json: { orderNumber: s.orderNumber, status: 'diproses' },
    });
    assert.equal(order.status, 200);
  });

  it('menu admin hanya berisi yang diizinkan', async () => {
    const staff = await as('store_staff', '/admin');
    assert.equal(staff.status, 200);
    assert.ok(!staff.text.includes('members.view'));
    assert.ok(staff.text.includes('Staf'));
    const owner = await as('store_owner', '/admin');
    assert.ok(owner.text.includes('members.view'));
    assert.ok(owner.text.includes('toko peran'));
  });
});

describe('mengelola anggota', () => {
  it('peran tidak dikenal atau email salah ditolak', async () => {
    for (const json of [
      { email: 'x@integration.test', role: 'super_admin' },
      { email: 'bukan-email', role: 'store_staff' },
    ])
      assert.equal((await members('store_owner', 'POST', json)).status, 400);
  });

  it('admin hanya boleh menambah staf', async () => {
    const staff = await members('store_admin', 'POST', {
      email: 'staf-baru@integration.test',
      role: 'store_staff',
    });
    assert.equal(staff.status, 200, JSON.stringify(staff.body));
    s.newStaff = staff.body.userId;
    for (const role of ['store_admin', 'store_owner']) {
      const response = await members('store_admin', 'POST', {
        email: `naik-${role}@integration.test`,
        role,
      });
      assert.equal(response.status, 403, role);
    }
  });

  it('akun baru tidak punya password (hanya bisa masuk dengan Google)', async () => {
    const { rows } = await db.query(
      'SELECT password_hash FROM admin_users WHERE user_id=$1',
      [s.newStaff],
    );
    assert.equal(rows[0].password_hash, null);
  });

  it('admin tidak bisa menaikkan staf atau mengubah pemilik', async () => {
    const promote = await members('store_admin', 'PATCH', {
      userId: s.newStaff,
      role: 'store_admin',
    });
    assert.equal(promote.status, 403);
    const demoteOwner = await members('store_admin', 'PATCH', {
      userId: s.store_owner.userId,
      role: 'store_staff',
    });
    assert.equal(demoteOwner.status, 403);
    const removeOwner = await members('store_admin', 'DELETE', {
      userId: s.store_owner.userId,
    });
    assert.equal(removeOwner.status, 403);
    assert.equal(await roleOf(s.store_owner.userId), 'store_owner');
    assert.equal(await roleOf(s.newStaff), 'store_staff');
  });

  it('staf tidak bisa menaikkan perannya sendiri', async () => {
    const response = await members('store_staff', 'PATCH', {
      userId: s.store_staff.userId,
      role: 'store_owner',
    });
    assert.equal(response.status, 403);
    assert.equal(await roleOf(s.store_staff.userId), 'store_staff');
  });

  it('tidak ada yang bisa mengubah peran atau keluar dirinya sendiri', async () => {
    for (const [method, json] of [
      ['PATCH', { userId: s.store_owner.userId, role: 'store_staff' }],
      ['DELETE', { userId: s.store_owner.userId }],
    ])
      assert.equal((await members('store_owner', method, json)).status, 400);
  });

  it('pemilik bisa menaikkan staf menjadi admin', async () => {
    const response = await members('store_owner', 'PATCH', {
      userId: s.newStaff,
      role: 'store_admin',
    });
    assert.equal(response.status, 200);
    assert.equal(await roleOf(s.newStaff), 'store_admin');
  });

  it('pemilik terakhir tidak bisa diturunkan atau dikeluarkan', async () => {
    const superAdmin = (await adminLogin({ host: HOST })).cookie;
    const demote = await call('/api/admin/members', {
      method: 'PATCH',
      host: HOST,
      cookie: superAdmin,
      json: { userId: s.store_owner.userId, role: 'store_admin' },
    });
    assert.equal(demote.status, 409);
    const remove = await call('/api/admin/members', {
      method: 'DELETE',
      host: HOST,
      cookie: superAdmin,
      json: { userId: s.store_owner.userId },
    });
    assert.equal(remove.status, 409);
    assert.equal(await roleOf(s.store_owner.userId), 'store_owner');
  });

  it('akun yang sudah ada hanya ditautkan; password & namanya tidak berubah', async () => {
    const before = (
      await db.query(
        'SELECT name,password_hash FROM admin_users WHERE user_id=$1',
        [s.otherOwner.userId],
      )
    ).rows[0];
    const response = await members('store_owner', 'POST', {
      email: s.otherOwner.email,
      name: 'Nama Diganti',
      role: 'store_staff',
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.newAccount, false);
    const after = (
      await db.query(
        'SELECT name,password_hash FROM admin_users WHERE user_id=$1',
        [s.otherOwner.userId],
      )
    ).rows[0];
    assert.deepEqual(after, before);
    // Its role in its own store is untouched.
    assert.equal(await roleOf(s.otherOwner.userId, OTHER), 'store_owner');
    const again = await members('store_owner', 'POST', {
      email: s.otherOwner.email,
      role: 'store_staff',
    });
    assert.equal(again.status, 409);
  });

  it('anggota toko lain tidak bisa diubah dari toko ini', async () => {
    const outsider = await createStoreAdmin(OTHER, 'store_staff');
    const response = await members('store_owner', 'PATCH', {
      userId: outsider.userId,
      role: 'store_admin',
    });
    assert.equal(response.status, 404);
    assert.equal(await roleOf(outsider.userId, OTHER), 'store_staff');
    // And the other store's owner cannot touch this store's members.
    const cross = await call('/api/admin/members', {
      method: 'DELETE',
      host: HOST,
      cookie: s.otherOwner.cookie,
      json: { userId: s.store_staff.userId },
    });
    assert.ok([403, 400].includes(cross.status));
  });

  it('anggota yang dikeluarkan langsung kehilangan akses', async () => {
    const member = await createStoreAdmin(STORE, 'store_staff');
    const cookie = await login(member);
    assert.equal(
      (await call('/api/admin/products', { host: HOST, cookie })).status,
      200,
    );
    const removed = await members('store_owner', 'DELETE', {
      userId: member.userId,
    });
    assert.equal(removed.status, 200);
    assert.equal(
      (await call('/api/admin/products', { host: HOST, cookie })).status,
      403,
    );
  });
});

describe('catatan aktivitas', () => {
  let entries;
  before(async () => {
    const response = await as('store_owner', '/api/admin/audit');
    assert.equal(response.status, 200);
    entries = response.body.entries;
  });
  const find = (action) => entries.filter((entry) => entry.action === action);

  it('mencatat login, produk, pesanan, dan anggota', async () => {
    for (const action of [
      'auth.login',
      'product.create',
      'product.trash',
      'order.status',
      'member.add',
      'member.role',
      'member.remove',
    ])
      assert.ok(find(action).length, action);
    const status = find('order.status')[0];
    assert.equal(status.targetId, s.orderNumber);
    assert.deepEqual(JSON.parse(status.metaJson), {
      from: 'menunggu_pembayaran',
      to: 'diproses',
    });
    assert.equal(status.userEmail, s.store_staff.email);
  });

  it('percobaan gagal (hapus permanen oleh staf) tidak tercatat sebagai tindakan', () => {
    assert.equal(find('product.delete').length, 0);
  });

  it('login ditolak di toko lain tercatat di toko tersebut', async () => {
    assert.equal(
      (await adminLogin({ ...s.store_staff, host: OTHER_HOST })).status,
      403,
    );
    const other = await call('/api/admin/audit', {
      host: OTHER_HOST,
      cookie: s.otherOwner.cookie,
    });
    assert.ok(
      other.body.entries.some(
        (entry) =>
          entry.action === 'auth.login_denied' &&
          entry.userEmail === s.store_staff.email,
      ),
    );
  });

  it('catatan toko lain tidak terlihat', async () => {
    const other = await call('/api/admin/audit', {
      host: OTHER_HOST,
      cookie: s.otherOwner.cookie,
    });
    assert.ok(
      !other.body.entries.some((entry) => entry.targetId === s.orderNumber),
    );
    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM audit_logs WHERE store_id=$1',
      [STORE],
    );
    assert.ok(rows[0].n >= entries.length);
  });
});
