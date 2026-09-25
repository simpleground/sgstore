import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { requireSuperAdmin } from '@/lib/admin-auth';
import {
  createHandoff,
  HANDOFF_SECONDS,
  storeAdminHost,
} from '@/lib/admin-handoff';
import type { Store } from '@/lib/tenant';

/**
 * A one-time link that signs the super_admin into this store's admin panel on
 * the store's own domain (valid for HANDOFF_SECONDS, usable once).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const store = await getD1()
    .prepare('SELECT id, slug, name FROM stores WHERE id=?')
    .bind(id)
    .first<Pick<Store, 'id' | 'slug' | 'name'>>();
  if (!store)
    return NextResponse.json(
      { error: 'Toko tidak ditemukan.' },
      { status: 404 },
    );
  const requestHost = request.headers.get('host');
  const host = await storeAdminHost(store, requestHost);
  if (!host)
    return NextResponse.json(
      {
        error: `${store.name} belum punya alamat. Tambahkan domain atau isi PLATFORM_ROOT_DOMAIN.`,
      },
      { status: 400 },
    );
  // Same scheme (and port, in development) as the platform console itself.
  const protocol =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    new URL(request.url).protocol.replace(':', '');
  const port = requestHost?.match(/:\d+$/)?.[0] ?? '';
  const token = await createHandoff(auth.admin.userId, store.id);
  const url = new URL(
    `${protocol === 'http' ? 'http' : 'https'}://${host}${port}/api/admin/handoff`,
  );
  url.searchParams.set('token', token);
  return NextResponse.json(
    { url: url.toString(), expiresIn: HANDOFF_SECONDS },
    { headers: { 'cache-control': 'no-store' } },
  );
}
