import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { createCustomerSession } from '@/app/customer-auth';
const CLIENT_ID =
  '288475161498-4t2ksn25uhbgc2vm1f1h9bvsuln5feu0.apps.googleusercontent.com';
export async function POST(req: Request) {
  try {
    const { credential } = (await req.json()) as { credential?: string };
    if (!credential)
      return NextResponse.json(
        { error: 'Token Google tidak tersedia.' },
        { status: 400 },
      );
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    );
    if (!r.ok)
      return NextResponse.json(
        { error: 'Login Google tidak valid.' },
        { status: 401 },
      );
    const g = (await r.json()) as any;
    if (
      g.aud !== CLIENT_ID ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(g.iss) ||
      g.email_verified !== 'true' ||
      Number(g.exp) * 1000 < Date.now()
    )
      return NextResponse.json(
        { error: 'Identitas Google tidak valid.' },
        { status: 401 },
      );
    const now = new Date().toISOString();
    await getD1()
      .prepare(
        'INSERT INTO customers (user_id,name,email,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,email=excluded.email',
      )
      .bind(g.sub, g.name || g.email, g.email, now)
      .run();
    await createCustomerSession(g.sub);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Login Google gagal.' }, { status: 500 });
  }
}
