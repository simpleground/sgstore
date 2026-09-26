import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import {
  addStoreMember,
  authorizeStore,
  createAdmin,
  effectiveRole,
  findAdminByEmail,
  type StoreAdmin,
} from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { canChangeMember, type StoreRole } from '@/lib/permissions';
import { listRoles, parseRoleChoice } from '@/lib/roles';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function memberRole(storeId: string, userId: string) {
  return getD1()
    .prepare(
      'SELECT role FROM store_memberships WHERE store_id=? AND user_id=?',
    )
    .bind(storeId, userId)
    .first<StoreRole>('role');
}

/** Checks shared by PATCH and DELETE; returns an error response or the current role. */
async function checkChange(
  admin: StoreAdmin,
  userId: unknown,
  next: StoreRole | null,
) {
  if (typeof userId !== 'string' || !userId)
    return NextResponse.json(
      { error: 'Anggota tidak valid.' },
      { status: 400 },
    );
  const current = await memberRole(admin.store.id, userId);
  if (!current)
    return NextResponse.json(
      { error: 'Anggota tidak ditemukan.' },
      { status: 404 },
    );
  if (userId === admin.userId)
    return NextResponse.json(
      {
        error:
          'Peran atau keanggotaan Anda sendiri tidak bisa diubah dari sini.',
      },
      { status: 400 },
    );
  if (!canChangeMember(effectiveRole(admin), current, next))
    return NextResponse.json(
      { error: 'Peran Anda tidak diizinkan mengubah anggota ini.' },
      { status: 403 },
    );
  return current;
}

const lastOwnerError = () =>
  NextResponse.json(
    { error: 'Toko harus memiliki minimal satu pemilik.' },
    { status: 409 },
  );

// Only succeeds when the member is not the store's last owner.
const NOT_LAST_OWNER =
  "(role<>'store_owner' OR (SELECT count(*) FROM store_memberships WHERE store_id=? AND role='store_owner') > 1)";

export async function GET() {
  const auth = await authorizeStore('members.view');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const { results } = await getD1()
    .prepare(
      `SELECT m.user_id AS "userId", a.email, a.name, m.role,
        CASE WHEN r.id IS NULL THEN m.role ELSE 'custom:' || r.id END AS "roleKey",
        r.name AS "customRoleName", m.created_at AS "createdAt"
       FROM store_memberships m JOIN admin_users a ON a.user_id=m.user_id
       LEFT JOIN admin_roles r ON r.id=m.custom_role_id AND r.is_system=0
       WHERE m.store_id=?
       ORDER BY CASE m.role WHEN 'store_owner' THEN 1 WHEN 'store_admin' THEN 2 ELSE 3 END, a.email`,
    )
    .bind(admin.store.id)
    .all();
  // Roles that can be chosen (the actual limits are checked on every change).
  const roles = (await listRoles()).map(({ key, name, baseRole }) => ({
    key,
    name,
    baseRole,
  }));
  return NextResponse.json({
    members: results,
    roles,
    me: admin.userId,
    myRole: effectiveRole(admin),
  });
}

/**
 * Add a member by email. A new account has no password: the person signs in
 * with Google using that email, so nobody else knows their credentials. An
 * existing account is only linked to this store; its password and name never
 * change here (it may belong to other stores).
 */
export async function POST(request: Request) {
  const auth = await authorizeStore('members.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: string;
  };
  const email = body.email?.trim().toLowerCase() ?? '';
  const name = body.name?.trim().slice(0, 120) ?? '';
  const choice = await parseRoleChoice(body.role);
  if (!emailPattern.test(email) || email.length > 254 || !choice)
    return NextResponse.json(
      { error: 'Isi email dan peran yang valid.' },
      { status: 400 },
    );
  const { role, customRoleId } = choice;
  if (!canChangeMember(effectiveRole(admin), null, role))
    return NextResponse.json(
      {
        error:
          'Peran Anda tidak diizinkan menambahkan anggota dengan peran ini.',
      },
      { status: 403 },
    );
  const existing = await findAdminByEmail(email);
  if (existing && (await memberRole(admin.store.id, existing.user_id)))
    return NextResponse.json(
      { error: `${email} sudah menjadi anggota toko ini.` },
      { status: 409 },
    );
  const userId =
    existing?.user_id ??
    (await createAdmin({
      email,
      name: name || email.split('@')[0],
      passwordHash: null,
    }));
  await addStoreMember(admin.store.id, userId, role, customRoleId);
  await audit(admin, {
    storeId: admin.store.id,
    action: 'member.add',
    target: { type: 'admin', id: userId },
    meta: { email, role: choice.label, newAccount: !existing },
  });
  return NextResponse.json({ ok: true, userId, newAccount: !existing });
}

export async function PATCH(request: Request) {
  const auth = await authorizeStore('members.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    role?: string;
  };
  const choice = await parseRoleChoice(body.role);
  if (!choice)
    return NextResponse.json({ error: 'Peran tidak valid.' }, { status: 400 });
  const current = await checkChange(admin, body.userId, choice.role);
  if (current instanceof Response) return current;
  const result = await getD1()
    .prepare(
      `UPDATE store_memberships SET role=?, custom_role_id=?, updated_at=? WHERE store_id=? AND user_id=? AND (?='store_owner' OR ${NOT_LAST_OWNER})`,
    )
    .bind(
      choice.role,
      choice.customRoleId,
      new Date().toISOString(),
      admin.store.id,
      body.userId,
      choice.role,
      admin.store.id,
    )
    .run();
  if (!result.meta.changes) return lastOwnerError();
  await audit(admin, {
    storeId: admin.store.id,
    action: 'member.role',
    target: { type: 'admin', id: String(body.userId) },
    meta: { from: current, to: choice.label },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorizeStore('members.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const current = await checkChange(admin, body.userId, null);
  if (current instanceof Response) return current;
  const result = await getD1()
    .prepare(
      `DELETE FROM store_memberships WHERE store_id=? AND user_id=? AND ${NOT_LAST_OWNER}`,
    )
    .bind(admin.store.id, body.userId, admin.store.id)
    .run();
  if (!result.meta.changes) return lastOwnerError();
  await audit(admin, {
    storeId: admin.store.id,
    action: 'member.remove',
    target: { type: 'admin', id: String(body.userId) },
    meta: { role: current },
  });
  return NextResponse.json({ ok: true });
}
