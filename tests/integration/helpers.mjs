// Shared helpers for the integration tests (run through scripts/test-integration.mjs).
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

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
 * fetch() against the app. `json` sends a JSON body, `form` a FormData body,
 * `cookie` is sent as the Cookie header. Redirects are not followed.
 */
export async function call(
  path,
  { method = 'GET', json, form, cookie, headers = {} } = {},
) {
  const init = {
    method,
    redirect: 'manual',
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
  };
  if (json !== undefined) init.body = JSON.stringify(json);
  else if (form) init.body = form;
  const response = await fetch(`${appUrl}${path}`, init);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: response.status, headers: response.headers, body, text };
}

/** Log in as the admin from ADMIN_EMAIL / ADMIN_PASSWORD and return its cookie. */
export async function adminCookie() {
  const response = await call('/api/admin/login', {
    method: 'POST',
    json: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  if (response.status !== 200)
    throw new Error(`Login admin gagal: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('sg_admin='));
  return cookie.split(';')[0];
}

/**
 * Customers log in with Google, which tests cannot do. Create the same rows the
 * Google login creates and return the session cookie.
 */
export async function customerCookie(name = 'Pelanggan Uji') {
  const userId = `it-${randomUUID()}`;
  const token = randomUUID() + randomUUID();
  const now = new Date();
  await db.query(
    'INSERT INTO customers (user_id,name,email,created_at) VALUES ($1,$2,$3,$4)',
    [userId, name, `${userId}@integration.test`, now.toISOString()],
  );
  await db.query(
    'INSERT INTO customer_sessions (token_hash,user_id,expires_at,created_at) VALUES ($1,$2,$3,$4)',
    [
      sha256(token),
      userId,
      new Date(now.getTime() + 86400000).toISOString(),
      now.toISOString(),
    ],
  );
  return { userId, cookie: `sg_customer=${token}` };
}

// Smallest valid PNG (1×1 pixel).
export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
