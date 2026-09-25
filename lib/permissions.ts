/**
 * Peran & izin admin toko. Dipakai di server (API) dan di UI admin (untuk
 * menyembunyikan menu); yang menentukan tetap server.
 *
 *   store_owner  semua izin, termasuk mengelola owner/admin lain dan
 *                pengaturan pembayaran (rekening, kunci Midtrans/Biteship)
 *   store_admin  semua pengelolaan toko; anggota: hanya menambah/mengubah/
 *                menghapus staff
 *   store_staff  pesanan dan produk (tanpa hapus permanen, impor CSV,
 *                gabung produk, kategori), tanpa ulasan/pengiriman/anggota/log
 *
 * Admin platform (super_admin) punya semua izin di setiap toko.
 */
export type StoreRole = 'store_owner' | 'store_admin' | 'store_staff';

export const STORE_ROLES: StoreRole[] = [
  'store_owner',
  'store_admin',
  'store_staff',
];

export const ROLE_LABELS: Record<StoreRole, string> = {
  store_owner: 'Pemilik',
  store_admin: 'Admin',
  store_staff: 'Staf',
};

const ALL: StoreRole[] = ['store_owner', 'store_admin', 'store_staff'];
const MANAGERS: StoreRole[] = ['store_owner', 'store_admin'];

const RULES = {
  'orders.view': ALL,
  'orders.update': ALL,
  'products.view': ALL,
  /** Tambah, ubah, salin, arsip, pindah ke/pulihkan dari tong sampah. */
  'products.edit': ALL,
  'products.delete': MANAGERS,
  'products.import': MANAGERS,
  'products.merge': MANAGERS,
  'categories.manage': MANAGERS,
  'reviews.manage': MANAGERS,
  'shipping.manage': MANAGERS,
  'members.view': MANAGERS,
  'members.manage': MANAGERS,
  'audit.view': MANAGERS,
  /** Profil toko, kontak, catatan checkout, awalan pesanan, kode pos gudang. */
  'settings.manage': MANAGERS,
  /** Rekening transfer manual dan kunci Midtrans/Biteship: hanya pemilik. */
  'payments.manage': ['store_owner'],
} satisfies Record<string, StoreRole[]>;

export type Permission = keyof typeof RULES;

export const isStoreRole = (value: unknown): value is StoreRole =>
  typeof value === 'string' && (STORE_ROLES as string[]).includes(value);

/** `role` null = admin platform yang bukan anggota toko (semua izin). */
export function roleCan(role: StoreRole | null, permission: Permission) {
  return role === null || (RULES[permission] as StoreRole[]).includes(role);
}

export function permissionsFor(role: StoreRole | null) {
  return (Object.keys(RULES) as Permission[]).filter((permission) =>
    roleCan(role, permission),
  );
}

const RANK: Record<StoreRole, number> = {
  store_owner: 3,
  store_admin: 2,
  store_staff: 1,
};

/**
 * Bolehkah `actor` mengubah keanggotaan seseorang dari `current` ke `next`?
 * current null = anggota baru; next null = dikeluarkan dari toko.
 * actor null = admin platform. Owner boleh semuanya; peran lain hanya boleh
 * mengelola anggota di bawah peringkatnya dan memberi peran di bawah peringkatnya.
 */
export function canChangeMember(
  actor: StoreRole | null,
  current: StoreRole | null,
  next: StoreRole | null,
) {
  if (actor === null || actor === 'store_owner') return true;
  if (!roleCan(actor, 'members.manage')) return false;
  const rank = (role: StoreRole | null) => (role ? RANK[role] : 0);
  return rank(actor) > rank(current) && rank(actor) > rank(next);
}
