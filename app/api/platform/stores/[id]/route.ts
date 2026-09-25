import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { platformErrorResponse, updateStore } from '@/lib/platform';

/** Rename a store or change its status (active / suspended / closed). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      status?: unknown;
    };
    const { before, after } = await updateStore(id, body);
    await audit(auth.admin, {
      storeId: id,
      action: 'platform.store.update',
      target: { type: 'store', id: after.slug },
      meta: {
        ...(before.name !== after.name
          ? { from: before.name, to: after.name }
          : {}),
        ...(before.status !== after.status
          ? { status: `${before.status} → ${after.status}` }
          : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
