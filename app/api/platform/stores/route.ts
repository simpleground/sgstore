import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { createStore, listStores, platformErrorResponse } from '@/lib/platform';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json(
    {
      stores: await listStores(),
      rootDomain: process.env.PLATFORM_ROOT_DOMAIN || '',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

/** Create a store with its first owner (and optionally a custom domain). */
export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const store = await createStore(body);
    await audit(auth.admin, {
      storeId: store.id,
      action: 'platform.store.create',
      target: { type: 'store', id: store.slug },
      meta: {
        name: store.name,
        email: store.owner.email,
        newAccount: store.owner.newAccount,
      },
    });
    return NextResponse.json({ ok: true, store }, { status: 201 });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
