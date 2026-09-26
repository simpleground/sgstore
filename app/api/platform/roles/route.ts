import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import {
  createRole,
  deleteRole,
  listRoles,
  roleErrorResponse,
  updateRole,
} from '@/lib/roles';

/** Roles & permissions for store members (platform super_admin only). */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json(
    { roles: await listRoles() },
    { headers: { 'cache-control': 'no-store' } },
  );
}

const body = async (request: Request) =>
  (await request.json().catch(() => ({}))) as Record<string, unknown>;

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const role = await createRole(await body(request));
    await audit(auth.admin, {
      storeId: null,
      action: 'platform.role.create',
      target: { type: 'role', id: role.id },
      meta: { name: role.name, permissions: role.permissions.join(', ') },
    });
    return NextResponse.json({ ok: true, role }, { status: 201 });
  } catch (error) {
    return roleErrorResponse(error);
  }
}

/** { key, name?, description?, baseRole?, permissions } */
export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const input = await body(request);
    const role = await updateRole(
      typeof input.key === 'string' ? input.key : '',
      input,
    );
    await audit(auth.admin, {
      storeId: null,
      action: 'platform.role.update',
      target: { type: 'role', id: role.key },
      meta: { name: role.name, permissions: role.permissions.join(', ') },
    });
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    return roleErrorResponse(error);
  }
}

/** { key: 'custom:<id>' } — members fall back to the role's base level. */
export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const input = await body(request);
    const role = await deleteRole(
      typeof input.key === 'string' ? input.key : '',
    );
    await audit(auth.admin, {
      storeId: null,
      action: 'platform.role.delete',
      target: { type: 'role', id: role.id },
      meta: { name: role.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return roleErrorResponse(error);
  }
}
