import { NextResponse } from 'next/server';
import {
  addStoreMember,
  allowedAdminEmails,
  canManageStore,
  createAdmin,
  createAdminSession,
  findAdminByEmail,
} from '@/lib/admin-auth';
import { verifyGoogleCredential } from '@/lib/google';
import { getCurrentStore, getDefaultStore, storeNotFound } from '@/lib/tenant';

export async function POST(request: Request) {
  try {
    const store = await getCurrentStore();
    if (!store) return storeNotFound();
    const { credential } = (await request.json()) as { credential?: string };
    if (!credential)
      return NextResponse.json({ error: 'Token Google tidak tersedia.' }, { status: 400 });
    const google = await verifyGoogleCredential(credential);
    if (!google)
      return NextResponse.json({ error: 'Login Google tidak valid.' }, { status: 401 });
    const admin = await findAdminByEmail(google.email);
    let userId = admin?.user_id;
    // ADMIN_EMAILS (from .env) only grants access to the default store.
    const allowedByEnv =
      allowedAdminEmails().includes(google.email) && store.id === (await getDefaultStore())?.id;
    if (allowedByEnv) {
      userId ??= await createAdmin({ email: google.email, name: google.name, passwordHash: null });
      await addStoreMember(store.id, userId, 'store_owner');
    }
    if (!userId || !(await canManageStore(userId, admin?.platform_role ?? null, store.id)))
      return NextResponse.json(
        { error: `Akun ${google.email} bukan administrator ${store.name}.` },
        { status: 403 },
      );
    await createAdminSession(userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Login Google gagal.' }, { status: 500 });
  }
}
