import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { getCurrentStore, storeNotFound } from '@/lib/tenant';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const store = await getCurrentStore();
  if (!store) return storeNotFound();
  const { email } = (await request.json()) as { email?: string };
  const normalizedEmail = email?.trim().toLowerCase() ?? '';

  if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254)
    return NextResponse.json(
      { error: 'Masukkan alamat email yang valid.' },
      { status: 400 },
    );

  await getD1()
    .prepare(
      `INSERT INTO newsletter_subscribers (store_id, email, active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(store_id, email) DO UPDATE SET active=1, updated_at=excluded.updated_at`,
    )
    .bind(
      store.id,
      normalizedEmail,
      new Date().toISOString(),
      new Date().toISOString(),
    )
    .run();

  return NextResponse.json({ ok: true });
}
