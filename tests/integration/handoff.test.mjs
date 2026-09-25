// Multi-store phase 10: one-time sign-in links from the platform console to a
// store's admin panel on the store's own domain.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  adminCookie,
  adminLogin,
  call,
  createStoreAdmin,
  db,
  sha256,
} from './helpers.mjs';

const STORE = 'it-store-handoff';
const HOST = 'toko-kelola.platform.test';
const s = {};

const requestLink = (storeId, cookie = s.superCookie) =>
  call(`/api/platform/stores/${storeId}/handoff`, { method: 'POST', cookie });
/** Open a link as a browser on `host` would (the URL's host is not resolvable here). */
const open = (url, host = new URL(url).hostname) => {
  const { pathname, search } = new URL(url);
  return call(pathname + search, { host });
};
const sessionCookie = (response) =>
  response.headers
    .getSetCookie()
    .find((value) => value.startsWith('sg_admin='))
    ?.split(';')[0];

before(async () => {
  await db.query(
    "INSERT INTO stores (id,slug,name,status,created_at,updated_at) VALUES ($1,'toko-kelola','Toko Kelola','closed','t','t')",
    [STORE],
  );
  s.superCookie = await adminCookie();
  s.owner = await createStoreAdmin(STORE);
  s.otherSuper = await createStoreAdmin('default');
  await db.query(
    "UPDATE admin_users SET platform_role='super_admin' WHERE user_id=$1",
    [s.otherSuper.userId],
  );
  s.otherSuper.cookie = (await adminLogin(s.otherSuper)).cookie;
});

after(() => db.end());

describe('membuat tautan', () => {
  it('hanya super admin', async () => {
    const owner = await adminLogin({ ...s.owner, host: HOST });
    // A closed store's own admins cannot log in at all; use a member of the default store.
    assert.equal(owner.status, 403);
    const member = await createStoreAdmin('default');
    const cookie = (await adminLogin(member)).cookie;
    assert.equal((await requestLink(STORE, cookie)).status, 403);
    assert.equal((await requestLink(STORE, '')).status, 403);
    assert.equal((await requestLink('tidak-ada')).status, 404);
  });

  it('mengarah ke domain toko; database hanya menyimpan hash', async () => {
    const response = await requestLink(STORE);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const url = new URL(response.body.url);
    assert.equal(url.hostname, HOST);
    assert.equal(url.pathname, '/api/admin/handoff');
    assert.equal(response.body.expiresIn, 60);
    const token = url.searchParams.get('token');
    assert.ok(token.length >= 40);
    const { rows } = await db.query(
      'SELECT token_hash, store_id, used_at FROM admin_handoff_tokens WHERE token_hash=$1',
      [sha256(token)],
    );
    assert.deepEqual(rows, [
      { token_hash: sha256(token), store_id: STORE, used_at: null },
    ]);
    s.url = response.body.url;
  });

  it('toko dengan domain sendiri memakai domain utamanya', async () => {
    await db.query(
      "INSERT INTO store_domains (host,store_id,is_primary,created_at) VALUES ('kelola.test',$1,1,'t')",
      [STORE],
    );
    const response = await requestLink(STORE);
    assert.equal(new URL(response.body.url).hostname, 'kelola.test');
    await db.query("DELETE FROM store_domains WHERE host='kelola.test'");
  });

  it('toko bawaan memakai host panel yang sedang dibuka', async () => {
    const response = await requestLink('default');
    assert.equal(response.status, 200);
    const opened = await open(response.body.url, undefined);
    assert.equal(opened.status, 303);
  });
});

describe('membuka tautan', () => {
  it('tidak berlaku di toko lain', async () => {
    const response = await open(s.url, 'toko-lain.platform.test');
    assert.equal(response.status, 404);
    const other = await open(s.url, '127.0.0.1');
    assert.equal(other.status, 400);
    assert.ok(!sessionCookie(other));
  });

  it('masuk ke admin toko (juga toko yang ditutup) lalu diarahkan ke /admin', async () => {
    const response = await open(s.url);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/admin');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const cookie = sessionCookie(response);
    assert.ok(cookie);
    const products = await call('/api/admin/products', { host: HOST, cookie });
    assert.equal(products.status, 200);
    const { rows } = await db.query(
      "SELECT meta_json FROM audit_logs WHERE store_id=$1 AND action='auth.login' ORDER BY id DESC LIMIT 1",
      [STORE],
    );
    assert.equal(JSON.parse(rows[0].meta_json).method, 'platform');
  });

  it('hanya sekali pakai', async () => {
    const again = await open(s.url);
    assert.equal(again.status, 400);
    assert.match(again.text, /sekali pakai/);
    assert.ok(!sessionCookie(again));
  });

  it('kedaluwarsa setelah 60 detik', async () => {
    const { url } = (await requestLink(STORE)).body;
    await db.query(
      "UPDATE admin_handoff_tokens SET expires_at='2000-01-01T00:00:00.000Z' WHERE token_hash=$1",
      [sha256(new URL(url).searchParams.get('token'))],
    );
    assert.equal((await open(url)).status, 400);
  });

  it('tidak berlaku bila akun sudah bukan super admin', async () => {
    const { url } = (await requestLink(STORE, s.otherSuper.cookie)).body;
    await db.query(
      'UPDATE admin_users SET platform_role=NULL WHERE user_id=$1',
      [s.otherSuper.userId],
    );
    assert.equal((await open(url)).status, 400);
  });

  it('token palsu ditolak', async () => {
    for (const token of ['', 'abc', 'x'.repeat(43), '../../etc'])
      assert.equal(
        (
          await call(`/api/admin/handoff?token=${encodeURIComponent(token)}`, {
            host: HOST,
          })
        ).status,
        400,
        token,
      );
  });
});
