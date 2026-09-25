import { cookies } from 'next/headers';
import { getD1 } from '@/db';
import { secureCookies } from '@/lib/site';
const COOKIE = 'sg_customer';
export type Customer = { userId: string; name: string; email: string };
async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function getCustomer(): Promise<Customer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await getD1()
    .prepare(
      'SELECT c.user_id AS "userId",c.name,c.email FROM customer_sessions s JOIN customers c ON c.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
    )
    .bind(await hash(token), new Date().toISOString())
    .first<Customer>();
  return row ?? null;
}
export async function createCustomerSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID(),
    now = new Date(),
    expires = new Date(now.getTime() + 30 * 86400000);
  await getD1()
    .prepare(
      'INSERT INTO customer_sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)',
    )
    .bind(await hash(token), userId, expires.toISOString(), now.toISOString())
    .run();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    expires,
  });
}
export async function clearCustomerSession() {
  const jar = await cookies(),
    token = jar.get(COOKIE)?.value;
  if (token)
    await getD1()
      .prepare('DELETE FROM customer_sessions WHERE token_hash=?')
      .bind(await hash(token))
      .run();
  jar.set(COOKIE, '', {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
