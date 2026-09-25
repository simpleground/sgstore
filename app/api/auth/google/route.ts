import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { createCustomerSession } from '@/app/customer-auth';
import { verifyGoogleCredential } from '@/lib/google';

export async function POST(req: Request) {
  try {
    const { credential } = (await req.json()) as { credential?: string };
    if (!credential)
      return NextResponse.json(
        { error: 'Token Google tidak tersedia.' },
        { status: 400 },
      );
    const google = await verifyGoogleCredential(credential);
    if (!google)
      return NextResponse.json(
        { error: 'Login Google tidak valid.' },
        { status: 401 },
      );
    const now = new Date().toISOString();
    await getD1()
      .prepare(
        'INSERT INTO customers (user_id,name,email,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,email=excluded.email',
      )
      .bind(google.sub, google.name, google.email, now)
      .run();
    await createCustomerSession(google.sub);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Login Google gagal.' }, { status: 500 });
  }
}
