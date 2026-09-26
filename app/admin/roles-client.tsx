'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ALL_PERMISSIONS,
  PERMISSION_INFO,
  ROLE_LABELS,
  type Permission,
  type StoreRole,
} from '@/lib/permissions';

type Role = {
  key: string;
  id: string;
  name: string;
  description: string;
  baseRole: StoreRole;
  permissions: Permission[];
  system: boolean;
  editable: boolean;
  members: number;
};

const GROUPS = [...new Set(ALL_PERMISSIONS.map((p) => PERMISSION_INFO[p].group))];
const field = 'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm';

async function api(method: string, body?: unknown) {
  const response = await fetch('/api/platform/roles', {
    method,
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    roles?: Role[];
  };
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

/**
 * Roles & permissions of store members (platform super_admin). Built-in Admin
 * and Staf can be adjusted; custom roles are available in every store's
 * Anggota screen. The owner role always has every permission.
 */
export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState<
    { type: 'create' } | { type: 'detail' | 'edit'; key: string } | null
  >(null);
  const load = useCallback(
    () =>
      api('GET')
        .then((data) => setRoles(data.roles ?? []))
        .catch((error: Error) => setMessage(error.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const selected =
    modal && modal.type !== 'create'
      ? roles.find((role) => role.key === modal.key)
      : undefined;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500">
          Peran menentukan menu dan tindakan yang boleh dipakai anggota toko.
          Peran kustom bisa dipilih pemilik toko di menu Anggota.
        </p>
        <Button onClick={() => setModal({ type: 'create' })}>
          <Plus size={16} /> Tambah peran
        </Button>
      </div>
      {message && (
        <output className="block text-sm font-semibold text-slate-700">
          {message}
        </output>
      )}
      <div className="overflow-hidden rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="pl-5">Peran</TableHead>
              <TableHead>Tingkat</TableHead>
              <TableHead className="text-right">Izin</TableHead>
              <TableHead className="text-right">Anggota</TableHead>
              <TableHead className="pr-5 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.key}>
                <TableCell className="py-3.5 pl-5">
                  <span className="font-semibold text-slate-900">
                    {role.name}
                  </span>
                  {role.system && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      bawaan
                    </span>
                  )}
                  {role.description && (
                    <span className="block max-w-md truncate text-xs text-slate-500">
                      {role.description}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-slate-600">
                  {ROLE_LABELS[role.baseRole]}
                </TableCell>
                <TableCell className="text-right">
                  {role.permissions.length}/{ALL_PERMISSIONS.length}
                </TableCell>
                <TableCell className="text-right">{role.members}</TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Detail ${role.name}`}
                      title="Detail"
                      onClick={() => setModal({ type: 'detail', key: role.key })}
                    >
                      <Eye size={16} />
                    </Button>
                    {role.editable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ubah ${role.name}`}
                        title="Ubah"
                        onClick={() => setModal({ type: 'edit', key: role.key })}
                      >
                        <Pencil size={16} />
                      </Button>
                    )}
                    {!role.system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus ${role.name}`}
                        title="Hapus"
                        onClick={() => {
                          if (
                            confirm(
                              `Hapus peran ${role.name}? ${role.members} anggota kembali ke peran ${ROLE_LABELS[role.baseRole]}.`,
                            )
                          )
                            api('DELETE', { key: role.key })
                              .then(() => {
                                setMessage(`Peran ${role.name} dihapus.`);
                                return load();
                              })
                              .catch((error: Error) => setMessage(error.message));
                        }}
                      >
                        <Trash2 size={16} className="text-red-700" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {modal?.type === 'create' && (
        <RoleDialog
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={async (text) => {
            setModal(null);
            setMessage(text);
            await load();
          }}
        />
      )}
      {modal?.type === 'edit' && selected && (
        <RoleDialog
          role={selected}
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={async (text) => {
            setModal(null);
            setMessage(text);
            await load();
          }}
        />
      )}
      {modal?.type === 'detail' && selected && (
        <Dialog open onOpenChange={(open) => !open && setModal(null)}>
          <DialogContent className="admin-workspace max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg">{selected.name}</DialogTitle>
              <DialogDescription>
                {selected.description ||
                  `Tingkat ${ROLE_LABELS[selected.baseRole]}`}{' '}
                · {selected.members} anggota
              </DialogDescription>
            </DialogHeader>
            <PermissionList permissions={selected.permissions} />
            {selected.editable && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setModal({ type: 'edit', key: selected.key })}
                >
                  <Pencil size={15} /> Ubah
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

function PermissionList({ permissions }: { permissions: Permission[] }) {
  return (
    <div className="space-y-3">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {group}
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {ALL_PERMISSIONS.filter((p) => PERMISSION_INFO[p].group === group).map(
              (permission) => {
                const allowed = permissions.includes(permission);
                return (
                  <li
                    key={permission}
                    className={allowed ? 'text-slate-900' : 'text-slate-400 line-through'}
                  >
                    {allowed ? '✓' : '✕'} {PERMISSION_INFO[permission].label}
                  </li>
                );
              },
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RoleDialog({
  role,
  roles,
  onClose,
  onSaved,
}: {
  role?: Role;
  roles: Role[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const system = Boolean(role?.system);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [baseRole, setBaseRole] = useState<StoreRole>(
    role?.baseRole ?? 'store_staff',
  );
  const [permissions, setPermissions] = useState<Permission[]>(
    role?.permissions ?? roles.find((r) => r.key === 'store_staff')?.permissions ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (permission: Permission) =>
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="admin-workspace max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {role ? `Ubah peran ${role.name}` : 'Tambah peran'}
          </DialogTitle>
          <DialogDescription>
            {system
              ? 'Peran bawaan: hanya izinnya yang bisa diubah. Berlaku untuk semua toko.'
              : 'Peran kustom bisa dipilih di menu Anggota setiap toko.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            const body = { key: role?.key, name, description, baseRole, permissions };
            api(role ? 'PATCH' : 'POST', body)
              .then(() =>
                onSaved(role ? `Peran ${name || role.name} diperbarui.` : `Peran ${name} dibuat.`),
              )
              .catch((reason: Error) => setError(reason.message))
              .finally(() => setBusy(false));
          }}
        >
          {!system && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Nama peran
                <input
                  required
                  className={field}
                  value={name}
                  placeholder="mis. Admin Keuangan"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                Tingkat
                <select
                  className={field}
                  value={baseRole}
                  onChange={(event) => setBaseRole(event.target.value as StoreRole)}
                >
                  <option value="store_staff">Staf</option>
                  <option value="store_admin">Admin</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Menentukan siapa boleh mengubah anggota dengan peran ini.
                </span>
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Keterangan (opsional)
                <input
                  className={field}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Izin</p>
              <div className="flex gap-3 text-xs font-semibold text-blue-700">
                {roles
                  .filter((item) => item.system && item.key !== role?.key)
                  .map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPermissions(item.permissions)}
                    >
                      Salin dari {item.name}
                    </button>
                  ))}
              </div>
            </div>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {GROUPS.map((group) => (
                <fieldset key={group} className="rounded-lg border p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {group}
                  </legend>
                  {ALL_PERMISSIONS.filter((p) => PERMISSION_INFO[p].group === group).map(
                    (permission) => (
                      <label
                        key={permission}
                        className="flex items-center gap-2 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(permission)}
                          onChange={() => toggle(permission)}
                        />
                        {PERMISSION_INFO[permission].label}
                      </label>
                    ),
                  )}
                </fieldset>
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
