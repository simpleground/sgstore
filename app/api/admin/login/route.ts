import { NextResponse } from 'next/server';
import {
  canManageStore,
  clearLoginFailures,
  createAdminSession,
  findAdminByEmail,
  loginLocked,
  recordLoginFailure,
  syncEnvAdmin,
} from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { verifyPassword } from '@/lib/password';
import { getCurrentStore, storeNotFound } from '@/lib/tenant';

export async function POST(request: Request) {
  const store = await getCurrentStore();
  if (!store) return storeNotFound();
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  if (!email || !password)
    return NextResponse.json({ error: 'Isi email dan password.' }, { status: 400 });
  const key = `${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}|${email}`;
  if (loginLocked(key))
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' },
      { status: 429 },
    );
  if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) await syncEnvAdmin();
  const admin = await findAdminByEmail(email);
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    recordLoginFailure(key);
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
  }
  clearLoginFailures(key);
  const actor = { userId: admin.user_id, email: admin.email };
  if (!(await canManageStore(admin.user_id, admin.platform_role, store.id))) {
    await audit(actor, { storeId: store.id, action: 'auth.login_denied', meta: { method: 'password' } });
    return NextResponse.json(
      { error: `Akun ini bukan administrator ${store.name}.` },
      { status: 403 },
    );
  }
  await createAdminSession(admin.user_id);
  await audit(actor, {
    storeId: store.id,
    action: 'auth.login',
    meta: { method: 'password', platformAdmin: admin.platform_role === 'super_admin' },
  });
  return NextResponse.json({ ok: true });
}
