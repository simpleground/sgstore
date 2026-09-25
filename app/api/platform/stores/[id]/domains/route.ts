import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import {
  addDomain,
  platformErrorResponse,
  removeDomain,
  setPrimaryDomain,
} from '@/lib/platform';

type Context = { params: Promise<{ id: string }> };

async function handle(
  request: Request,
  { params }: Context,
  action: 'add' | 'primary' | 'remove',
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      host?: unknown;
      primary?: unknown;
    };
    const host =
      action === 'add'
        ? await addDomain(id, body.host, body.primary === true)
        : action === 'primary'
          ? await setPrimaryDomain(id, body.host)
          : await removeDomain(id, body.host);
    await audit(auth.admin, {
      storeId: id,
      action: `platform.domain.${action}`,
      target: { type: 'domain', id: host ?? '' },
    });
    return NextResponse.json({ ok: true, host });
  } catch (error) {
    return platformErrorResponse(error);
  }
}

/** Add a domain: { host, primary? } */
export const POST = (request: Request, context: Context) =>
  handle(request, context, 'add');
/** Make a domain the store's primary one: { host } */
export const PATCH = (request: Request, context: Context) =>
  handle(request, context, 'primary');
/** Remove a domain: { host } */
export const DELETE = (request: Request, context: Context) =>
  handle(request, context, 'remove');
