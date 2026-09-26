// Roles & permissions managed by the platform super admin (Admin → Peran & izin):
// built-in Admin/Staf permissions can be changed, custom roles can be created
// and assigned to store members.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminCookie,
  adminLogin,
  call,
  createStoreAdmin,
  db,
} from './helpers.mjs';

const STORE = 'it-store-perm';
const HOST = 'toko-izin.platform.test';
const s = {};

const roles = (method = 'GET', json, cookie = s.superCookie) =>
  call('/api/platform/roles', { method, json, cookie });
const as = (who, path, options = {}) =>
  call(path, { host: HOST, cookie: s[who].cookie, ...options });
const findRole = async (key) =>
  (await roles()).body.roles.find((role) => role.key === key);

before(async () => {
  await db.query(
    "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ($1,'toko-izin','Toko Izin','t','t')",
    [STORE],
  );
  s.superCookie = await adminCookie();
  for (const role of ['store_owner', 'store_admin', 'store_staff']) {
    const account = await createStoreAdmin(STORE, role);
    s[role] = {
      ...account,
      cookie: (await adminLogin({ ...account, host: HOST })).cookie,
    };
  }
});

after(async () => {
  // Built-in roles back to their defaults for the other test files.
  await db.query('DELETE FROM admin_roles WHERE is_system=1');
  await db.end();
});

describe('akses', () => {
  it('hanya super admin yang mengelola peran', async () => {
    for (const who of ['store_owner', 'store_admin', 'store_staff'])
      assert.equal(
        (
          await call('/api/platform/roles', {
            host: HOST,
            cookie: s[who].cookie,
          })
        ).status,
        403,
        who,
      );
    assert.equal((await call('/api/platform/roles')).status, 403);
  });

  it('peran bawaan tampil dengan izin bawaannya', async () => {
    const response = await roles();
    assert.equal(response.status, 200);
    const keys = response.body.roles.map((role) => role.key);
    assert.deepEqual(keys.slice(0, 3), [
      'store_owner',
      'store_admin',
      'store_staff',
    ]);
    const staff = response.body.roles[2];
    assert.ok(staff.permissions.includes('orders.view'));
    assert.ok(!staff.permissions.includes('reports.view'));
    assert.equal(response.body.roles[0].editable, false);
  });
});

