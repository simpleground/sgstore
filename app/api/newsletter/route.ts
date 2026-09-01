import { NextResponse } from 'next/server';
import { getD1 } from '@/db';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };
  const normalizedEmail = email?.trim().toLowerCase() ?? '';

  if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254)
    return NextResponse.json(
      { error: 'Masukkan alamat email yang valid.' },
      { status: 400 },
    );

  await getD1()
    .prepare(
      `INSERT INTO newsletter_subscribers (email, active, created_at, updated_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(email) DO UPDATE SET active=1, updated_at=excluded.updated_at`,
    )
    .bind(normalizedEmail, new Date().toISOString(), new Date().toISOString())
    .run();

  return NextResponse.json({ ok: true });
}
