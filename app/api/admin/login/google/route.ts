import { NextResponse } from 'next/server';
import {
  allowedAdminEmails,
  createAdmin,
  createAdminSession,
  findAdminByEmail,
} from '@/lib/admin-auth';
import { verifyGoogleCredential } from '@/lib/google';

export async function POST(request: Request) {
  try {
    const { credential } = (await request.json()) as { credential?: string };
    if (!credential)
      return NextResponse.json({ error: 'Token Google tidak tersedia.' }, { status: 400 });
    const google = await verifyGoogleCredential(credential);
    if (!google)
      return NextResponse.json({ error: 'Login Google tidak valid.' }, { status: 401 });
    const admin = await findAdminByEmail(google.email);
    let userId = admin?.user_id;
    if (!userId && allowedAdminEmails().includes(google.email))
      userId = await createAdmin({ email: google.email, name: google.name, passwordHash: null });
    if (!userId)
      return NextResponse.json(
        { error: `Akun ${google.email} bukan administrator Simple Ground.` },
        { status: 403 },
      );
    await createAdminSession(userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Login Google gagal.' }, { status: 500 });
  }
}
