/**
 * Admin authentication (replaces the old "Sign in with ChatGPT").
 *
 * Admins can log in with:
 *   1. Email + password (stored as a PBKDF2 hash). The main admin account is
 *      defined by ADMIN_EMAIL / ADMIN_PASSWORD in .env, or
 *   2. Google — the Google email must belong to an admin account, or be listed
 *      in ADMIN_EMAILS (then the account is created automatically).
 *
 * Sessions are random tokens in an httpOnly cookie; only a SHA-256 hash of the
 * token is stored in the admin_sessions table.
 *
 * Multi-toko: an admin may only manage the store of the current host (see
 * lib/tenant.ts) when they are a member of it (store_memberships), or when they
 * are a platform super_admin. Use authorizeStore('<permission>') in API routes
 * and use its `admin.store.id` for every query — never a store id sent by the
 * browser. Roles and permissions: lib/permissions.ts.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { roleCan, type Permission, type StoreRole } from '@/lib/permissions';
import { secureCookies } from '@/lib/site';
import { getCurrentStore, getDefaultStore, type Store } from '@/lib/tenant';

const COOKIE = 'sg_admin';
const SESSION_DAYS = 14;

export type AdminUser = {
  userId: string;
  email: string;
  name: string;
  displayName: string;
  platformRole: 'super_admin' | null;
};

export type { StoreRole } from '@/lib/permissions';

/** A logged-in admin allowed to manage the current store. */
export type StoreAdmin = AdminUser & {
  store: Store;
  /** Membership role; null for a super_admin who is not a member of this store. */
  role: StoreRole | null;
};

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await getD1()
    .prepare(
      'SELECT a.user_id AS "userId", a.email, a.name, a.platform_role AS "platformRole" FROM admin_sessions s JOIN admin_users a ON a.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
    )
    .bind(await sha256(token), new Date().toISOString())
    .first<Omit<AdminUser, 'displayName'>>();
  if (!row) return null;
  return { ...row, displayName: row.name || row.email };
}

async function membershipRole(storeId: string, userId: string) {
  return getD1()
    .prepare('SELECT role FROM store_memberships WHERE store_id=? AND user_id=?')
    .bind(storeId, userId)
    .first<StoreRole>('role');
}

/** true when the admin account may manage the store (member or super_admin). */
export async function canManageStore(
  userId: string,
  platformRole: string | null,
  storeId: string,
) {
  return platformRole === 'super_admin' || Boolean(await membershipRole(storeId, userId));
}

/**
 * For API routes: the logged-in admin of the current store, or null when not
 * logged in, the host has no store, or the admin does not belong to the store.
 */
export async function getStoreAdmin(): Promise<StoreAdmin | null> {
  const [admin, store] = await Promise.all([getAdmin(), getCurrentStore()]);
  if (!admin || !store) return null;
  // A closed store is managed only by the platform (suspended stores keep their admins).
  if (store.status === 'closed' && admin.platformRole !== 'super_admin') return null;
  const role = await membershipRole(store.id, admin.userId);
  if (!role && admin.platformRole !== 'super_admin') return null;
  return { ...admin, store, role };
}

/**
 * The role used for permission checks: null (= everything) for a platform
 * super_admin, even when they are also a member of the store.
 */
export function effectiveRole(admin: StoreAdmin): StoreRole | null {
  return admin.platformRole === 'super_admin' ? null : admin.role;
}

export function adminCan(admin: StoreAdmin, permission: Permission) {
  return roleCan(effectiveRole(admin), permission);
}

export function forbiddenForRole() {
  return NextResponse.json(
    { error: 'Peran Anda di toko ini tidak diizinkan melakukan tindakan ini.' },
    { status: 403 },
  );
}

/**
 * For API routes: the admin of the current store who has `permission`.
 *   const auth = await authorizeStore('products.edit');
 *   if (!auth.ok) return auth.response;
 */
export async function authorizeStore(
  permission: Permission,
): Promise<{ ok: true; admin: StoreAdmin } | { ok: false; response: NextResponse }> {
  const admin = await getStoreAdmin();
  if (!admin)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 }),
    };
  if (!adminCan(admin, permission)) return { ok: false, response: forbiddenForRole() };
  return { ok: true, admin };
}

