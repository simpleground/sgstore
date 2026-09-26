'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Eye, Pencil, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { openStoreAdmin } from './open-admin';

type Status = 'active' | 'suspended' | 'closed';
export type StoreItem = {
  id: string;
  slug: string;
  name: string;
  status: Status;
  createdAt: string;
  products: number;
  orders: number;
  subdomain: string;
  domains: { host: string; primary: boolean }[];
  owners: string[];
};

const STATUS_LABEL: Record<Status, string> = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  closed: 'Ditutup',
};
const STATUS_STYLE: Record<Status, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  suspended: 'bg-amber-50 text-amber-800',
  closed: 'bg-slate-100 text-slate-600',
};
const STATUS_HELP: Record<Status, string> = {
  active: 'Etalase buka, admin toko bisa masuk.',
  suspended:
    'Etalase ditutup untuk pembeli; pesanan lama tetap bisa dicek. Admin toko tetap bisa masuk.',
  closed:
    'Etalase ditutup dan admin toko tidak bisa masuk lagi (hanya admin platform). Data tetap disimpan.',
};
const field = 'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm';
const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

async function api(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    stores?: StoreItem[];
    rootDomain?: string;
  };
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

/** Address of the storefront: primary domain, else the platform subdomain. */
export function storeHost(store: StoreItem) {
  return store.domains.find((domain) => domain.primary)?.host || store.subdomain;
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Website management for the platform super_admin (Admin → Website). */
export function StoresManager({
  onChanged,
}: {
  /** Called after stores change, so other sections can refresh their lists. */
  onChanged?: () => void;
}) {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [rootDomain, setRootDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const [modal, setModal] = useState<
    | { type: 'create' }
    | { type: 'detail'; id: string }
    | { type: 'edit'; id: string }
    | null
  >(null);

  const load = useCallback(
    () =>
      api('/api/platform/stores', 'GET')
        .then((data) => {
          setStores(data.stores ?? []);
          setRootDomain(data.rootDomain ?? '');
        })
        .catch((error: Error) => setMessage(error.message))
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const reload = async () => {
    await load();
    onChanged?.();
  };

  const visible = useMemo(
    () =>
      stores.filter(
        (store) =>
          (!status || store.status === status) &&
          `${store.name} ${store.slug} ${store.owners.join(' ')} ${store.domains.map((domain) => domain.host).join(' ')}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [stores, status, query],
  );
  const selected =
    modal && modal.type !== 'create'
      ? stores.find((store) => store.id === modal.id)
      : undefined;
  const manage = (store: StoreItem) =>
    void openStoreAdmin(store.id).then((error) => error && setMessage(error));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input
            className="h-10 bg-white pl-9"
            placeholder="Cari nama, slug, domain, atau pemilik…"
            aria-label="Cari website"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          aria-label="Filter status website"
          className="h-10 rounded-lg border bg-white px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as '' | Status)}
        >
          <option value="">Semua status</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABEL[key]}
            </option>
          ))}
        </select>
        <Button onClick={() => setModal({ type: 'create' })}>
          <Plus size={16} /> Tambah website
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        {stores.length} website ·{' '}
        {rootDomain
          ? `subdomain otomatis: <slug>.${rootDomain}`
          : 'PLATFORM_ROOT_DOMAIN belum diatur (subdomain otomatis nonaktif)'}
      </p>
      {message && (
        <output className="block text-sm font-semibold text-slate-700">
          {message}
        </output>
      )}

      <div className="overflow-hidden rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="pl-5">Website</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Pemilik</TableHead>
              <TableHead className="text-right">Produk</TableHead>
              <TableHead className="text-right">Pesanan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-5 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((store) => (
              <TableRow key={store.id}>
                <TableCell className="py-3.5 pl-5">
                  <button
                    type="button"
                    className="text-left font-semibold text-blue-700"
                    onClick={() => setModal({ type: 'detail', id: store.id })}
                  >
                    {store.name}
                  </button>
                  <span className="block text-xs text-slate-500">
                    {store.slug}
                  </span>
                </TableCell>
                <TableCell className="text-slate-600">
                  {storeHost(store) || '—'}
                  {store.domains.length > 1 && (
                    <span className="block text-xs text-slate-400">
                      +{store.domains.length - 1} domain lain
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-56 truncate text-slate-600">
                  {store.owners.join(', ') || '—'}
                </TableCell>
                <TableCell className="text-right">{store.products}</TableCell>
                <TableCell className="text-right">{store.orders}</TableCell>
                <TableCell>
                  <StatusBadge status={store.status} />
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Detail ${store.name}`}
                      title="Detail"
                      onClick={() => setModal({ type: 'detail', id: store.id })}
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Ubah ${store.name}`}
                      title="Ubah"
                      onClick={() => setModal({ type: 'edit', id: store.id })}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Masuk ke admin website ini tanpa login ulang"
                      onClick={() => manage(store)}
                    >
                      Kelola
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!visible.length && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-14 text-center text-slate-500"
                >
                  {loading ? 'Memuat website…' : 'Tidak ada website yang sesuai.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {modal?.type === 'create' && (
        <CreateStoreDialog
          rootDomain={rootDomain}
          onClose={() => setModal(null)}
          onCreated={async (text) => {
            setModal(null);
            setMessage(text);
            await reload();
          }}
        />
      )}
      {modal?.type === 'detail' && selected && (
        <StoreDetailDialog
          store={selected}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ type: 'edit', id: selected.id })}
          onManage={() => manage(selected)}
        />
      )}
      {modal?.type === 'edit' && selected && (
        <EditStoreDialog
          store={selected}
          onClose={() => setModal(null)}
          onChanged={reload}
        />
      )}
    </section>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
  wide,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`admin-workspace max-h-[90vh] overflow-y-auto p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CreateStoreDialog({
  rootDomain,
  onClose,
  onCreated,
}: {
  rootDomain: string;
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    ownerEmail: '',
    domain: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      title="Tambah website"
      description="Website baru langsung aktif dengan pemiliknya."
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          api('/api/platform/stores', 'POST', form)
            .then(() =>
              onCreated(
                `Website ${form.name} dibuat. Pemilik masuk ke /admin di domain website dengan akun Google ${form.ownerEmail}.`,
              ),
            )
            .catch((reason: Error) => setError(reason.message))
            .finally(() => setBusy(false));
        }}
      >
        <label className="block text-sm font-semibold">
          Nama website
          <input
            required
            className={field}
            value={form.name}
            onChange={(event) =>
              setForm({
                ...form,
                name: event.target.value,
                slug: slugTouched ? form.slug : slugify(event.target.value),
              })
            }
          />
        </label>
        <label className="block text-sm font-semibold">
          Slug (subdomain)
          <input
            required
            className={field}
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setForm({ ...form, slug: event.target.value.toLowerCase() });
            }}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {rootDomain && form.slug
              ? `Alamat: ${form.slug}.${rootDomain}`
              : 'Huruf kecil, angka, dan tanda hubung.'}
          </span>
        </label>
        <label className="block text-sm font-semibold">
          Email pemilik
          <input
            required
            type="email"
            className={field}
            value={form.ownerEmail}
            onChange={(event) =>
              setForm({ ...form, ownerEmail: event.target.value })
            }
          />
        </label>
        <label className="block text-sm font-semibold">
          Domain sendiri (opsional)
          <input
            className={field}
            placeholder="tokoanda.com"
            value={form.domain}
            onChange={(event) => setForm({ ...form, domain: event.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Buat website'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StoreDetailDialog({
  store,
  onClose,
  onEdit,
  onManage,
}: {
  store: StoreItem;
  onClose: () => void;
  onEdit: () => void;
  onManage: () => void;
}) {
  const host = storeHost(store);
  const rows: [string, React.ReactNode][] = [
    ['Status', <StatusBadge key="status" status={store.status} />],
    ['Slug', store.slug],
    ['Subdomain', store.subdomain || '—'],
    [
      'Domain',
      store.domains.length
        ? store.domains
            .map((domain) => `${domain.host}${domain.primary ? ' (utama)' : ''}`)
            .join(', ')
        : '—',
    ],
    ['Pemilik', store.owners.join(', ') || '—'],
    ['Produk', store.products],
    ['Pesanan', store.orders],
    ['Dibuat', new Date(store.createdAt).toLocaleDateString('id-ID')],
  ];
  return (
    <Modal title={store.name} description={STATUS_HELP[store.status]} onClose={onClose}>
      <dl className="divide-y rounded-lg border text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-3 py-2.5">
            <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
            <dd className="min-w-0 break-words text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {host && (
          <a
            href={`https://${host}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
          >
            Buka etalase <ExternalLink size={14} />
          </a>
        )}
        <Button variant="outline" onClick={onEdit}>
          <Pencil size={15} /> Ubah
        </Button>
        <Button onClick={onManage}>Kelola</Button>
      </div>
    </Modal>
  );
}

function EditStoreDialog({
  store,
  onClose,
  onChanged,
}: {
  store: StoreItem;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(store.name);
  const [status, setStatus] = useState<Status>(store.status);
  const [domain, setDomain] = useState('');
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await onChanged();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Koneksi terputus.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const domains = `/api/platform/stores/${store.id}/domains`;

  return (
    <Modal
      title={`Ubah ${store.name}`}
      description="Nama, status, domain, dan pemilik website."
      onClose={onClose}
      wide
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            status !== store.status &&
            !confirm(`${STATUS_LABEL[status]}: ${STATUS_HELP[status]} Lanjutkan?`)
          )
            return;
          void run(
            () => api(`/api/platform/stores/${store.id}`, 'PATCH', { name, status }),
            'Website diperbarui.',
          );
        }}
      >
        <label className="block text-sm font-semibold">
          Nama website
          <input
            required
            className={field}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Status
          <select
            className={field}
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
          >
            {(Object.keys(STATUS_LABEL) as Status[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500 sm:col-span-2">
          {STATUS_HELP[status]}
        </p>
        <div className="flex justify-end sm:col-span-2">
          <Button
            type="submit"
            disabled={busy || (name === store.name && status === store.status)}
          >
            Simpan
          </Button>
        </div>
      </form>

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-semibold">Domain</p>
        <ul className="space-y-1.5 text-sm">
          {store.subdomain && (
            <li className="text-slate-500">
              {store.subdomain} (subdomain otomatis)
            </li>
          )}
          {store.domains.map((item) => (
            <li key={item.host} className="flex flex-wrap items-center gap-2">
              <span>{item.host}</span>
              {item.primary ? (
                <span className="rounded bg-blue-50 px-1.5 text-xs text-blue-700">
                  utama
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-semibold text-blue-600"
                  onClick={() =>
                    void run(
                      () => api(domains, 'PATCH', { host: item.host }),
                      `${item.host} menjadi domain utama.`,
                    )
                  }
                >
                  jadikan utama
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                className="text-xs font-semibold text-red-700"
                onClick={() => {
                  if (confirm(`Lepas ${item.host} dari ${store.name}?`))
                    void run(
                      () => api(domains, 'DELETE', { host: item.host }),
                      `${item.host} dilepas.`,
                    );
                }}
              >
                lepas
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            aria-label="Domain baru"
            className={`${field} mt-0`}
            placeholder="tokoanda.com"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || !domain}
            onClick={() =>
              void run(
                () => api(domains, 'POST', { host: domain }),
                'Domain ditambahkan. Arahkan DNS domain ke server dan buat sertifikat SSL-nya.',
              ).then((ok) => ok && setDomain(''))
            }
          >
            Tambah
          </Button>
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-semibold">Pemilik</p>
        <p className="text-sm text-slate-600">
          {store.owners.join(', ') || 'Belum ada pemilik.'}
        </p>
        <div className="flex gap-2">
          <input
            aria-label="Email pemilik baru"
            type="email"
            className={`${field} mt-0`}
            placeholder="nama@email.com"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || !owner}
            onClick={() =>
              void run(
                () =>
                  api(`/api/platform/stores/${store.id}/owners`, 'POST', {
                    email: owner,
                  }),
                'Pemilik ditambahkan. Ia masuk dengan akun Google memakai email tersebut.',
              ).then((ok) => ok && setOwner(''))
            }
          >
            Tambah
          </Button>
        </div>
      </div>
      {(message || error) && (
        <p
          role={error ? 'alert' : undefined}
          className={`text-sm font-semibold ${error ? 'text-red-700' : 'text-slate-700'}`}
        >
          {error || message}
        </p>
      )}
    </Modal>
  );
}
