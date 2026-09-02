'use client';
import { useEffect, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  MessageSquareText,
  PackageCheck,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';

type Order = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  items_json: string;
  total: number;
  status: string;
  created_at: string;
};
const labels: Record<string, string> = {
  menunggu_pembayaran: 'Menunggu transfer',
  dibayar: 'Sudah dibayar',
  diproses: 'Diproses',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};
const icons: Record<string, typeof Clock3> = {
  menunggu_pembayaran: Clock3,
  dibayar: CheckCircle2,
  diproses: PackageCheck,
  dikirim: Truck,
  selesai: CheckCircle2,
  dibatalkan: XCircle,
};
const rupiah = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v);

export function AdminSetup() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError('');
    const r = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (r.ok) location.reload();
    else setError((await r.json()).error ?? 'Gagal mengaktifkan.');
    setBusy(false);
  }
  return (
    <div className="mx-auto mt-20 max-w-md rounded-3xl border bg-white p-8 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a34f2c]">
        Aktivasi pertama
      </p>
      <h1 className="mt-3 font-serif text-3xl">Hubungkan akun admin</h1>
      <p className="mt-3 text-sm leading-6 text-[#68736b]">
        Masukkan kode aktivasi satu kali. Setelah berhasil, hanya akun ChatGPT
        ini yang dapat membuka panel admin.
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        type="password"
        placeholder="Kode aktivasi"
        className="mt-6 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#243b2c]"
      />
      <button
        onClick={submit}
        disabled={busy || !code}
        className="mt-3 w-full rounded-full bg-[#243b2c] py-3 font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Mengaktifkan…' : 'Aktifkan admin'}
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

type Variant = {
  sku?: string;
  color: string;
  size: string;
  normalPrice?: number;
  discountPercent?: number;
  price: number;
  stock: number;
};
type Product = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  tone: string;
  price: number;
  stock: number;
  active: number;
  image: string;
  images: string[];
  description: string;
  variants: Variant[];
};
function VariantEditor({ initial = [] }: { initial?: Variant[] }) {
  const [rows, setRows] = useState<Variant[]>(
    initial.length
      ? initial.map((row) => ({
          ...row,
          discountPercent:
            (row.normalPrice ?? row.price) > 0
              ? Math.round(
                  (1 - row.price / (row.normalPrice ?? row.price)) * 100,
                )
              : 0,
        }))
      : [
          {
            sku: '',
            color: '',
            size: '',
            normalPrice: 0,
            discountPercent: 0,
            price: 0,
            stock: 0,
          },
        ],
  );
  function change(index: number, field: keyof Variant, value: string) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = {
          ...row,
          [field]:
            field === 'sku' || field === 'color' || field === 'size'
              ? value
              : Number(value),
        };
        if (field === 'normalPrice' || field === 'discountPercent') {
          const normalPrice = Number(next.normalPrice) || 0;
          const discount = Math.min(
            100,
            Math.max(0, Number(next.discountPercent) || 0),
          );
          next.discountPercent = discount;
          next.price = Math.round(normalPrice * (1 - discount / 100));
        }
        return next;
      }),
    );
  }
  return (
    <div className="rounded-2xl border bg-white p-4 sm:col-span-2">
      <input
        type="hidden"
        name="variants"
        value={rows
          .map(
            (v) =>
              `${v.sku ?? ''} | ${v.color} | ${v.size} | ${v.normalPrice || v.price} | ${v.price} | ${v.stock}`,
          )
          .join('\n')}
      />
      <div className="flex items-center justify-between gap-3">
        <div>
          <b className="text-sm">Warna, ukuran, diskon & stok</b>
          <p className="mt-1 text-xs text-[#68736b]">
            Satu baris untuk setiap pilihan yang dijual.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((r) => [
              ...r,
              {
                sku: '',
                color: '',
                size: '',
                normalPrice: 0,
                discountPercent: 0,
                price: 0,
                stock: 0,
              },
            ])
          }
          className="shrink-0 rounded-full bg-[#e5efe8] px-3 py-2 text-xs font-bold text-[#24593d]"
        >
          + Tambah varian
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-2 rounded-xl bg-[#f7f4ec] p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]"
          >
            <label className="text-[11px] font-semibold text-[#68736b]">
              SKU
              <input
                value={row.sku ?? ''}
                onChange={(e) => change(index, 'sku', e.target.value)}
                placeholder="TBL-HITAM-M"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1f2b22]"
              />
            </label>
            <label className="text-[11px] font-semibold text-[#68736b]">
              Warna
              <input
                required
                value={row.color}
                onChange={(e) => change(index, 'color', e.target.value)}
                placeholder="Hitam"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1f2b22]"
              />
            </label>
            <label className="text-[11px] font-semibold text-[#68736b]">
              Ukuran
              <input
                required
                value={row.size}
                onChange={(e) => change(index, 'size', e.target.value)}
                placeholder="M / All Size"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1f2b22]"
              />
            </label>
            <label className="text-[11px] font-semibold text-[#68736b]">
              Harga normal
              <input
                required
                min="1"
                type="number"
                value={row.normalPrice || ''}
                onChange={(e) => change(index, 'normalPrice', e.target.value)}
                placeholder="65000"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1f2b22]"
              />
            </label>
            <label className="text-[11px] font-semibold text-[#68736b]">
              Diskon (%)
              <input
                required
                min="0"
                max="99"
                type="number"
                value={row.discountPercent ?? 0}
                onChange={(e) =>
                  change(index, 'discountPercent', e.target.value)
                }
                placeholder="16"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1f2b22]"
              />
            </label>
            <label className="text-[11px] font-semibold text-[#68736b]">
              Harga jual otomatis
              <input
                readOnly
                value={row.price || ''}
                placeholder="54600"
                className="mt-1 w-full rounded-lg border bg-[#edf1ec] px-3 py-2 text-sm font-bold text-[#24593d]"
              />
            </label>
            <label className="text-[11px] font-semibold text-[#68736b]">
              Stok
              <input
                required
                min="0"
                type="number"
                value={row.stock}
                onChange={(e) => change(index, 'stock', e.target.value)}
                placeholder="10"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1f2b22]"
              />
            </label>
            <button
              type="button"
              disabled={rows.length === 1}
              onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
              className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-30"
            >
              Hapus
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
function BulkImport({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  function cells(line: string, delimiter: string) {
    const out: string[] = [],
      re = new RegExp(
        `(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`,
        'g',
      );
    let m;
    while ((m = re.exec(line)))
      out.push((m[1] ?? m[2] ?? '').replace(/""/g, '"').trim());
    return out;
  }
  async function upload(file: File) {
    setBusy(true);
    setMessage('');
    try {
      const text = await file.text(),
        lines = text
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/)
          .filter(Boolean),
        delimiter = lines[0].includes(';') ? ';' : ',',
        headers = cells(lines[0], delimiter).map((x) => x.toLowerCase()),
        required = [
          'name',
          'category',
          'subcategory',
          'description',
          'color',
          'sku',
          'size',
          'normal_price',
          'discount_percent',
          'stock',
        ];
      if (!required.every((h) => headers.includes(h)))
        throw new Error('Kolom CSV tidak sesuai template.');
      const rows = lines.slice(1).map((line) => {
        const values = cells(line, delimiter);
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
      });
      const r = await fetch('/api/admin/products/bulk', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rows }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Impor gagal.');
      setMessage(
        `${d.count} produk diproses: ${d.updated ?? 0} diperbarui, ${d.created ?? d.count} ditambahkan.`,
      );
      onDone();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Impor gagal.');
    }
    setBusy(false);
  }
  function template() {
    const csv =
      'product_id;active;name;category;subcategory;description;sku;color;size;normal_price;discount_percent;stock;image_url\n;1;Kaos Daily Basic;Daily Basic;Kaos;Kaos nyaman sehari-hari;KAOS-HITAM-M;Hitam;M;65000;16;20;\n;1;Kaos Daily Basic;Daily Basic;Kaos;Kaos nyaman sehari-hari;KAOS-HITAM-L;Hitam;L;67000;15;15;';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'template-produk-simple-ground.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function exportProducts() {
    setBusy(true);
    setMessage('Menyiapkan data produk…');
    try {
      const response = await fetch('/api/admin/products/bulk');
      if (!response.ok) throw new Error('Export produk gagal.');
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'produk-simple-ground.csv';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage('Data produk berhasil diekspor dan siap diedit.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export produk gagal.');
    }
    setBusy(false);
  }
  return (
    <div className="mt-5 rounded-2xl border border-dashed bg-[#f8faf7] p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <b className="text-sm">Edit & upload produk massal</b>
          <p className="mt-1 text-xs text-[#68736b]">
            Export katalog, edit di Excel atau Google Sheets, lalu upload kembali.
            Baris dengan product_id diperbarui; baris tanpa ID menjadi produk baru.
            Foto produk lama tetap dipertahankan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportProducts}
            disabled={busy}
            className="rounded-full border border-[#276344] bg-white px-4 py-2 text-xs font-bold text-[#24593d] disabled:opacity-50"
          >
            Export produk
          </button>
          <button
            onClick={template}
            className="rounded-full border bg-white px-4 py-2 text-xs font-bold"
          >
            Unduh template CSV
          </button>
          <label className="cursor-pointer rounded-full bg-[#243b2c] px-4 py-2 text-xs font-bold text-white">
            {busy ? 'Mengimpor…' : 'Pilih CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>
      {message && <p className="mt-3 text-xs font-semibold">{message}</p>}
    </div>
  );
}
function CategoryManager({
  items,
  onDone,
}: {
  items: Product[];
  onDone: () => void;
}) {
  const categories = Array.from(
    new Set(items.map((item) => item.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'id'));
  const [type, setType] = useState<'category' | 'subcategory'>('category');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const subcategories = Array.from(
    new Set(
      items
        .filter((item) => item.category === category)
        .map((item) => item.subcategory)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'id'));
  async function rename(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/categories', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, category, from, to }),
    });
    const data = (await response.json()) as { error?: string; changed?: number };
    if (!response.ok) setMessage(data.error ?? 'Perubahan kategori gagal.');
    else {
      setMessage(`${data.changed ?? 0} produk berhasil diperbarui.`);
      setFrom('');
      setTo('');
      await onDone();
    }
    setBusy(false);
  }
  return (
    <div className="mt-5 rounded-2xl border bg-[#f7f4ec] p-4">
      <div>
        <b className="text-sm">Kelola kategori</b>
        <p className="mt-1 text-xs text-[#68736b]">
          Ganti nama atau gabungkan kategori. Semua produk terkait akan ikut diperbarui.
        </p>
      </div>
      <form onSubmit={rename} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="text-xs font-bold text-[#566158]">
          JENIS
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as 'category' | 'subcategory');
              setFrom('');
            }}
            className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
          >
            <option value="category">Kategori utama</option>
            <option value="subcategory">Subkategori</option>
          </select>
        </label>
        {type === 'subcategory' && (
          <label className="text-xs font-bold text-[#566158]">
            KATEGORI UTAMA
            <select
              required
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setFrom('');
              }}
              className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Pilih kategori</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs font-bold text-[#566158]">
          NAMA LAMA
          <select
            required
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Pilih nama</option>
            {(type === 'category' ? categories : subcategories).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#566158]">
          NAMA BARU
          <input
            required
            maxLength={100}
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="Nama kategori baru"
            className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
          />
        </label>
        <button
          disabled={busy}
          className="min-h-10 rounded-xl bg-[#243b2c] px-4 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Simpan perubahan'}
        </button>
      </form>
      {message && <p className="mt-3 text-xs font-semibold">{message}</p>}
    </div>
  );
}
function ProductManager() {
  const [items, setItems] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [productTab, setProductTab] = useState<'active' | 'archived'>('active');
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [mergeTarget, setMergeTarget] = useState('');
  const [merging, setMerging] = useState(false);
  async function load() {
    const r = await fetch('/api/admin/products');
    if (r.ok) setItems((await r.json()).products);
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    if (editing) {
      fd.set('id', editing.id);
      fd.set('active', String(editing.active !== 0));
    }
    const r = await fetch('/api/admin/products', {
      method: editing ? 'PATCH' : 'POST',
      body: fd,
    });
    if (r.ok) {
      setOpen(false);
      setEditing(null);
      await load();
    } else setError((await r.json()).error ?? 'Gagal menyimpan.');
    setBusy(false);
  }
  async function remove(id: string) {
    if (!confirm('Hapus produk ini dari katalog?')) return;
    await fetch('/api/admin/products', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await load();
  }
  async function copy(id: string) {
    const fd = new FormData();
    fd.set('copyId', id);
    await fetch('/api/admin/products', { method: 'POST', body: fd });
    await load();
  }
  async function setArchived(product: Product) {
    const archive = product.active !== 0;
    if (
      archive &&
      !confirm('Arsipkan produk ini? Produk tidak akan tampil di toko.')
    )
      return;
    const r = await fetch('/api/admin/products', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: product.id, active: archive ? 0 : 1 }),
    });
    if (!r.ok) {
      setError((await r.json()).error ?? 'Gagal mengubah arsip.');
      return;
    }
    await load();
  }
  async function mergeProducts() {
    const sourceIds = mergeIds.filter((id) => id !== mergeTarget);
    if (!mergeTarget || !sourceIds.length) return;
    const target = items.find((item) => item.id === mergeTarget);
    const selected = [target, ...sourceIds.map((id) => items.find((item) => item.id === id))].filter(Boolean) as Product[];
    const skuCounts = new Map<string, number>();
    for (const product of selected) for (const variant of product.variants) {
      const sku = variant.sku?.trim().toLowerCase();
      if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    }
    const duplicateSkus = Array.from(skuCounts.entries()).filter(([, count]) => count > 1).map(([sku]) => sku.toUpperCase());
    const skuNotice = duplicateSkus.length
      ? `\n\nSKU ganda akan diubah otomatis agar unik:\n${duplicateSkus.slice(0, 8).map((sku) => `• ${sku}`).join('\n')}${duplicateSkus.length > 8 ? `\n• dan ${duplicateSkus.length - 8} SKU lainnya` : ''}\n\nSKU pertama pada produk induk tetap dipertahankan.`
      : '\n\nJika ditemukan SKU atau kombinasi variasi ganda, SKU berikutnya akan dibuat unik secara otomatis.';
    if (!confirm(`Gabungkan ${sourceIds.length} produk ke "${target?.name}"? Produk sumber akan diarsipkan.${skuNotice}`)) return;
    setMerging(true);
    setError('');
    const response = await fetch('/api/admin/products/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetId: mergeTarget, sourceIds }),
    });
    const result = await response.json();
    if (response.ok) {
      const changedSkuText = result.skuChanges?.length ? ` ${result.skuChanges.length} SKU diubah otomatis.` : '';
      alert(`Berhasil: ${result.mergedVariants} variasi digabung dan ${result.archivedProducts} produk sumber diarsipkan.${changedSkuText}`);
      setMergeIds([]);
      setMergeTarget('');
      await load();
    } else setError(result.error || 'Gagal menggabungkan produk.');
    setMerging(false);
  }
  const activeCount = items.filter((item) => item.active !== 0).length;
  const archivedCount = items.length - activeCount;
  const categoryOptions = Array.from(
    new Set([
      'Chef & Kitchen Wear',
      'Professional Workwear',
      'Daily Basic',
      ...items.map((item) => item.category).filter(Boolean),
    ]),
  ).sort((a, b) => a.localeCompare(b, 'id'));
  const subcategoryOptions = Array.from(
    new Set(items.map((item) => item.subcategory).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'id'));
  const visibleItems = items.filter((item) =>
    productTab === 'active' ? item.active !== 0 : item.active === 0,
  );
  return (
    <section className="rounded-3xl border bg-white p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
            Katalog
          </p>
          <h2 className="mt-1 font-serif text-2xl">Produk & harga</h2>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="flex items-center gap-2 rounded-full bg-[#243b2c] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={16} /> Tambah produk
        </button>
      </div>
      <BulkImport onDone={load} />
      <CategoryManager items={items} onDone={load} />
      {mergeIds.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#d7c9b7] bg-[#fffaf2] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold">
              Produk induk ({mergeIds.length} produk dipilih)
              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">
                <option value="">Pilih produk yang dipertahankan</option>
                {items.filter((item) => mergeIds.includes(item.id)).map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.variants.length} variasi</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={merging || !mergeTarget || mergeIds.length < 2} onClick={mergeProducts} className="rounded-xl bg-[#a34f2c] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
              {merging ? 'Menggabungkan…' : `Gabungkan ${Math.max(0, mergeIds.length - 1)} produk`}
            </button>
            <button type="button" onClick={() => { setMergeIds([]); setMergeTarget(''); }} className="rounded-xl border bg-white px-4 py-3 text-sm">Batal</button>
          </div>
          <p className="mt-2 text-xs text-[#68736b]">Semua variasi, foto, ulasan, dan keranjang pelanggan dipindahkan. Produk sumber kemudian diarsipkan.</p>
        </div>
      )}
      {open && (
        <form
          key={editing?.id ?? 'new-product'}
          onSubmit={save}
          className="mt-6 grid gap-3 rounded-2xl bg-[#f7f4ec] p-4 sm:grid-cols-2"
        >
          <input
            name="name"
            required
            defaultValue={editing?.name}
            placeholder="Nama produk"
            className="rounded-xl border bg-white px-4 py-3"
          />
          <textarea
            name="description"
            required
            defaultValue={editing?.description}
            placeholder="Deskripsi produk, bahan, potongan, dan kegunaan"
            className="min-h-24 rounded-xl border bg-white px-4 py-3"
          />
          <input
            name="category"
            required
            defaultValue={editing?.category}
            list="main-categories"
            placeholder="Kategori utama"
            className="rounded-xl border bg-white px-4 py-3"
          />
          <datalist id="main-categories">
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <input
            name="subcategory"
            required
            defaultValue={editing?.subcategory}
            list="subcategories"
            placeholder="Subkategori"
            className="rounded-xl border bg-white px-4 py-3"
          />
          <datalist id="subcategories">
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory} value={subcategory} />
            ))}
          </datalist>
          <VariantEditor initial={editing?.variants} />
          <label className="rounded-xl border bg-white px-4 py-3 text-sm sm:col-span-2">
            <span className="mb-2 block font-semibold">
              Foto produk (maksimal 7)
            </span>
            <span className="mb-3 block text-xs text-[#68736b]">
              Pilih beberapa foto sekaligus. Foto pertama menjadi foto utama.
            </span>
            <input
              name="images"
              type="file"
              required={!editing}
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="max-w-full text-xs"
            />
            {editing && (
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input type="checkbox" name="replaceImages" value="true" />{' '}
                Ganti semua foto lama dengan pilihan baru
              </label>
            )}
          </label>
          {editing?.images?.length ? (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {editing.images.map((src, index) => (
                <div key={src} className="relative">
                  <img
                    src={src}
                    alt={`Foto ${index + 1}`}
                    className="h-20 w-16 rounded-lg object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
                      Utama
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {error && (
            <p className="text-sm text-red-700 sm:col-span-2">{error}</p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button
              disabled={busy}
              className="rounded-full bg-[#c0693c] px-5 py-2.5 text-sm font-semibold text-white"
            >
              {busy ? 'Menyimpan…' : 'Simpan produk'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
              className="rounded-full border px-5 py-2.5 text-sm"
            >
              Batal
            </button>
          </div>
        </form>
      )}
      <div className="mt-6 flex gap-1 rounded-xl bg-[#f1f1eb] p-1 sm:w-fit">
        {(
          [
            ['active', 'Produk Aktif', activeCount],
            ['archived', 'Diarsipkan', archivedCount],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setProductTab(value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${productTab === value ? 'bg-white text-[#243b2c] shadow-sm' : 'text-[#68736b] hover:text-[#243b2c]'}`}
          >
            {label}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${productTab === value ? 'bg-[#e5efe8] text-[#24593d]' : 'bg-[#dedfd9]'}`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>
      {visibleItems.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed px-5 py-10 text-center text-sm text-[#68736b]">
          {productTab === 'active'
            ? 'Belum ada produk aktif.'
            : 'Belum ada produk yang diarsipkan.'}
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((p) => (
          <article
            key={p.id}
            className={`flex gap-3 rounded-2xl border p-3 ${p.active === 0 ? 'border-dashed bg-[#f1f1ed] opacity-75' : ''}`}
          >
            {productTab === 'active' && (
              <input
                type="checkbox"
                aria-label={`Pilih ${p.name} untuk digabung`}
                checked={mergeIds.includes(p.id)}
                onChange={(e) => {
                  setMergeIds((current) => e.target.checked ? [...current, p.id] : current.filter((id) => id !== p.id));
                  if (!e.target.checked && mergeTarget === p.id) setMergeTarget('');
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-[#a34f2c]"
              />
            )}
            <img
              src={p.images?.[0] ?? p.image ?? '/placeholder-product.svg'}
              alt=""
              className="h-24 w-20 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <b className="block min-w-0 truncate text-sm">{p.name}</b>
                {p.active === 0 && (
                  <span className="shrink-0 rounded-full bg-[#dfe3dd] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#566158]">
                    Diarsipkan
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#68736b]">
                {p.category} › {p.subcategory} · stok {p.stock} ·{' '}
                {p.images?.length || 1} foto
              </p>
              <p className="mt-1 text-sm font-bold">{rupiah(p.price)}</p>
              <div className="mt-2 flex gap-3">
                <button
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => copy(p.id)}
                  className="text-xs font-semibold"
                >
                  Salin
                </button>
                <button
                  onClick={() => setArchived(p)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#8a542f]"
                >
                  {p.active === 0 ? (
                    <>
                      <RotateCcw size={13} /> Pulihkan
                    </>
                  ) : (
                    <>
                      <Archive size={13} /> Arsipkan
                    </>
                  )}
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-red-700"
                >
                  <Trash2 size={13} /> Hapus
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewManager() {
  const [data, setData] = useState<any>({
    reviews: [],
    products: [],
    buyers: [],
  });
  const [form, setForm] = useState({
    productId: '',
    orderNumber: '',
    displayName: '',
    rating: 5,
    body: '',
  });
  async function load() {
    const r = await fetch('/api/admin/reviews');
    if (r.ok) setData(await r.json());
  }
  useEffect(() => {
    load();
  }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      setForm({
        productId: '',
        orderNumber: '',
        displayName: '',
        rating: 5,
        body: '',
      });
      await load();
    }
  }
  async function edit(review: any) {
    const displayName = prompt('Nama pelanggan', review.display_name);
    if (!displayName) return;
    const rating = Number(prompt('Rating 1-5', String(review.rating)));
    const body = prompt('Isi ulasan', review.body);
    if (!body) return;
    await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: review.id,
        displayName,
        rating,
        body,
        active: Boolean(review.active),
      }),
    });
    await load();
  }
  async function toggle(review: any) {
    await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: review.id,
        displayName: review.display_name,
        rating: review.rating,
        body: review.body,
        active: !review.active,
      }),
    });
    await load();
  }
  return (
    <section className="rounded-3xl border bg-white p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
        Kepercayaan pelanggan
      </p>
      <h2 className="mt-1 font-serif text-2xl">Rating & ulasan</h2>
      <form
        onSubmit={add}
        className="mt-5 grid gap-3 rounded-2xl bg-[#f7f4ec] p-4 sm:grid-cols-2"
      >
        <select
          required
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          className="rounded-xl border bg-white px-4 py-3"
        >
          <option value="">Pilih produk</option>
          {data.products.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          required
          value={form.orderNumber}
          onChange={(e) => {
            const b = data.buyers.find(
              (x: any) => x.order_number === e.target.value,
            );
            setForm({
              ...form,
              orderNumber: e.target.value,
              displayName: b?.customer_name ?? '',
            });
          }}
          className="rounded-xl border bg-white px-4 py-3"
        >
          <option value="">Pilih pelanggan yang pernah membeli</option>
          {data.buyers.map((b: any) => (
            <option key={b.order_number} value={b.order_number}>
              {b.customer_name} · {b.order_number}
            </option>
          ))}
        </select>
        <input
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="Nama yang ditampilkan"
          className="rounded-xl border bg-white px-4 py-3"
        />
        <select
          value={form.rating}
          onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
          className="rounded-xl border bg-white px-4 py-3"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} bintang
            </option>
          ))}
        </select>
        <textarea
          required
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Isi ulasan pelanggan"
          className="min-h-24 rounded-xl border bg-white px-4 py-3 sm:col-span-2"
        />
        <button className="rounded-full bg-[#243b2c] px-5 py-2.5 text-sm font-bold text-white sm:col-span-2">
          Tambahkan ulasan
        </button>
      </form>
      <div className="mt-5 space-y-3">
        {data.reviews.map((r: any) => (
          <div
            key={r.id}
            className={`rounded-xl border p-4 ${r.active ? '' : 'opacity-50'}`}
          >
            <div className="flex justify-between gap-3">
              <div>
                <b className="text-sm">
                  {r.display_name} · {'★'.repeat(r.rating)}
                </b>
                <p className="text-xs text-[#68736b]">
                  {r.product_name}
                  {r.admin_created ? ' · dibuat admin' : ''}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => edit(r)} className="text-xs font-bold">
                  Edit
                </button>
                <button
                  onClick={() => toggle(r)}
                  className="text-xs font-bold text-[#a34f2c]"
                >
                  {r.active ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminDashboard({
  initialOrders,
  adminName,
}: {
  initialOrders: Order[];
  adminName: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState('semua');
  const [section, setSection] = useState<
    'overview' | 'orders' | 'products' | 'reviews'
  >('overview');
  const visible =
    filter === 'semua' ? orders : orders.filter((o) => o.status === filter);
  async function update(orderNumber: string, status: string) {
    const r = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderNumber, status }),
    });
    if (r.ok)
      setOrders((os) =>
        os.map((o) => (o.order_number === orderNumber ? { ...o, status } : o)),
      );
  }
  const open = orders.filter(
    (o) => !['selesai', 'dibatalkan'].includes(o.status),
  ).length;
  const revenue = orders
    .filter((o) =>
      ['dibayar', 'diproses', 'dikirim', 'selesai'].includes(o.status),
    )
    .reduce((s, o) => s + o.total, 0);
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a34f2c]">
            Simple Ground Admin
          </p>
          <h1 className="mt-2 font-serif text-4xl">Kelola toko</h1>
          <p className="mt-2 text-sm text-[#68736b]">Halo, {adminName}</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
          >
            Lihat toko
          </a>
          <a
            href="/signout-with-chatgpt?return_to=/"
            className="rounded-full bg-[#243b2c] px-4 py-2 text-sm font-semibold text-white"
          >
            Keluar
          </a>
        </div>
      </header>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 lg:flex-col lg:p-3">
            {[
              ['overview', 'Dashboard', LayoutDashboard],
              ['orders', 'Pesanan', ShoppingCart],
              ['products', 'Produk', Package],
              ['reviews', 'Ulasan', MessageSquareText],
            ].map(([value, label, Icon]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setSection(value as typeof section)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition lg:w-full ${section === value ? 'bg-[#243b2c] text-white shadow-sm' : 'text-[#566158] hover:bg-[#f3f1e9]'}`}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </nav>
          <p className="mt-4 hidden px-3 text-xs leading-5 text-[#7b847c] lg:block">
            Pilih menu untuk mengelola bagian toko tanpa halaman yang terlalu
            panjang.
          </p>
        </aside>
        <main className="min-w-0">
          {section === 'overview' && (
            <section>
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
                  Dashboard
                </p>
                <h2 className="mt-1 font-serif text-3xl">
                  Kondisi toko hari ini
                </h2>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#243b2c] p-5 text-white">
                  <p className="text-xs text-white/70">Perlu ditangani</p>
                  <b className="mt-2 block font-serif text-4xl">{open}</b>
                </div>
                <div className="rounded-2xl bg-white p-5">
                  <p className="text-xs text-[#68736b]">Total pesanan</p>
                  <b className="mt-2 block font-serif text-4xl">
                    {orders.length}
                  </b>
                </div>
                <div className="rounded-2xl bg-[#efe7d8] p-5">
                  <p className="text-xs text-[#68736b]">
                    Penjualan terkonfirmasi
                  </p>
                  <b className="mt-2 block font-serif text-2xl">
                    {rupiah(revenue)}
                  </b>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border bg-white p-5 text-sm leading-6 text-[#566158]">
                Gunakan menu di samping untuk menangani pesanan, memperbarui
                produk, dan mengelola ulasan pelanggan.
              </div>
            </section>
          )}
          {section === 'products' && <ProductManager />}
          {section === 'reviews' && <ReviewManager />}
          {section === 'orders' && (
            <section>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
                Transaksi
              </p>
              <h2 className="mt-1 font-serif text-3xl">Pesanan pelanggan</h2>
              <div className="mt-4 flex gap-2 overflow-auto pb-2">
                {['semua', ...Object.keys(labels)].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${filter === s ? 'bg-[#243b2c] text-white' : 'bg-white'}`}
                  >
                    {s === 'semua' ? 'Semua' : labels[s]}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-4">
                {visible.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-12 text-center text-[#68736b]">
                    Belum ada pesanan pada status ini.
                  </div>
                ) : (
                  visible.map((o) => {
                    const Icon = icons[o.status] ?? Clock3;
                    const items = JSON.parse(o.items_json) as {
                      name: string;
                      quantity: number;
                      sku?: string;
                      color?: string;
                      size?: string;
                    }[];
                    return (
                      <article
                        key={o.order_number}
                        className="rounded-2xl border bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col justify-between gap-4 sm:flex-row">
                          <div>
                            <div className="flex items-center gap-2">
                              <Icon size={17} />
                              <b>{o.order_number}</b>
                              <span className="rounded-full bg-[#edf1e9] px-2.5 py-1 text-[11px] font-semibold">
                                {labels[o.status]}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold">
                              {o.customer_name} ·{' '}
                              <a
                                className="underline"
                                href={`https://wa.me/${o.customer_phone.replace(/\D/g, '').replace(/^0/, '62')}`}
                              >
                                {o.customer_phone}
                              </a>
                            </p>
                            <p className="mt-1 max-w-xl text-xs leading-5 text-[#68736b]">
                              {o.shipping_address}
                            </p>
                          </div>
                          <div className="sm:text-right">
                            <b className="text-lg">{rupiah(o.total)}</b>
                            <p className="mt-1 text-xs text-[#68736b]">
                              {new Date(o.created_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 border-t pt-4">
                          <p className="text-sm">
                            {items
                              .map(
                                (i) =>
                                  `${i.quantity}× ${i.name}${i.color || i.size ? ` (${i.color ?? '-'} / ${i.size ?? '-'})` : ''}${i.sku ? ` · SKU ${i.sku}` : ''}`,
                              )
                              .join(' · ')}
                          </p>
                          <select
                            value={o.status}
                            onChange={(e) =>
                              update(o.order_number, e.target.value)
                            }
                            className="mt-4 rounded-xl border bg-[#f7f4ec] px-3 py-2 text-sm font-semibold"
                          >
                            {Object.entries(labels).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
