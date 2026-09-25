/**
 * Platform (super admin): membuat & mengelola toko, domain, dan pemilik.
 * Semua fungsi di sini hanya dipanggil dari /api/platform/* setelah
 * requireSuperAdmin().
 */
import { getD1 } from '@/db';
import { createAdmin, findAdminByEmail } from '@/lib/admin-auth';
import { clearStoreCache, normalizeHost, type Store } from '@/lib/tenant';

type StoreStatus = Store['status'];

export class PlatformError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Slugs that would clash with platform hosts (admin.platform.id, www…). */
const RESERVED_SLUGS = new Set([
  'www',
  'admin',
  'api',
  'app',
  'platform',
  'mail',
  'smtp',
  'ftp',
  'static',
  'assets',
  'cdn',
  'img',
  'images',
  'status',
  'help',
  'support',
  'default',
  'dashboard',
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES: StoreStatus[] = ['active', 'suspended', 'closed'];

export function validateSlug(value: unknown) {
  const slug = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) || slug.length < 3)
    throw new PlatformError(
      'Slug 3–63 karakter: huruf kecil, angka, dan tanda hubung (tidak di awal/akhir).',
    );
  if (RESERVED_SLUGS.has(slug))
    throw new PlatformError(`Slug "${slug}" dicadangkan untuk platform.`);
  return slug;
}

function validateName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length < 2 || name.length > 80)
    throw new PlatformError('Nama toko 2–80 karakter.');
  return name;
}

function validateEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!emailPattern.test(email) || email.length > 254)
    throw new PlatformError('Email pemilik tidak valid.');
  return email;
}

/** A custom domain or subdomain for a store (without scheme/port). */
export function validateDomain(value: unknown) {
  const host = normalizeHost(typeof value === 'string' ? value : '');
  if (!host || !host.includes('.') || host.startsWith('www.'))
    throw new PlatformError(
      'Domain tidak valid. Contoh: tokoanda.com (tanpa https:// dan tanpa www.).',
    );
  const root = normalizeHost(process.env.PLATFORM_ROOT_DOMAIN);
  if (root && host === root)
    throw new PlatformError(
      'Domain utama platform tidak bisa dipakai sebagai domain toko.',
    );
  return host;
}

async function storeOrThrow(id: string) {
  const store = await getD1()
    .prepare(
      'SELECT id,slug,name,status,email,phone,address,timezone,currency FROM stores WHERE id=?',
    )
    .bind(id)
    .first<Store>();
  if (!store) throw new PlatformError('Toko tidak ditemukan.', 404);
  return store;
}

export async function listStores() {
  const { results: stores } = await getD1()
    .prepare(
      `SELECT s.id, s.slug, s.name, s.status, s.created_at AS "createdAt",
              (SELECT count(*) FROM products p WHERE p.store_id=s.id AND p.deleted_at IS NULL)::int AS products,
              (SELECT count(*) FROM orders o WHERE o.store_id=s.id)::int AS orders
       FROM stores s ORDER BY s.created_at, s.name`,
    )
    .all<{
      id: string;
      slug: string;
      name: string;
      status: StoreStatus;
      createdAt: string;
      products: number;
      orders: number;
    }>();
  const { results: domains } = await getD1()
    .prepare(
      'SELECT store_id AS "storeId", host, is_primary AS "isPrimary" FROM store_domains ORDER BY host',
    )
    .all<{ storeId: string; host: string; isPrimary: number }>();
  const { results: owners } = await getD1()
    .prepare(
      `SELECT m.store_id AS "storeId", a.email FROM store_memberships m
       JOIN admin_users a ON a.user_id=m.user_id WHERE m.role='store_owner' ORDER BY a.email`,
    )
    .all<{ storeId: string; email: string }>();
  const root = normalizeHost(process.env.PLATFORM_ROOT_DOMAIN);
  return stores.map((store) => ({
    ...store,
    subdomain: root ? `${store.slug}.${root}` : '',
    domains: domains
      .filter((domain) => domain.storeId === store.id)
      .map((domain) => ({
        host: domain.host,
        primary: domain.isPrimary === 1,
      })),
    owners: owners
      .filter((owner) => owner.storeId === store.id)
      .map((owner) => owner.email),
  }));
}

/**
 * Link an owner by email. A new account has no password (Google sign-in with
 * that email); an existing account keeps its password and name.
 */
async function linkOwner(storeId: string, emailInput: unknown) {
  const email = validateEmail(emailInput);
  const existing = await findAdminByEmail(email);
  const userId =
    existing?.user_id ??
    (await createAdmin({
      email,
      name: email.split('@')[0],
      passwordHash: null,
    }));
  await getD1()
    .prepare(
      `INSERT INTO store_memberships (store_id,user_id,role,created_at,updated_at) VALUES (?,?,'store_owner',?,?)
       ON CONFLICT (store_id,user_id) DO UPDATE SET role='store_owner', updated_at=excluded.updated_at`,
    )
    .bind(storeId, userId, new Date().toISOString(), new Date().toISOString())
    .run();
  return { email, userId, newAccount: !existing };
}

