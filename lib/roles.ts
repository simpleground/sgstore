/**
 * Peran & izin yang diatur admin platform (Admin → Peran & izin).
 *
 * - Pemilik (store_owner): selalu semua izin, tidak bisa diubah.
 * - Admin & Staf (bawaan): izinnya bisa diubah; baris admin_roles dengan id
 *   yang sama menyimpan perubahan, tanpa baris itu dipakai izin bawaan.
 * - Peran kustom: nama & izin sendiri, dengan tingkat dasar Admin atau Staf
 *   (menentukan urutan wewenang saat mengelola anggota).
 *
 * Anggota toko memakai peran bawaan (store_memberships.role) atau peran
 * kustom (store_memberships.custom_role_id; role = tingkat dasarnya).
 */
import { getD1 } from '@/db';
import {
  ALL_PERMISSIONS,
  isPermission,
  permissionsFor,
  ROLE_LABELS,
  type Permission,
  type StoreRole,
} from '@/lib/permissions';

export class RoleError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function roleErrorResponse(error: unknown) {
  if (error instanceof RoleError)
    return Response.json({ error: error.message }, { status: error.status });
  throw error;
}

export type EditableBase = Exclude<StoreRole, 'store_owner'>;
const BASES: EditableBase[] = ['store_admin', 'store_staff'];

export type RoleSummary = {
  /** 'store_owner' | 'store_admin' | 'store_staff' | 'custom:<id>' */
  key: string;
  id: string;
  name: string;
  description: string;
  baseRole: StoreRole;
  permissions: Permission[];
  system: boolean;
  /** false for the owner role (always every permission). */
  editable: boolean;
  members: number;
};

type RoleRow = {
  id: string;
  name: string;
  description: string;
  base_role: EditableBase;
  permissions_json: string;
  is_system: number;
};

function readPermissions(json: string | null | undefined) {
  try {
    const list = JSON.parse(json || '[]') as unknown;
    return Array.isArray(list)
      ? ALL_PERMISSIONS.filter((permission) => list.includes(permission))
      : [];
  } catch {
    return [];
  }
}

const SYSTEM_DESCRIPTIONS: Record<StoreRole, string> = {
  store_owner: 'Semua izin, termasuk pemilik lain dan rekening pembayaran.',
  store_admin: 'Pengelolaan toko sehari-hari.',
  store_staff: 'Pesanan dan produk.',
};

/** Permissions of a membership: custom role, else the (edited) built-in role. */
export async function membershipAccess(storeId: string, userId: string) {
  const row = await getD1()
    .prepare(
      `SELECT m.role, m.custom_role_id AS "customRoleId", c.name AS "customName",
        c.permissions_json AS "customPermissions", s.permissions_json AS "systemPermissions"
       FROM store_memberships m
       LEFT JOIN admin_roles c ON c.id=m.custom_role_id
       LEFT JOIN admin_roles s ON s.id=m.role AND s.is_system=1
       WHERE m.store_id=? AND m.user_id=?`,
    )
    .bind(storeId, userId)
    .first<{
      role: StoreRole;
      customRoleId: string | null;
      customName: string | null;
      customPermissions: string | null;
      systemPermissions: string | null;
    }>();
  if (!row) return null;
  const permissions =
    row.role === 'store_owner'
      ? permissionsFor('store_owner')
      : row.customRoleId && row.customPermissions !== null
        ? readPermissions(row.customPermissions)
        : row.systemPermissions !== null
          ? readPermissions(row.systemPermissions)
          : permissionsFor(row.role);
  return {
    role: row.role,
    customRoleId: row.customPermissions !== null ? row.customRoleId : null,
    roleName:
      (row.customPermissions !== null && row.customName) ||
      ROLE_LABELS[row.role],
    permissions,
  };
}

/** Every role (built-in first) with the number of memberships using it. */
export async function listRoles(): Promise<RoleSummary[]> {
  const d1 = getD1();
  const { results: rows } = await d1
    .prepare(
      'SELECT id, name, description, base_role, permissions_json, is_system FROM admin_roles ORDER BY name',
    )
    .all<RoleRow>();
  const { results: counts } = await d1
    .prepare(
      `SELECT COALESCE('custom:' || custom_role_id, role) AS key, COUNT(*)::int AS count
       FROM store_memberships GROUP BY 1`,
    )
    .all<{ key: string; count: number }>();
  const members = (key: string) =>
    counts.find((row) => row.key === key)?.count ?? 0;
  const system: RoleSummary[] = (['store_owner', ...BASES] as StoreRole[]).map(
    (role) => {
      const saved = rows.find((row) => row.is_system && row.id === role);
      return {
        key: role,
        id: role,
        name: ROLE_LABELS[role],
        description: SYSTEM_DESCRIPTIONS[role],
        baseRole: role,
        permissions: saved
          ? readPermissions(saved.permissions_json)
          : permissionsFor(role),
        system: true,
        editable: role !== 'store_owner',
        members: members(role),
      };
    },
  );
  const custom = rows
    .filter((row) => !row.is_system)
    .map((row) => ({
      key: `custom:${row.id}`,
      id: row.id,
      name: row.name,
      description: row.description,
      baseRole: row.base_role,
      permissions: readPermissions(row.permissions_json),
      system: false,
      editable: true,
      members: members(`custom:${row.id}`),
    }));
  return [...system, ...custom];
}

