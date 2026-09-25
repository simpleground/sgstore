/**
 * One-time sign-in links from the platform console to a store's admin panel.
 *
 * Admin sessions are cookies of one host, so a super_admin would have to log
 * in again on every store domain. The console instead asks for a link: a
 * random token (only its SHA-256 is stored) that is valid for 60 seconds, for
 * one store, and can be used once. Opening it on the store's own domain
 * creates a normal admin session there.
 */
import { getD1 } from '@/db';
import {
  DEFAULT_STORE_ID,
  normalizeHost,
  resolveStoreByHost,
  type Store,
} from '@/lib/tenant';

export const HANDOFF_SECONDS = 60;

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

function randomToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    'base64url',
  );
}

/**
 * Host of a store's admin panel: its primary domain; for the default store
 * the host of this request; otherwise its platform subdomain.
 */
export async function storeAdminHost(
  store: Pick<Store, 'id' | 'slug'>,
  requestHost: string | null,
) {
  const primary = await getD1()
    .prepare('SELECT host FROM store_domains WHERE store_id=? AND is_primary=1')
    .bind(store.id)
    .first<string>('host');
  if (primary) return primary;
  // The console is served by the default store's host (it has no subdomain of its own).
  if (
    store.id === DEFAULT_STORE_ID &&
    (await resolveStoreByHost(requestHost))?.id === DEFAULT_STORE_ID
  )
    return normalizeHost(requestHost);
  const root = normalizeHost(process.env.PLATFORM_ROOT_DOMAIN);
  return root ? `${store.slug}.${root}` : null;
}

/** Create a link token for a super_admin and one store. Returns the raw token. */
export async function createHandoff(userId: string, storeId: string) {
  const token = randomToken();
  const now = new Date();
  const d1 = getD1();
  await d1.batch([
    d1
      .prepare('DELETE FROM admin_handoff_tokens WHERE expires_at<?')
      .bind(now.toISOString()),
    d1
      .prepare(
        'INSERT INTO admin_handoff_tokens (token_hash,user_id,store_id,expires_at,created_at) VALUES (?,?,?,?,?)',
      )
      .bind(
        await sha256(token),
        userId,
        storeId,
        new Date(now.getTime() + HANDOFF_SECONDS * 1000).toISOString(),
        now.toISOString(),
      ),
  ]);
  return token;
}

/**
 * Use a token on the store it was made for. Returns the user id, or null when
 * the token is unknown, expired, already used or for another store. The
 * account must still be a platform super_admin.
 */
export async function consumeHandoff(token: string, storeId: string) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const now = new Date().toISOString();
  const row = await getD1()
    .prepare(
      `UPDATE admin_handoff_tokens t SET used_at=?
       FROM admin_users a
       WHERE t.token_hash=? AND t.store_id=? AND t.used_at IS NULL AND t.expires_at>?
         AND a.user_id=t.user_id AND a.platform_role='super_admin'
       RETURNING t.user_id AS "userId", a.email`,
    )
    .bind(now, await sha256(token), storeId, now)
    .first<{ userId: string; email: string }>();
  return row ?? null;
}