export async function createStore(input: {
  name?: unknown;
  slug?: unknown;
  ownerEmail?: unknown;
  domain?: unknown;
}) {
  const name = validateName(input.name);
  const slug = validateSlug(input.slug);
  validateEmail(input.ownerEmail);
  const domain = input.domain ? validateDomain(input.domain) : '';
  const d1 = getD1();
  if (await d1.prepare('SELECT 1 FROM stores WHERE slug=?').bind(slug).first())
    throw new PlatformError(`Slug "${slug}" sudah dipakai toko lain.`, 409);
  if (
    domain &&
    (await d1
      .prepare('SELECT 1 FROM store_domains WHERE host=?')
      .bind(domain)
      .first())
  )
    throw new PlatformError(`Domain ${domain} sudah dipakai toko lain.`, 409);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await d1
    .prepare(
      "INSERT INTO stores (id,slug,name,status,created_at,updated_at) VALUES (?,?,?,'active',?,?)",
    )
    .bind(id, slug, name, now, now)
    .run();
  const owner = await linkOwner(id, input.ownerEmail);
  if (domain)
    await d1
      .prepare(
        'INSERT INTO store_domains (host,store_id,is_primary,created_at) VALUES (?,?,1,?)',
      )
      .bind(domain, id, now)
      .run();
  clearStoreCache();
  return { id, slug, name, owner };
}

export async function updateStore(
  id: string,
  input: { name?: unknown; status?: unknown },
) {
  const store = await storeOrThrow(id);
  const name = input.name === undefined ? store.name : validateName(input.name);
  const status = input.status === undefined ? store.status : input.status;
  if (typeof status !== 'string' || !STATUSES.includes(status as StoreStatus))
    throw new PlatformError('Status toko tidak valid.');
  await getD1()
    .prepare('UPDATE stores SET name=?,status=?,updated_at=? WHERE id=?')
    .bind(name, status, new Date().toISOString(), id)
    .run();
  clearStoreCache();
  return {
    before: store,
    after: { ...store, name, status: status as StoreStatus },
  };
}

export async function addDomain(
  id: string,
  hostInput: unknown,
  primary: boolean,
) {
  await storeOrThrow(id);
  const host = validateDomain(hostInput);
  const d1 = getD1();
  const owner = await d1
    .prepare('SELECT store_id FROM store_domains WHERE host=?')
    .bind(host)
    .first<string>('store_id');
  if (owner)
    throw new PlatformError(
      `Domain ${host} sudah dipakai${owner === id ? ' toko ini' : ' toko lain'}.`,
      409,
    );
  const hasPrimary = await d1
    .prepare('SELECT 1 FROM store_domains WHERE store_id=? AND is_primary=1')
    .bind(id)
    .first();
  if (primary && hasPrimary)
    await d1
      .prepare('UPDATE store_domains SET is_primary=0 WHERE store_id=?')
      .bind(id)
      .run();
  await d1
    .prepare(
      'INSERT INTO store_domains (host,store_id,is_primary,created_at) VALUES (?,?,?,?)',
    )
    .bind(host, id, primary || !hasPrimary ? 1 : 0, new Date().toISOString())
    .run();
  clearStoreCache();
  return host;
}

export async function setPrimaryDomain(id: string, hostInput: unknown) {
  const host = normalizeHost(typeof hostInput === 'string' ? hostInput : '');
  const d1 = getD1();
  if (
    !host ||
    !(await d1
      .prepare('SELECT 1 FROM store_domains WHERE store_id=? AND host=?')
      .bind(id, host)
      .first())
  )
    throw new PlatformError('Domain tidak ditemukan pada toko ini.', 404);
  await d1.batch([
    d1
      .prepare('UPDATE store_domains SET is_primary=0 WHERE store_id=?')
      .bind(id),
    d1
      .prepare(
        'UPDATE store_domains SET is_primary=1 WHERE store_id=? AND host=?',
      )
      .bind(id, host),
  ]);
  clearStoreCache();
  return host;
}

export async function removeDomain(id: string, hostInput: unknown) {
  const host = normalizeHost(typeof hostInput === 'string' ? hostInput : '');
  const result = await getD1()
    .prepare('DELETE FROM store_domains WHERE store_id=? AND host=?')
    .bind(id, host ?? '')
    .run();
  if (!result.meta.changes)
    throw new PlatformError('Domain tidak ditemukan pada toko ini.', 404);
  clearStoreCache();
  return host;
}

export async function addOwner(id: string, email: unknown) {
  await storeOrThrow(id);
  return linkOwner(id, email);
}

/** Route handler helper: PlatformError → JSON error response. */
export function platformErrorResponse(error: unknown) {
  if (error instanceof PlatformError)
    return Response.json({ error: error.message }, { status: error.status });
  throw error;
}
