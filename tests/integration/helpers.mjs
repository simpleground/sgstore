// Shared helpers for the integration tests (run through scripts/test-integration.mjs).
import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';
import pg from 'pg';
import { hashPassword } from '../../scripts/_lib.mjs';

export const appUrl = process.env.TEST_APP_URL;
if (!appUrl) throw new Error('Jalankan lewat: npm run test:integration');

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});

export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');
export const sha512 = (value) =>
  createHash('sha512').update(value).digest('hex');

/**
 * HTTP request to the app. `json` sends a JSON body, `form` a FormData body,
 * `cookie` is sent as the Cookie header and `host` overrides the Host header
 * (the store is chosen from it). Redirects are not followed.
 */
export async function call(
  path,
  { method = 'GET', json, form, cookie, host, headers = {} } = {},
) {
  const requestHeaders = { ...headers };
  let body;
  if (json !== undefined) {
    body = Buffer.from(JSON.stringify(json));
    requestHeaders['content-type'] = 'application/json';
  } else if (form) {
    const encoded = new Request('http://form.local', {
      method: 'POST',
      body: form,
    });
    body = Buffer.from(await encoded.arrayBuffer());
    requestHeaders['content-type'] = encoded.headers.get('content-type');
  }
  if (body) requestHeaders['content-length'] = String(body.length);
  if (cookie) requestHeaders.cookie = cookie;
  if (host) requestHeaders.host = host;
  return new Promise((resolve, reject) => {
    const request = http.request(
      new URL(path, appUrl),
      { method, headers: requestHeaders },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(response.headers))
            for (const item of [value].flat())
              responseHeaders.append(name, item);
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = text;
          try {
            parsed = JSON.parse(text);
          } catch {}
          resolve({
            status: response.statusCode,
            headers: responseHeaders,
            body: parsed,
            text,
          });
        });
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

/** Log in to the admin of the store behind `host`; returns status and cookie. */
export async function adminLogin({
  email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD,
  host,
} = {}) {
  const response = await call('/api/admin/login', {
    method: 'POST',
    host,
    json: { email, password },
  });
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('sg_admin='));
  return { status: response.status, cookie: cookie?.split(';')[0] };
}

/** Log in as the admin from ADMIN_EMAIL / ADMIN_PASSWORD and return its cookie. */
export async function adminCookie(host) {
  const { status, cookie } = await adminLogin({ host });
  if (status !== 200) throw new Error(`Login admin gagal: ${status}`);
  return cookie;
}

/** Create an admin account that is a member of one store. */
export async function createStoreAdmin(storeId, role = 'store_owner') {
  const userId = randomUUID();
  const email = `admin-${userId.slice(0, 8)}@integration.test`;
  const password = `pw-${randomUUID()}`;
  const now = new Date().toISOString();
  await db.query(
    'INSERT INTO admin_users (user_id,email,name,password_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)',
    [userId, email, 'Admin Uji', await hashPassword(password), now],
  );
  await db.query(
    'INSERT INTO store_memberships (store_id,user_id,role,created_at,updated_at) VALUES ($1,$2,$3,$4,$4)',
    [storeId, userId, role, now],
  );
  return { userId, email, password };
}

/**
 * Customers log in with Google, which tests cannot do. Create the same rows the
 * Google login creates (for one store) and return the session cookie.
 */
export async function customerCookie({
  storeId = 'default',
  userId = `it-${randomUUID()}`,
  name = 'Pelanggan Uji',
} = {}) {
  const token = randomUUID() + randomUUID();
  const now = new Date();
  await db.query(
    'INSERT INTO customers (store_id,user_id,name,email,created_at) VALUES ($1,$2,$3,$4,$5)',
    [storeId, userId, name, `${userId}@integration.test`, now.toISOString()],
  );
  await db.query(
    'INSERT INTO customer_sessions (token_hash,store_id,user_id,expires_at,created_at) VALUES ($1,$2,$3,$4,$5)',
    [
      sha256(token),
      storeId,
      userId,
      new Date(now.getTime() + 86400000).toISOString(),
      now.toISOString(),
    ],
  );
  return { userId, cookie: `sg_customer=${token}` };
}

/** FormData for POST /api/admin/products with one photo and two variants. */
export function productForm(
  name,
  { category = 'Daily Basic', sku = 'IT' } = {},
) {
  const form = new FormData();
  form.set('name', name);
  form.set('category', category);
  form.set('subcategory', 'Kaos');
  form.set('description', `Deskripsi ${name}.`);
  form.set('weightGrams', '300');
  form.set('preorder_days', '2');
  form.set(
    'variantsJson',
    JSON.stringify([
      {
        sku: `${sku}-M`,
        color: 'Hitam',
        size: 'M',
        price: 50000,
        normalPrice: 60000,
        stock: 5,
      },
      {
        sku: `${sku}-L`,
        color: 'Hitam',
        size: 'L',
        price: 55000,
        normalPrice: 55000,
        stock: 0,
      },
    ]),
  );
  form.append('images', new File([tinyPng], 'foto.png', { type: 'image/png' }));
  return form;
}

/** Body for POST /api/orders (manual transfer) for one product. */
export const orderBody = (productId, quantity = 1) => ({
  customerName: 'Pelanggan Uji',
  customerPhone: '081234567890',
  shippingAddress: 'Jalan Integrasi No. 1, Bandung',
  destinationPostalCode: '40111',
  paymentMethod: 'manual',
  shippingOption: { courierCode: 'jne', serviceCode: 'reg' },
  items: [{ id: productId, variantIndex: 0, quantity }],
});

// Smallest valid PNG (1×1 pixel).
export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
