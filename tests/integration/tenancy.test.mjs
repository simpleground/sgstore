// Multi-store phase 1: migrations on an existing (single-store) database and
// resolving the store from the request host.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { db } from './helpers.mjs';

const migrationsDir = join(import.meta.dirname, '..', '..', 'db', 'migrations');
const TENANT_TABLES = [
  'products',
  'orders',
  'reviews',
  'cart_items',
  'customers',
  'customer_sessions',
  'shipping_settings',
  'newsletter_subscribers',
];

describe('migrasi pada database lama (sebelum multi-toko)', () => {
  const schema = `${process.env.TEST_SCHEMA}_upgrade`;
  const base = new pg.Client({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  let legacy;

  before(async () => {
    await base.connect();
    await base.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set('options', `-c search_path=${schema}`);
    legacy = new pg.Client({ connectionString: url.toString() });
    await legacy.connect();

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    // 1. Database as it exists in production today: only 0001 plus real data.
    await legacy.query(await readFile(join(migrationsDir, files[0]), 'utf8'));
    const now = new Date().toISOString();
    await legacy.query(
      `INSERT INTO products (id,name,category,tone,price,created_at,updated_at) VALUES ('p1','Kaos Lama','Daily Basic','Hitam',50000,$1,$1);
       INSERT INTO orders (order_number,customer_name,customer_phone,shipping_address,items_json,subtotal,shipping,total,created_at,updated_at) VALUES ('SG-LAMA','A','0812','Alamat','[]',1,1,2,$1,$1);
       INSERT INTO reviews (id,product_id,display_name,rating,body,created_at,updated_at) VALUES ('r1','p1','A',5,'ok',$1,$1);
       INSERT INTO cart_items (user_id,product_id,variant_index,quantity,updated_at) VALUES ('c1','p1',0,1,$1);
       INSERT INTO customers (user_id,name,email,created_at) VALUES ('c1','A','a@lama.test',$1);
       INSERT INTO customer_sessions (token_hash,user_id,expires_at,created_at) VALUES ('t1','c1',$1,$1);
       INSERT INTO shipping_settings (courier_code,courier_name,active,updated_at) VALUES ('jne','JNE',0,$1);
       INSERT INTO newsletter_subscribers (email,created_at,updated_at) VALUES ('n@lama.test',$1,$1);
       INSERT INTO admin_users (user_id,email,name,created_at) VALUES ('adm1','admin@lama.test','Admin',$1);`.replaceAll(
        '$1',
        `'${now}'`,
      ),
    );
    // 2. The new migrations, applied the same way scripts/migrate.mjs does.
    for (const file of files.slice(1)) {
      await legacy.query('BEGIN');
      await legacy.query(await readFile(join(migrationsDir, file), 'utf8'));
      await legacy.query('COMMIT');
    }
  });

  after(async () => {
    await legacy?.end();
    await base.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await base.end();
  });

  it('toko bawaan dibuat', async () => {
    const { rows } = await legacy.query(
      'SELECT id,slug,name,status FROM stores',
    );
    assert.deepEqual(rows, [
      {
        id: 'default',
        slug: 'simple-ground',
        name: 'Simple Ground',
        status: 'active',
      },
    ]);
  });

  it('semua data lama menjadi milik toko bawaan tanpa ada yang hilang', async () => {
    for (const table of TENANT_TABLES) {
      const { rows } = await legacy.query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE store_id='default')::int AS scoped FROM ${table}`,
      );
      assert.equal(rows[0].total, 1, table);
      assert.equal(rows[0].scoped, 1, table);
    }
  });

  it('data lama tidak berubah', async () => {
    const { rows } = await legacy.query(
      "SELECT name,price FROM products WHERE id='p1'",
    );
    assert.deepEqual(rows, [{ name: 'Kaos Lama', price: 50000 }]);
    const settings = await legacy.query('SELECT active FROM shipping_settings');
    assert.equal(settings.rows[0].active, 0);
  });

  it('admin lama menjadi pemilik toko bawaan', async () => {
    const { rows } = await legacy.query(
      'SELECT store_id,user_id,role FROM store_memberships',
    );
    assert.deepEqual(rows, [
      { store_id: 'default', user_id: 'adm1', role: 'store_owner' },
    ]);
    const admin = await legacy.query('SELECT platform_role FROM admin_users');
    assert.equal(admin.rows[0].platform_role, null);
  });

  it('INSERT tanpa store_id ditolak (tidak diam-diam masuk toko bawaan)', async () => {
    await assert.rejects(
      legacy.query(
        "INSERT INTO products (id,name,category,tone,price,created_at,updated_at) VALUES ('p2','Baru','X','Y',1,'t','t')",
      ),
      /null value in column "store_id"/,
    );
  });

  it('pelanggan per toko: akun Google yang sama boleh ada di toko lain', async () => {
    await legacy.query(
      "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ('s2','toko-dua','Toko Dua','t','t')",
    );
    // Same user_id (Google sub) and email as the legacy customer, other store.
    await legacy.query(
      "INSERT INTO customers (store_id,user_id,name,email,created_at) VALUES ('s2','c1','A','a@lama.test','t')",
    );
    await assert.rejects(
      legacy.query(
        "INSERT INTO customers (store_id,user_id,name,email,created_at) VALUES ('s2','c2','B','a@lama.test','t')",
      ),
      /customers_store_email_key/,
    );
  });

  it('keranjang & ulasan tidak bisa menunjuk produk toko lain', async () => {
    await assert.rejects(
      legacy.query(
        "INSERT INTO cart_items (store_id,user_id,product_id,variant_index,quantity,updated_at) VALUES ('s2','c1','p1',0,1,'t')",
      ),
      /cart_items_store_product_fkey/,
    );
    await assert.rejects(
      legacy.query(
        "INSERT INTO reviews (id,store_id,product_id,display_name,rating,body,created_at,updated_at) VALUES ('r2','s2','p1','A',5,'x','t','t')",
      ),
      /reviews_store_product_fkey/,
    );
  });

  it('session pelanggan hanya untuk pelanggan di toko yang sama', async () => {
    await assert.rejects(
      legacy.query(
        "INSERT INTO customer_sessions (token_hash,store_id,user_id,expires_at,created_at) VALUES ('t9','s2','tidak-ada','t','t')",
      ),
      /customer_sessions_store_customer_fkey/,
    );
  });

  it('kurir & newsletter diatur per toko', async () => {
    await legacy.query(
      "INSERT INTO shipping_settings (store_id,courier_code,courier_name,active,updated_at) VALUES ('s2','jne','JNE',1,'t')",
    );
    await legacy.query(
      "INSERT INTO newsletter_subscribers (store_id,email,created_at,updated_at) VALUES ('s2','n@lama.test','t','t')",
    );
    const { rows } = await legacy.query(
      "SELECT store_id,active FROM shipping_settings WHERE courier_code='jne' ORDER BY store_id",
    );
    assert.deepEqual(rows, [
      { store_id: 'default', active: 0 },
      { store_id: 's2', active: 1 },
    ]);
  });

  it('database menolak store_id yang tidak ada', async () => {
    await assert.rejects(
      legacy.query("UPDATE products SET store_id='tidak-ada' WHERE id='p1'"),
      /foreign key/,
    );
  });

  it('toko yang masih punya data tidak bisa dihapus', async () => {
    await assert.rejects(
      legacy.query("DELETE FROM stores WHERE id='default'"),
      /foreign key/,
    );
  });

  it('slug dan host divalidasi database', async () => {
    const now = new Date().toISOString();
    await assert.rejects(
      legacy.query(
        "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ('x','Toko_Besar','X',$1,$1)",
        [now],
      ),
      /check constraint/,
    );
    await assert.rejects(
      legacy.query(
        "INSERT INTO store_domains (host,store_id,created_at) VALUES ('Toko.Example.com','default',$1)",
        [now],
      ),
      /check constraint/,
    );
  });

  it('migrasi aman dijalankan ulang', async () => {
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const file of files.slice(1))
      await legacy.query(await readFile(join(migrationsDir, file), 'utf8'));
    const { rows } = await legacy.query(
      "SELECT count(*)::int AS n FROM stores WHERE slug='simple-ground'",
    );
    assert.equal(rows[0].n, 1);
  });
});

describe('resolusi toko dari host', () => {
  let tenant;
  let closeDb;
  const env = { ...process.env };

  before(async () => {
    tenant = await import('@/lib/tenant');
    const { getD1 } = await import('@/db');
    closeDb = () => getD1().pool().end();
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES
         ('it-a','uji-a','Uji A',$1,$1), ('it-b','uji-b','Uji B',$1,$1)`,
      [now],
    );
    await db.query(
      "INSERT INTO store_domains (host,store_id,is_primary,created_at) VALUES ('uji-a.example.com','it-a',1,$1)",
      [now],
    );
  });

  after(async () => {
    Object.assign(process.env, env);
    await db.query("DELETE FROM stores WHERE id IN ('it-a','it-b')");
    await db.end();
    await closeDb();
  });

  function configure(values) {
    process.env.PLATFORM_ROOT_DOMAIN = values.root ?? '';
    process.env.DEFAULT_STORE_SLUG = values.defaultSlug ?? '';
    tenant.clearStoreCache();
  }
  const idFor = async (host) =>
    (await tenant.resolveStoreByHost(host))?.id ?? null;

  it('file hanya milik toko yang ada di prefix kuncinya', () => {
    assert.ok(tenant.storeOwnsFileKey('it-a', 'stores/it-a/products/x.png'));
    assert.ok(!tenant.storeOwnsFileKey('it-a', 'stores/it-b/products/x.png'));
    assert.ok(!tenant.storeOwnsFileKey('it-a', 'stores/it-ab/products/x.png'));
    // Photos from before multi-store belong to the default store only.
    assert.ok(tenant.storeOwnsFileKey('default', 'products/x.png'));
    assert.ok(!tenant.storeOwnsFileKey('it-a', 'products/x.png'));
    assert.match(
      tenant.storeFileKey('it-a', 'products', 'png'),
      /^stores\/it-a\/products\/[0-9a-f-]{36}\.png$/,
    );
  });

  it('normalizeHost membuang port, huruf besar, dan menolak nilai aneh', () => {
    assert.equal(
      tenant.normalizeHost('Uji-A.Example.com:443'),
      'uji-a.example.com',
    );
    assert.equal(tenant.normalizeHost('toko.example.com.'), 'toko.example.com');
    assert.equal(tenant.normalizeHost('localhost:3000'), 'localhost');
    for (const value of [
      '',
      null,
      undefined,
      'evil host',
      'a/b',
      '[::1]:3000',
      'a..b',
    ])
      assert.equal(tenant.normalizeHost(value), null, String(value));
  });

  it('localhost, IP, dan domain lama → toko bawaan (kompatibel)', async () => {
    configure({});
    for (const host of [
      'localhost:3000',
      '127.0.0.1',
      'simpleground.online',
      null,
      'evil host',
    ])
      assert.equal(await idFor(host), 'default', String(host));
  });

  it('domain terdaftar → tokonya (termasuk www. dan port)', async () => {
    configure({});
    assert.equal(await idFor('uji-a.example.com'), 'it-a');
    assert.equal(await idFor('WWW.Uji-A.example.com:8443'), 'it-a');
  });

  it('subdomain platform → toko sesuai slug', async () => {
    configure({ root: 'platform.test' });
    assert.equal(await idFor('uji-b.platform.test'), 'it-b');
    assert.equal(await idFor('uji-a.platform.test:3000'), 'it-a');
  });

  it('subdomain platform yang tidak dikenal → tidak ada toko', async () => {
    configure({ root: 'platform.test' });
    assert.equal(await idFor('tidak-ada.platform.test'), null);
    assert.equal(await idFor('x.uji-b.platform.test'), null);
  });

  it('domain utama platform → toko bawaan', async () => {
    configure({ root: 'platform.test' });
    assert.equal(await idFor('platform.test'), 'default');
    assert.equal(await idFor('www.platform.test'), 'default');
  });

  it('DEFAULT_STORE_SLUG mengganti toko bawaan', async () => {
    configure({ defaultSlug: 'uji-b' });
    assert.equal(await idFor('localhost'), 'it-b');
    assert.equal(await idFor('uji-a.example.com'), 'it-a');
  });

  it('hasil dicache per host dan bisa dikosongkan', async () => {
    configure({});
    assert.equal(await idFor('baru.example.com'), 'default');
    await db.query(
      "INSERT INTO store_domains (host,store_id,created_at) VALUES ('baru.example.com','it-b',$1)",
      [new Date().toISOString()],
    );
    assert.equal(await idFor('baru.example.com'), 'default');
    tenant.clearStoreCache();
    assert.equal(await idFor('baru.example.com'), 'it-b');
  });
});
