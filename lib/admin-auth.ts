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
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getD1 } from '@/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { secureCookies } from '@/lib/site';

const COOKIE = 'sg_admin';
const SESSION_DAYS = 14;

export type AdminUser = {
  userId: string;
  email: string;
  name: string;
  displayName: string;
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
      'SELECT a.user_id AS "userId", a.email, a.name FROM admin_sessions s JOIN admin_users a ON a.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
    )
    .bind(await sha256(token), new Date().toISOString())
    .first<{ userId: string; email: string; name: string }>();
  if (!row) return null;
  return { ...row, displayName: row.name || row.email };
}

/** For API routes: true when the request comes from a logged-in admin. */
export async function isAdmin() {
  return Boolean(await getAdmin());
}

/** For pages: redirect to the admin login page when not logged in. */
export async function requireAdmin(returnTo = '/admin') {
  const admin = await getAdmin();
  if (admin) return admin;
  redirect(`/admin/login?next=${encodeURIComponent(returnTo.startsWith('/') ? returnTo : '/admin')}`);
}

export async function findAdminByEmail(email: string) {
  return getD1()
    .prepare('SELECT user_id, email, name, password_hash FROM admin_users WHERE email=?')
    .bind(email.trim().toLowerCase())
    .first<{ user_id: string; email: string; name: string; password_hash: string | null }>();
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
 * uses the current password from .env. Returns the account's user_id, or null
 * when those variables are not set.
 */
export async function syncEnvAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const existing = await findAdminByEmail(email);
  if (!existing)
    return createAdmin({
      email,
      name: process.env.ADMIN_NAME?.trim() || 'Admin',
      passwordHash: await hashPassword(password),
    });
  if (!(await verifyPassword(password, existing.password_hash)))
    await getD1()
      .prepare('UPDATE admin_users SET password_hash=?, updated_at=? WHERE user_id=?')
      .bind(await hashPassword(password), new Date().toISOString(), existing.user_id)
      .run();
  return existing.user_id;
}

/** Emails in ADMIN_EMAILS may always log in with Google. */
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