function validPermissions(value: unknown) {
  if (!Array.isArray(value)) throw new RoleError('Pilih izin peran.');
  return ALL_PERMISSIONS.filter((permission) =>
    value.some((item) => isPermission(item) && item === permission),
  );
}

function validText(
  value: unknown,
  max: number,
  label: string,
  required = false,
) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new RoleError(`${label} wajib diisi.`);
  if (text.length > max)
    throw new RoleError(`${label} maksimal ${max} karakter.`);
  return text;
}

function validBase(value: unknown): EditableBase {
  if (!BASES.includes(value as EditableBase))
    throw new RoleError('Tingkat dasar harus Admin atau Staf.');
  return value as EditableBase;
}

async function customRole(id: string) {
  const row = await getD1()
    .prepare('SELECT id, name FROM admin_roles WHERE id=? AND is_system=0')
    .bind(id)
    .first<{ id: string; name: string }>();
  if (!row) throw new RoleError('Peran tidak ditemukan.', 404);
  return row;
}

async function assertUniqueName(name: string, exceptId = '') {
  const clash =
    Object.values(ROLE_LABELS).some(
      (label) => label.toLowerCase() === name.toLowerCase(),
    ) ||
    (await getD1()
      .prepare(
        'SELECT 1 FROM admin_roles WHERE is_system=0 AND LOWER(name)=LOWER(?) AND id<>?',
      )
      .bind(name, exceptId)
      .first());
  if (clash) throw new RoleError(`Peran "${name}" sudah ada.`, 409);
}

export async function createRole(input: Record<string, unknown>) {
  const name = validText(input.name, 60, 'Nama peran', true);
  await assertUniqueName(name);
  const now = new Date().toISOString();
  const role = {
    id: crypto.randomUUID(),
    name,
    description: validText(input.description, 200, 'Keterangan'),
    baseRole: validBase(input.baseRole),
    permissions: validPermissions(input.permissions),
  };
  await getD1()
    .prepare(
      'INSERT INTO admin_roles (id,name,description,base_role,permissions_json,is_system,created_at,updated_at) VALUES (?,?,?,?,?,0,?,?)',
    )
    .bind(
      role.id,
      role.name,
      role.description,
      role.baseRole,
      JSON.stringify(role.permissions),
      now,
      now,
    )
    .run();
  return role;
}

/** Update a custom role, or the permissions of the built-in Admin/Staf role. */
export async function updateRole(key: string, input: Record<string, unknown>) {
  const now = new Date().toISOString();
  const permissions = validPermissions(input.permissions);
  if (key === 'store_owner')
    throw new RoleError('Izin Pemilik tidak bisa diubah (selalu semua izin).');
  if (BASES.includes(key as EditableBase)) {
    await getD1()
      .prepare(
        `INSERT INTO admin_roles (id,name,description,base_role,permissions_json,is_system,created_at,updated_at)
         VALUES (?,?,'',?,?,1,?,?)
         ON CONFLICT (id) DO UPDATE SET permissions_json=excluded.permissions_json, updated_at=excluded.updated_at`,
      )
      .bind(
        key,
        ROLE_LABELS[key as EditableBase],
        key,
        JSON.stringify(permissions),
        now,
        now,
      )
      .run();
    return { key, name: ROLE_LABELS[key as EditableBase], permissions };
  }
  const id = key.startsWith('custom:') ? key.slice(7) : key;
  await customRole(id);
  const name = validText(input.name, 60, 'Nama peran', true);
  await assertUniqueName(name, id);
  const baseRole = validBase(input.baseRole);
  const d1 = getD1();
  await d1.batch([
    d1
      .prepare(
        'UPDATE admin_roles SET name=?, description=?, base_role=?, permissions_json=?, updated_at=? WHERE id=? AND is_system=0',
      )
      .bind(
        name,
        validText(input.description, 200, 'Keterangan'),
        baseRole,
        JSON.stringify(permissions),
        now,
        id,
      ),
    // Members keep their place in the hierarchy of the new base role.
    d1
      .prepare(
        'UPDATE store_memberships SET role=?, updated_at=? WHERE custom_role_id=?',
      )
      .bind(baseRole, now, id),
  ]);
  return { key: `custom:${id}`, name, permissions };
}

/** Delete a custom role; its members fall back to the built-in base role. */
export async function deleteRole(key: string) {
  const id = key.startsWith('custom:') ? key.slice(7) : '';
  if (!id) throw new RoleError('Peran bawaan tidak bisa dihapus.');
  const role = await customRole(id);
  await getD1()
    .prepare('DELETE FROM admin_roles WHERE id=? AND is_system=0')
    .bind(id)
    .run();
  return role;
}

/**
 * A role chosen in the members screen: 'store_owner' | 'store_admin' |
 * 'store_staff' | 'custom:<id>'. Returns the base role and custom role id.
 */
export async function parseRoleChoice(value: unknown) {
  if (
    value === 'store_owner' ||
    value === 'store_admin' ||
    value === 'store_staff'
  )
    return {
      role: value as StoreRole,
      customRoleId: null as string | null,
      label: ROLE_LABELS[value],
    };
  if (typeof value === 'string' && value.startsWith('custom:')) {
    const row = await getD1()
      .prepare(
        'SELECT id, name, base_role FROM admin_roles WHERE id=? AND is_system=0',
      )
      .bind(value.slice(7))
      .first<{ id: string; name: string; base_role: EditableBase }>();
    if (row)
      return {
        role: row.base_role as StoreRole,
        customRoleId: row.id,
        label: row.name,
      };
  }
  return null;
}
