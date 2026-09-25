import { NextResponse } from 'next/server';
import { createAdminSession } from '@/lib/admin-auth';
import { consumeHandoff } from '@/lib/admin-handoff';
import { audit } from '@/lib/audit';
import { getCurrentStore } from '@/lib/tenant';

const HEADERS = {
  'cache-control': 'no-store',
  // The token must not leak to other sites through the Referer header.
  'referrer-policy': 'no-referrer',
};

function failed(message: string, status: number) {
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Tautan tidak berlaku</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;color:#1f2937"><h1 style="font-size:1.4rem">Tautan tidak berlaku</h1><p>${message}</p><p><a href="/admin/login">Masuk ke admin toko</a></p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' },
  });
}

/** Opens a one-time link from the platform console (see lib/admin-handoff.ts). */
export async function GET(request: Request) {
  const store = await getCurrentStore();
  if (!store) return failed('Toko tidak ditemukan.', 404);
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const user = await consumeHandoff(token, store.id);
  if (!user)
    return failed(
      'Tautan masuk hanya berlaku 60 detik dan sekali pakai. Kembali ke panel platform lalu klik "Kelola" lagi.',
      400,
    );
  await createAdminSession(user.userId);
  await audit(user, {
    storeId: store.id,
    action: 'auth.login',
    meta: { method: 'platform', platformAdmin: true },
  });
  return new NextResponse(null, {
    status: 303,
    headers: { ...HEADERS, location: '/admin' },
  });
}
