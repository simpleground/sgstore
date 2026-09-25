import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { addOwner, platformErrorResponse } from '@/lib/platform';

/** Make an account (by email) an owner of the store: { email } */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const { email } = (await request.json().catch(() => ({}))) as {
      email?: unknown;
    };
    const owner = await addOwner(id, email);
    await audit(auth.admin, {
      storeId: id,
      action: 'platform.owner.add',
      target: { type: 'admin', id: owner.userId },
      meta: { email: owner.email, newAccount: owner.newAccount },
    });
    return NextResponse.json({ ok: true, ...owner });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