describe('izin peran bawaan', () => {
  it('izin Pemilik tidak bisa diubah', async () => {
    const response = await roles('PATCH', {
      key: 'store_owner',
      permissions: [],
    });
    assert.equal(response.status, 400);
  });

  it('mengubah izin Staf langsung berlaku', async () => {
    assert.equal((await as('store_staff', '/api/admin/products')).status, 200);
    const staff = await findRole('store_staff');
    const response = await roles('PATCH', {
      key: 'store_staff',
      permissions: staff.permissions.filter((p) => p !== 'products.view'),
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal((await as('store_staff', '/api/admin/products')).status, 403);
    // Adding a permission works too.
    assert.equal((await as('store_staff', '/api/admin/reports')).status, 403);
    await roles('PATCH', {
      key: 'store_staff',
      permissions: [...staff.permissions, 'reports.view'],
    });
    assert.equal((await as('store_staff', '/api/admin/reports')).status, 200);
    assert.equal((await as('store_staff', '/api/admin/products')).status, 200);
  });

  it('izin tidak dikenal diabaikan', async () => {
    await roles('PATCH', {
      key: 'store_staff',
      permissions: ['orders.view', 'platform.everything', 42],
    });
    assert.deepEqual((await findRole('store_staff')).permissions, [
      'orders.view',
    ]);
    await db.query("DELETE FROM admin_roles WHERE id='store_staff'");
  });
});

describe('peran kustom', () => {
  it('validasi', async () => {
    for (const [json, status] of [
      [{ name: '', baseRole: 'store_staff', permissions: [] }, 400],
      [{ name: 'Liar', baseRole: 'store_owner', permissions: [] }, 400],
      [{ name: 'Liar', baseRole: 'store_staff' }, 400],
      [{ name: 'Admin', baseRole: 'store_staff', permissions: [] }, 409],
    ])
      assert.equal(
        (await roles('POST', json)).status,
        status,
        JSON.stringify(json),
      );
  });

  it('dibuat dan tercatat', async () => {
    const response = await roles('POST', {
      name: 'Admin Keuangan',
      description: 'Pesanan & laporan saja',
      baseRole: 'store_staff',
      permissions: ['orders.view', 'reports.view'],
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    s.finance = `custom:${response.body.role.id}`;
    assert.equal(
      (
        await roles('POST', {
          name: 'admin keuangan',
          baseRole: 'store_staff',
          permissions: [],
        })
      ).status,
      409,
    );
    const { rows } = await db.query(
      "SELECT store_id FROM audit_logs WHERE action='platform.role.create' AND target_id=$1",
      [response.body.role.id],
    );
    assert.deepEqual(rows, [{ store_id: null }]);
  });

  it('pemilik toko memberi peran kustom kepada anggota', async () => {
    const members = await as('store_owner', '/api/admin/members');
    assert.ok(members.body.roles.some((role) => role.key === s.finance));
    const response = await as('store_owner', '/api/admin/members', {
      method: 'PATCH',
      json: { userId: s.store_staff.userId, role: s.finance },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const list = (await as('store_owner', '/api/admin/members')).body.members;
    const member = list.find((item) => item.userId === s.store_staff.userId);
    assert.equal(member.roleKey, s.finance);
    assert.equal(member.customRoleName, 'Admin Keuangan');
  });

  it('anggota hanya bisa memakai izin peran kustomnya', async () => {
    assert.equal((await as('store_staff', '/api/admin/reports')).status, 200);
    assert.equal((await as('store_staff', '/api/admin/orders')).status, 200);
    assert.equal((await as('store_staff', '/api/admin/products')).status, 403);
    const page = await as('store_staff', '/admin');
    assert.ok(page.text.includes('Admin Keuangan'));
  });

  it('admin toko tidak boleh memberi peran kustom tingkat Admin', async () => {
    const created = await roles('POST', {
      name: 'Manajer Toko',
      baseRole: 'store_admin',
      permissions: ['orders.view', 'members.view', 'members.manage'],
    });
    s.manager = `custom:${created.body.role.id}`;
    const member = await createStoreAdmin(STORE, 'store_staff');
    const denied = await as('store_admin', '/api/admin/members', {
      method: 'PATCH',
      json: { userId: member.userId, role: s.manager },
    });
    assert.equal(denied.status, 403);
    const allowed = await as('store_owner', '/api/admin/members', {
      method: 'PATCH',
      json: { userId: member.userId, role: s.manager },
    });
    assert.equal(allowed.status, 200);
    s.managerMember = member;
  });

  it('menambah anggota baru langsung dengan peran kustom', async () => {
    const response = await as('store_owner', '/api/admin/members', {
      method: 'POST',
      json: { email: 'keuangan@integration.test', role: s.finance },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const { rows } = await db.query(
      'SELECT role, custom_role_id FROM store_memberships WHERE store_id=$1 AND user_id=$2',
      [STORE, response.body.userId],
    );
    assert.deepEqual(rows, [
      { role: 'store_staff', custom_role_id: s.finance.slice(7) },
    ]);
  });

  it('mengubah tingkat peran kustom ikut mengubah anggotanya', async () => {
    const response = await roles('PATCH', {
      key: s.finance,
      name: 'Admin Keuangan',
      baseRole: 'store_admin',
      permissions: ['orders.view', 'reports.view', 'audit.view'],
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const { rows } = await db.query(
      'SELECT DISTINCT role FROM store_memberships WHERE custom_role_id=$1',
      [s.finance.slice(7)],
    );
    assert.deepEqual(rows, [{ role: 'store_admin' }]);
    assert.equal((await as('store_staff', '/api/admin/audit')).status, 200);
    assert.equal((await findRole(s.finance)).members, 2);
  });

  it('peran dihapus: anggota kembali ke peran dasarnya', async () => {
    assert.equal((await roles('DELETE', { key: 'store_staff' })).status, 400);
    const response = await roles('DELETE', { key: s.finance });
    assert.equal(response.status, 200);
    const { rows } = await db.query(
      'SELECT role, custom_role_id FROM store_memberships WHERE store_id=$1 AND user_id=$2',
      [STORE, s.store_staff.userId],
    );
    assert.deepEqual(rows, [{ role: 'store_admin', custom_role_id: null }]);
    // Built-in Admin permissions now apply (products allowed again).
    assert.equal((await as('store_staff', '/api/admin/products')).status, 200);
    assert.equal((await roles('DELETE', { key: s.finance })).status, 404);
  });

  it('peran kustom tidak berlaku di toko lain', async () => {
    const other = await call('/api/admin/orders', {
      cookie: (await adminLogin({ ...s.managerMember })).cookie,
    });
    assert.equal(other.status, 403);
  });
});
