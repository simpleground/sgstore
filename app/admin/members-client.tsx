'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  canChangeMember,
  isStoreRole,
  ROLE_LABELS,
  STORE_ROLES,
  type StoreRole,
} from '@/lib/permissions';

type Member = {
  userId: string;
  email: string;
  name: string;
  role: StoreRole;
  createdAt: string;
};

const ROLE_HELP: Record<StoreRole, string> = {
  store_owner: 'Semua akses, termasuk mengatur pemilik dan admin lain.',
  store_admin: 'Mengelola toko dan menambah/mengeluarkan staf.',
  store_staff:
    'Mengelola pesanan dan produk (tanpa hapus permanen, impor, gabung).',
};

async function send(method: string, body: unknown) {
  const response = await fetch('/api/admin/members', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'Perubahan gagal disimpan.');
  return data;
}

async function fetchMembers() {
  const response = await fetch('/api/admin/members', { cache: 'no-store' });
  const data = (await response.json()) as {
    members?: Member[];
    me?: string;
    myRole?: StoreRole | null;
    error?: string;
  };
  if (!response.ok || !data.members) throw new Error(data.error);
  return {
    members: data.members,
    me: data.me ?? '',
    myRole: data.myRole ?? null,
  };
}

export function MembersManager({ canManage }: { canManage: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState('');
  const [myRole, setMyRole] = useState<StoreRole | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StoreRole>('store_staff');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(
    () =>
      fetchMembers()
        .then((data) => {
          setMembers(data.members);
          setMe(data.me);
          setMyRole(data.myRole);
        })
        .catch(() =>
          setMessage(
            'Daftar anggota gagal dimuat. Muat ulang halaman untuk mencoba lagi.',
          ),
        ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Koneksi terputus. Coba lagi.',
      );
    } finally {
      setBusy(false);
    }
  }

  const assignable = STORE_ROLES.filter((option) =>
    canChangeMember(myRole, null, option),
  );

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
        Tim
      </p>
      <h2 className="mt-1 font-serif text-3xl">Anggota toko</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736b]">
        Orang yang boleh masuk ke panel admin toko ini beserta perannya.
      </p>

      {canManage && assignable.length > 0 && (
        <form
          className="mt-5 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1.4fr_1fr_auto_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () => send('POST', { email, name, role }),
              `${email} ditambahkan. Ia masuk ke /admin dengan tombol Google memakai email tersebut.`,
            ).then(() => {
              setEmail('');
              setName('');
            });
          }}
        >
          <label className="text-sm font-semibold">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
              placeholder="nama@contoh.com"
            />
          </label>
          <label className="text-sm font-semibold">
            Nama (opsional)
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Peran
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StoreRole)}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal"
            >
              {assignable.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            className="rounded-xl bg-[#243b2c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Tambah anggota
          </button>
          <p className="text-xs leading-5 text-[#7b847c] sm:col-span-4">
            {ROLE_HELP[role]} Anggota baru masuk dengan akun Google yang memakai
            email ini.
          </p>
        </form>
      )}

      <div className="mt-5 divide-y rounded-2xl border bg-white">
        {members.map((member) => {
          const self = member.userId === me;
          const options = STORE_ROLES.filter(
            (option) =>
              option === member.role ||
              canChangeMember(myRole, member.role, option),
          );
          const editable = canManage && !self && options.length > 1;
          const removable =
            canManage && !self && canChangeMember(myRole, member.role, null);
          return (
            <div
              key={member.userId}
              className="flex flex-wrap items-center gap-3 p-4"
            >
              <div className="min-w-0 flex-1">
                <b className="block truncate">{member.name || member.email}</b>
                <p className="truncate text-xs text-[#7b847c]">
                  {member.email}
                  {self ? ' · Anda' : ''}
                </p>
              </div>
              {editable ? (
                <select
                  aria-label={`Peran ${member.email}`}
                  disabled={busy}
                  value={member.role}
                  onChange={(event) =>
                    void run(
                      () =>
                        send('PATCH', {
                          userId: member.userId,
                          role: event.target.value,
                        }),
                      'Peran anggota diperbarui.',
                    )
                  }
                  className="rounded-xl border bg-white px-3 py-2 text-sm"
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABELS[option]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-lg bg-[#efe7d8] px-3 py-1.5 text-sm">
                  {ROLE_LABELS[member.role]}
                </span>
              )}
              {removable && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Keluarkan ${member.email} dari toko ini?`))
                      void run(
                        () => send('DELETE', { userId: member.userId }),
                        `${member.email} dikeluarkan dari toko.`,
                      );
                  }}
                  className="text-sm font-semibold text-red-700"
                >
                  Keluarkan
                </button>
              )}
            </div>
          );
        })}
        {!members.length && (
          <p className="p-4 text-sm text-[#7b847c]">Belum ada anggota.</p>
        )}
      </div>
      {message && (
        <output className="mt-4 block text-sm font-semibold text-[#566158]">
          {message}
        </output>
      )}
    </section>
  );
}

type Entry = {
  id: number;
  userEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metaJson: string;
  ip: string;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Masuk admin',
  'auth.login_denied': 'Ditolak masuk (bukan anggota)',
  'member.add': 'Menambah anggota',
  'member.role': 'Mengubah peran anggota',
  'member.remove': 'Mengeluarkan anggota',
  'order.status': 'Mengubah status pesanan',
  'product.create': 'Menambah produk',
  'product.update': 'Mengubah produk',
  'product.copy': 'Menyalin produk',
  'product.archive': 'Mengarsipkan produk',
  'product.unarchive': 'Mengaktifkan produk',
  'product.trash': 'Memindahkan produk ke tong sampah',
  'product.restore': 'Memulihkan produk',
  'product.delete': 'Menghapus produk permanen',
  'product.import': 'Impor CSV produk',
  'product.merge': 'Menggabungkan produk',
  'category.rename': 'Mengganti nama kategori',
  'subcategory.rename': 'Mengganti nama subkategori',
  'category.normalize': 'Merapikan kategori',
  'review.create': 'Menambah ulasan',
  'review.update': 'Mengubah ulasan',
  'shipping.courier': 'Mengatur ekspedisi',
  'settings.update': 'Mengubah pengaturan toko',
  'payments.update': 'Mengubah pembayaran & integrasi',
  'appearance.update': 'Mengubah tampilan toko',
  'appearance.image': 'Mengubah gambar toko',
};

const STATUS_LABELS: Record<string, string> = {
  menunggu_pembayaran: 'menunggu pembayaran',
  dibayar: 'dibayar',
  diproses: 'diproses',
  dikirim: 'dikirim',
  selesai: 'selesai',
  dibatalkan: 'dibatalkan',
};

/** Human-readable detail of an audit entry, e.g. "kasir@toko.com · peran: Staf". */
function describe(entry: Entry) {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(entry.metaJson) as Record<string, unknown>;
  } catch {}
  const text = (value: unknown) => {
    if (isStoreRole(value)) return ROLE_LABELS[value];
    if (typeof value === 'string') return STATUS_LABELS[value] ?? value;
    return Array.isArray(value) ? String(value.length) : String(value);
  };
  const parts: string[] = [];
  // Account ids are not meaningful to people; show the email instead.
  if (entry.targetId && entry.targetType !== 'admin')
    parts.push(entry.targetId);
  if (typeof meta.email === 'string') parts.push(meta.email);
  if (typeof meta.name === 'string' && meta.name) parts.push(meta.name);
  if (meta.from !== undefined && meta.to !== undefined)
    parts.push(`${text(meta.from)} → ${text(meta.to)}`);
  if (meta.role) parts.push(`peran: ${text(meta.role)}`);
  if (meta.newAccount) parts.push('akun baru');
  if (meta.method)
    parts.push(`lewat ${meta.method === 'google' ? 'Google' : 'password'}`);
  if (meta.platformAdmin) parts.push('sebagai admin platform');
  if (typeof meta.active === 'boolean')
    parts.push(meta.active ? 'aktif' : 'nonaktif');
  for (const key of [
    'created',
    'updated',
    'changed',
    'mergedVariants',
  ] as const)
    if (typeof meta[key] === 'number')
      parts.push(
        `${key === 'mergedVariants' ? 'variasi' : key === 'created' ? 'baru' : key === 'updated' ? 'diperbarui' : 'berubah'}: ${meta[key]}`,
      );
  if (typeof meta.fields === 'string') parts.push(`diubah: ${meta.fields}`);
  if (typeof meta.rekening === 'string') parts.push(`rekening baru ${meta.rekening}`);
  if (entry.ip) parts.push(`IP ${entry.ip}`);
  return parts.join(' · ');
}

async function fetchEntries(before?: number) {
  const response = await fetch(
    `/api/admin/audit${before ? `?before=${before}` : ''}`,
    {
      cache: 'no-store',
    },
  );
  const data = (await response.json()) as { entries?: Entry[] };
  if (!response.ok || !data.entries) throw new Error('Riwayat gagal dimuat.');
  return data.entries;
}

export function ActivityLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(
    (before?: number) =>
      fetchEntries(before)
        .then((loaded) => {
          setEntries((current) => (before ? [...current, ...loaded] : loaded));
          setMore(loaded.length === 100);
        })
        .catch(() => setMessage('Riwayat aktivitas gagal dimuat.')),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
        Keamanan
      </p>
      <h2 className="mt-1 font-serif text-3xl">Aktivitas admin</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736b]">
        Siapa melakukan apa di toko ini, terbaru di atas.
      </p>
      <div className="mt-5 divide-y rounded-2xl border bg-white">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="grid gap-1 p-4 text-sm sm:grid-cols-[11rem_1fr]"
          >
            <span className="text-xs text-[#7b847c]">
              {new Date(entry.createdAt).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            <div className="min-w-0">
              <b>{ACTION_LABELS[entry.action] || entry.action}</b>
              <span className="text-[#566158]">
                {' '}
                · {entry.userEmail || 'sistem'}
              </span>
              <p className="break-words text-xs text-[#7b847c]">
                {describe(entry)}
              </p>
            </div>
          </div>
        ))}
        {!entries.length && !message && (
          <p className="p-4 text-sm text-[#7b847c]">Belum ada aktivitas.</p>
        )}
      </div>
      {more && (
        <button
          onClick={() => void load(entries[entries.length - 1]?.id)}
          className="mt-4 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
        >
          Muat aktivitas sebelumnya
        </button>
      )}
      {message && (
        <p className="mt-4 text-sm font-semibold text-[#566158]">{message}</p>
      )}
    </section>
  );
}
