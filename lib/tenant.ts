/**
 * Multi-toko: menentukan toko aktif dari host request.
 *
 * Urutan pencarian:
 *   1. Tabel store_domains (domain sendiri atau subdomain yang didaftarkan).
 *   2. <slug>.<PLATFORM_ROOT_DOMAIN>, mis. tokoa.platform.id → toko ber-slug "tokoa".
 *      Subdomain yang tidak dikenal → null (bukan toko bawaan).
 *   3. Host lain (localhost, domain lama, IP) → toko bawaan: DEFAULT_STORE_SLUG
 *      bila diisi, selain itu toko dengan id DEFAULT_STORE_ID.
 *
 * Toko ditentukan HANYA dari header Host di server, tidak pernah dari
 * body/query yang dikirim browser. Reverse proxy (Nginx) wajib meneruskan
 * Host asli (`proxy_set_header Host $host;`).
 */
import { headers } from 'next/headers';
import { getD1 } from '@/db';
import type { StoreRow } from '@/db/schema';

/** Id toko bawaan; sama dengan seed di db/migrations/0002_stores.sql. */
export const DEFAULT_STORE_ID = 'default';

export type Store = Omit<StoreRow, 'created_at' | 'updated_at'>;

const STORE_COLUMNS = [
  'id',
  'slug',
  'name',
  'status',
  'email',
  'phone',
  'address',
  'timezone',
  'currency',
];
const CACHE_MS = 30_000;
const CACHE_LIMIT = 1000;

const globalForTenant = globalThis as unknown as {
  __sgStoreCache?: Map<string, { store: Store | null; expires: number }>;
};
const cache = (globalForTenant.__sgStoreCache ??= new Map());

/**
 * Host header → nama host tanpa port, huruf kecil, tanpa titik di akhir.
 * Mengembalikan null untuk nilai yang bukan nama host yang wajar.
 */
export function normalizeHost(value: string | null | undefined) {
  const host = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.split('.').some((label) => !label || label.length > 63)) return null;
  return host;
}

function platformRootDomain() {
  return normalizeHost(process.env.PLATFORM_ROOT_DOMAIN);
}

async function storeWhere(column: 'id' | 'slug', value: string) {
  return getD1()
    .prepare(`SELECT ${STORE_COLUMNS.join(',')} FROM stores WHERE ${column}=?`)
    .bind(value)
    .first<Store>();
}

async function storeByDomain(host: string) {
  return getD1()
    .prepare(
      `SELECT ${STORE_COLUMNS.map((column) => `s.${column}`).join(',')} FROM store_domains d JOIN stores s ON s.id=d.store_id WHERE d.host=?`,
    )
    .bind(host)
    .first<Store>();
}

export async function getDefaultStore() {
  const slug = process.env.DEFAULT_STORE_SLUG?.trim().toLowerCase();
  return slug ? storeWhere('slug', slug) : storeWhere('id', DEFAULT_STORE_ID);
}

async function lookup(host: string | null): Promise<Store | null> {
  if (host) {
    const candidates = host.startsWith('www.') ? [host, host.slice(4)] : [host];
    for (const candidate of candidates) {
      const store = await storeByDomain(candidate);
      if (store) return store;
    }
    const root = platformRootDomain();
    if (
      root &&
      host !== root &&
      host !== `www.${root}` &&
      host.endsWith(`.${root}`)
    ) {
      const label = host.slice(0, -(root.length + 1));
      // Hanya satu tingkat subdomain: tokoa.platform.id, bukan a.b.platform.id.
      if (label.includes('.')) return null;
      return storeWhere('slug', label);
    }
  }
  return getDefaultStore();
}

/** Toko untuk sebuah host (Host header mentah boleh berisi port). */
export async function resolveStoreByHost(rawHost: string | null | undefined) {
  const host = normalizeHost(rawHost);
  const key = host ?? '';
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.store;
  const store = await lookup(host);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, { store, expires: Date.now() + CACHE_MS });
  return store;
}

/** Kosongkan cache setelah data toko/domain diubah. */
export function clearStoreCache() {
  cache.clear();
}

/**
 * Toko untuk request yang sedang berjalan (Server Component / Route Handler).
 * null = host tidak mengarah ke toko mana pun.
 */
export async function getCurrentStore() {
  return resolveStoreByHost((await headers()).get('host'));
}
