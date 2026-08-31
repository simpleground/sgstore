import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getD1() {
  if (!env.DB) throw new Error('D1 binding DB is unavailable');
  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export function getAdminSetupCode() {
  return env.ADMIN_SETUP_CODE ?? '';
}

export function getFiles() {
  if (!env.FILES) throw new Error('R2 binding FILES is unavailable');
  return env.FILES;
}