/**
 * For platform API routes: the logged-in platform super_admin (any host).
 *   const auth = await requireSuperAdmin();
 *   if (!auth.ok) return auth.response;
 */
export async function requireSuperAdmin(): Promise<
  { ok: true; admin: AdminUser } | { ok: false; response: NextResponse }
> {
  const admin = await getAdmin();
  if (admin?.platformRole === 'super_admin') return { ok: true, admin };
  return {
    ok: false,
    response: NextResponse.json({ error: 'Khusus admin platform.' }, { status: 403 }),
  };
}

/** true when the request comes from an admin of the current store. */
export async function isAdmin() {
  return Boolean(await getStoreAdmin());
}

/** For pages: redirect to the admin login page when not an admin of this store. */
export async function requireAdmin(returnTo = '/admin') {
  const admin = await getStoreAdmin();
  if (admin) return admin;
  redirect(`/admin/login?next=${encodeURIComponent(returnTo.startsWith('/') ? returnTo : '/admin')}`);
}

export async function findAdminByEmail(email: string) {
  return getD1()
    .prepare('SELECT user_id, email, name, password_hash, platform_role FROM admin_users WHERE email=?')
    .bind(email.trim().toLowerCase())
    .first<{
      user_id: string;
      email: string;
      name: string;
      password_hash: string | null;
      platform_role: string | null;
    }>();
}

/** Add the admin to a store (no change when already a member). */
export async function addStoreMember(storeId: string, userId: string, role: StoreRole) {
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      'INSERT INTO store_memberships (store_id,user_id,role,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT (store_id,user_id) DO NOTHING',
    )
    .bind(storeId, userId, role, now, now)
    .run();
}

export async function createAdmin(input: { email: string; name: string; passwordHash: string | null }) {
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  await getD1()
    .prepare(
      'INSERT INTO admin_users (user_id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    )
    .bind(userId, input.email.trim().toLowerCase(), input.name.trim(), input.passwordHash, now, now)
    .run();
  return userId;
}

/**
 * Make sure the admin account from ADMIN_EMAIL / ADMIN_PASSWORD exists and
 * uses the current password from .env. This account is the platform owner:
 * super_admin, and owner of the default store. Returns the account's user_id,
 * or null when those variables are not set.
 */
export async function syncEnvAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const existing = await findAdminByEmail(email);
  const userId =
    existing?.user_id ??
    (await createAdmin({
      email,
      name: process.env.ADMIN_NAME?.trim() || 'Admin',
      passwordHash: await hashPassword(password),
    }));
  if (existing && !(await verifyPassword(password, existing.password_hash)))
    await getD1()
      .prepare('UPDATE admin_users SET password_hash=?, updated_at=? WHERE user_id=?')
      .bind(await hashPassword(password), new Date().toISOString(), userId)
      .run();
  if (existing?.platform_role !== 'super_admin')
    await getD1()
      .prepare("UPDATE admin_users SET platform_role='super_admin', updated_at=? WHERE user_id=?")
      .bind(new Date().toISOString(), userId)
      .run();
  const defaultStore = await getDefaultStore();
  if (defaultStore) await addStoreMember(defaultStore.id, userId, 'store_owner');
  return userId;
}

/** Emails in ADMIN_EMAILS may always log in with Google to the default store. */
export function allowedAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function createAdminSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  const d1 = getD1();
  await d1.batch([
    d1.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(now.toISOString()),
    d1
      .prepare('INSERT INTO admin_sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
      .bind(await sha256(token), userId, expires.toISOString(), now.toISOString()),
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token)
    await getD1()
      .prepare('DELETE FROM admin_sessions WHERE token_hash=?')
      .bind(await sha256(token))
      .run();
  jar.set(COOKIE, '', { httpOnly: true, secure: secureCookies(), sameSite: 'lax', path: '/', maxAge: 0 });
}

// ---- Simple brute-force protection (per server process) -------------------
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

export function loginLocked(key: string) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.until && entry.until > Date.now()) return true;
  if (entry.until && entry.until <= Date.now()) attempts.delete(key);
  return false;
}

export function recordLoginFailure(key: string) {
  const entry = attempts.get(key) ?? { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.until = Date.now() + LOCK_MS;
  attempts.set(key, entry);
  if (attempts.size > 5000) attempts.clear();
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
