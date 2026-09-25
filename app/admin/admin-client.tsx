'use client';
import { csvRecords } from '@/lib/catalog-csv';
import { useEffect, useRef, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { VariantEditor } from './variant-editor';
import { ProductGallery } from './product-gallery';
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
  Printer,
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
  preorder_enabled?: number;
  preorder_days?: number;
  id: string;
  name: string;
  category: string;
  subcategory: string;
  tone: string;
  price: number;
  stock: number;
  sold_count: number;
  weight_grams: number;
  created_at?: string;
  active: number;
  image: string;
  images: string[];
  description: string;
  material: string;
  care_instructions: string;
  production_estimate: string;
  size_guide: string;
  variants: Variant[];
  deleted_at?: string | null;
};
function BulkImport({ onDone, products }: { onDone: () => void; products: Product[] }) {
  const [exportScope, setExportScope] = useState('all');
  const [exportIds, setExportIds] = useState<string[]>([]);
  const [exportQuery, setExportQuery] = useState('');
  const exportable = products.filter(p => !p.deleted_at);
  const selectedIds = exportIds.filter(id => exportable.some(p => p.id === id));
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState<{
      fileName: string;
      rows: any[];
      preview: any;
    } | null>(null);
  function cells(line: string, delimiter: string) {
    const out: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index++;
        } else quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        out.push(value.trim());
        value = '';
      } else value += character;
    }
    out.push(value.trim());
    return out;
  }
  async function upload(file: File) {
    setBusy(true);
    setMessage('Membaca file CSV…');
    try {
      const bytes = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(bytes);
      if (text.includes('\uFFFD'))
        text = new TextDecoder('windows-1252').decode(bytes);
      const lines = csvRecords(text.replace(/^\uFEFF/, '')),
        delimiter = (lines[0] || '').includes(';') ? ';' : ',',
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
      const rows: Record<string, string>[] = [];
      for (let index = 1; index < lines.length; index++) {
        const line = lines[index];
        const values = cells(line, delimiter);
        rows.push(
          Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])),
        );
        if (index % 50 === 0) {
          setMessage(`Membaca baris ${index} dari ${lines.length - 1}…`);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        }
      }
      setMessage(`Memeriksa ${rows.length} baris produk…`);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const r = await fetch('/api/admin/products/bulk', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rows, preview: true }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Impor gagal.');
      setPending({ fileName: file.name, rows, preview: d });
      setMessage(
        'Pratinjau siap. Periksa ringkasan sebelum mengonfirmasi impor.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Impor gagal.');
    }
    setBusy(false);
  }
  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    setMessage('Menyimpan perubahan katalog…');
    try {
      const response = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows: pending.rows, preview: false }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impor gagal.');
      setMessage(
        `${data.count} produk berhasil diproses: ${data.updated} diperbarui dan ${data.created} ditambahkan.`,
      );
      setPending(null);
      await onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impor gagal.');
    }
    setBusy(false);
  }
  function template() {
    const csv =
      'product_id;active;name;category;subcategory;description;material;care_instructions;production_estimate;size_guide;weight_grams;sold_count;sku;color;size;normal_price;discount_percent;stock;image_url\n;1;Contoh produk;Daily Basic;Kaos;Isi deskripsi produk;;;;;500;0;CONTOH-M;Hitam;M;65000;0;20;\n;1;Contoh produk;Daily Basic;Kaos;Isi deskripsi produk;;;;;500;0;CONTOH-L;Hitam;L;67000;0;15;';
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
      if (exportScope === 'selected' && !selectedIds.length) throw new Error('Pilih setidaknya satu produk.');
      const params = new URLSearchParams();
      if (exportScope === 'selected') selectedIds.forEach(id => params.append('id', id));
      const response = await fetch(`/api/admin/products/bulk?${params}`);
      if (!response.ok) throw new Error('Export produk gagal.');
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ||
        'produk-simple-ground.csv';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage('Data produk berhasil diekspor dan siap diedit.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Export produk gagal.',
      );
    }
    setBusy(false);
  }
  return (
    <div className="mt-5 rounded-2xl border border-dashed bg-[#f8faf7] p-4">
      <fieldset className="mb-4 rounded-xl border bg-white p-3">
        <legend className="px-2 text-sm font-bold">Pilih produk untuk diekspor</legend>
        <label className="mr-5 inline-flex items-center gap-2 text-sm"><input type="radio" name="export-scope" checked={exportScope === 'all'} onChange={() => setExportScope('all')} />Semua produk ({exportable.length})</label>
        <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="export-scope" checked={exportScope === 'selected'} onChange={() => setExportScope('selected')} />Produk pilihan ({selectedIds.length})</label>
        {exportScope === 'selected' && <div className="mt-3">
          <input aria-label="Cari produk untuk ekspor" placeholder="Cari nama produk…" value={exportQuery} onChange={e => setExportQuery(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
          <div className="my-2 flex gap-4 text-sm"><button type="button" onClick={() => setExportIds(exportable.map(p => p.id))}>Pilih semua</button><button type="button" onClick={() => setExportIds([])}>Kosongkan pilihan</button></div>
          <div className="max-h-60 space-y-2 overflow-y-auto">{exportable.filter(p => p.name.toLowerCase().includes(exportQuery.toLowerCase())).map(p => <label key={p.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={e => setExportIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} />{p.name}</label>)}</div>
        </div>}
      </fieldset>
      <p className="mb-3 text-xs leading-5">Edit bahan (material), perawatan (care_instructions), estimasi produksi (production_estimate), panduan ukuran (size_guide), berat dalam gram (weight_grams), dan jumlah terjual (sold_count). Data tingkat produk harus sama pada semua baris variannya. Jangan mengubah product_id produk lama. Harga jual dihitung dari harga normal dan diskon.</p>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <b className="text-sm">Edit & upload produk massal</b>
          <p className="mt-1 text-xs text-[#68736b]">
            Export katalog, edit di Excel atau Google Sheets, lalu upload
            kembali. Baris dengan product_id diperbarui. Baris tanpa ID yang
            namanya sangat mirip otomatis masuk sebagai variasi; nama yang
            berbeda tetap menjadi produk baru. Foto produk lama tetap
            dipertahankan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportProducts}
            disabled={busy}
            className="rounded-full border border-[#276344] bg-white px-4 py-2 text-xs font-bold text-[#24593d] disabled:opacity-50"
          >
            {exportScope === 'all' ? 'Ekspor semua produk' : `Ekspor ${selectedIds.length} produk pilihan`}
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
      {pending && (
        <div className="mt-4 rounded-2xl border border-[#d8c8b3] bg-[#fffaf2] p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#a34f2c]">
                Pratinjau impor
              </p>
              <b className="mt-1 block text-sm">{pending.fileName}</b>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={confirmImport}
                className="rounded-xl bg-[#243b2c] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Mengimpor…' : 'Konfirmasi Impor'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setMessage('Impor dibatalkan. Tidak ada data yang diubah.');
                }}
                className="rounded-xl border bg-white px-4 py-2.5 text-xs font-bold"
              >
                Batal
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Baris CSV', pending.preview.rows],
              ['Produk akhir', pending.preview.count],
              ['Produk baru', pending.preview.created],
              ['Diperbarui', pending.preview.updated],
              ['Jadi variasi', pending.preview.groupedRows],
              ['Cocok otomatis', pending.preview.autoMatched],
              ['SKU disesuaikan', pending.preview.skuAdjusted],
              ['Kategori dirapikan', pending.preview.normalizedFields],
              ['Tanpa foto', pending.preview.newProductsWithoutImage],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-[#68736b]">
                  {label}
                </p>
                <p className="mt-1 text-lg font-bold text-[#243b2c]">{value}</p>
              </div>
            ))}
          </div>
          {pending.preview.warnings?.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#edc59f] bg-[#fff3e5] p-3 text-xs text-[#7a3f25]">
              <b>Perlu diperiksa:</b>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {pending.preview.warnings.map((warning: string) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {pending.preview.autoMatchedNames?.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#bad8c5] bg-[#f1faf4] p-3 text-xs text-[#24593d]">
              <b>Dikenali sebagai produk yang sama:</b>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {pending.preview.autoMatchedNames.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-[#68736b]">
            Belum ada produk yang diubah. Data baru disimpan setelah tombol
            Konfirmasi Impor ditekan.
          </p>
        </div>
      )}
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
  async function rename(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/categories', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, category, from, to }),
    });
    const data = (await response.json()) as {
      error?: string;
      changed?: number;
    };
    if (!response.ok) setMessage(data.error ?? 'Perubahan kategori gagal.');
    else {
      setMessage(`${data.changed ?? 0} produk berhasil diperbarui.`);
      setFrom('');
      setTo('');
      await onDone();
    }
    setBusy(false);
  }
  async function normalizeAll() {
    if (!confirm('Rapikan ejaan kategori dan subkategori pada seluruh produk?'))
      return;
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/categories', { method: 'POST' });
    const data = (await response.json()) as {
      error?: string;
      changed?: number;
    };
    if (!response.ok) setMessage(data.error ?? 'Normalisasi kategori gagal.');
    else {
      setMessage(`${data.changed ?? 0} produk berhasil dirapikan otomatis.`);
      await onDone();
    }
    setBusy(false);
  }
  return (
    <div className="mt-5 rounded-2xl border bg-[#f7f4ec] p-4">
      <div>
        <b className="text-sm">Kelola kategori</b>
        <p className="mt-1 text-xs text-[#68736b]">
          Ganti nama atau gabungkan kategori. Semua produk terkait akan ikut
          diperbarui.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={normalizeAll}
          className="mt-3 rounded-xl border border-[#243b2c] bg-white px-4 py-2 text-xs font-bold text-[#243b2c] disabled:opacity-50"
        >
          Rapikan semua kategori otomatis
        </button>
      </div>
      <form
        onSubmit={rename}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
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
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
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
export function ProductManager() {
  const [items, setItems] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [handledEditLink, setHandledEditLink] = useState(false);
  const [dedicatedEdit, setDedicatedEdit] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef<Array<{ file: File; url: string }>>([]);
  const [selectedImages, setSelectedImages] = useState<
    Array<{ file: File; url: string }>
  >([]);
  const [productTab, setProductTab] = useState<'active' | 'archived' | 'trash'>(
    'active',
  );
  const [catalogSort, setCatalogSort] = useState('rekomendasi');
  const [search, setSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('Semua');
  const [catalogSubcategory, setCatalogSubcategory] = useState('Semua');
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [mergeTarget, setMergeTarget] = useState('');
  const [merging, setMerging] = useState(false);
  async function load() {
    const r = await fetch('/api/admin/products');
    if (r.ok) setItems((await r.json()).products);
    else setError('Katalog gagal dimuat. Muat ulang halaman untuk mencoba lagi.');
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const channel = new BroadcastChannel('simple-ground-products');
    channel.onmessage = () => load();
    return () => channel.close();
  }, []);
  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);
  useEffect(
    () => () =>
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.url),
      ),
    [],
  );
  useEffect(() => {
    if (handledEditLink) return;
    if (new URLSearchParams(window.location.search).has('new')) {
      setDedicatedEdit(true); setOpen(true); setHandledEditLink(true); return;
    }
    if (!items.length) return;
    const editId = new URLSearchParams(window.location.search).get('edit');
    const product = editId ? items.find((item) => item.id === editId) : null;
    if (product) {
      setDedicatedEdit(true);
      setEditing(product);
      setOpen(true);
      requestAnimationFrame(() =>
        document
          .getElementById('product-editor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
    setHandledEditLink(true);
  }, [handledEditLink, items]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    if (editing) {
      fd.set('id', editing.id);
      fd.set('active', String(editing.active !== 0));
    }
    try {
    const r = await fetch('/api/admin/products', {
      method: editing ? 'PATCH' : 'POST',
      body: fd,
    });
    if (r.ok) {
      selectedImages.forEach((image) => URL.revokeObjectURL(image.url));
      setSelectedImages([]);
      if (dedicatedEdit) {
        const channel = new BroadcastChannel('simple-ground-products');
        channel.postMessage('updated');
        channel.close();
        window.location.assign('/admin?section=products');
        return;
      }
      setOpen(false);
      setEditing(null);
      await load();
    } else setError((await r.json()).error ?? 'Gagal menyimpan.');
    } catch { setError('Koneksi terputus. Produk belum tersimpan. Silakan coba lagi.'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (
      !confirm(
        'Pindahkan produk ke Tong Sampah? Produk dapat dipulihkan selama 30 hari.',
      )
    )
      return;
    const response = await fetch('/api/admin/products', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!response.ok)
      setError((await response.json()).error ?? 'Gagal memindahkan produk.');
    await load();
  }
  async function restoreDeleted(id: string) {
    const response = await fetch('/api/admin/products', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, restoreDeleted: true }),
    });
    if (!response.ok)
      setError((await response.json()).error ?? 'Produk gagal dipulihkan.');
    else setProductTab('archived');
    await load();
  }
  async function deletePermanently(id: string) {
    if (
      !confirm(
        'Hapus produk ini secara permanen? Produk, ulasan, dan data keranjangnya tidak dapat dipulihkan.',
      )
    )
      return;
    const response = await fetch('/api/admin/products', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, permanent: true }),
    });
    if (!response.ok)
      setError((await response.json()).error ?? 'Penghapusan permanen gagal.');
    await load();
  }
  async function copy(id: string) {
    const fd = new FormData();
    fd.set('copyId', id);
    try {
      const response = await fetch('/api/admin/products', { method: 'POST', body: fd });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Produk gagal disalin.');
      setProductTab('archived');
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Koneksi terputus. Coba lagi.'); }
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
    const selected = [
      target,
      ...sourceIds.map((id) => items.find((item) => item.id === id)),
    ].filter(Boolean) as Product[];
    const skuCounts = new Map<string, number>();
    for (const product of selected)
      for (const variant of product.variants) {
        const sku = variant.sku?.trim().toLowerCase();
        if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
      }
    const duplicateSkus = Array.from(skuCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([sku]) => sku.toUpperCase());
    const skuNotice = duplicateSkus.length
      ? `\n\nSKU ganda akan diubah otomatis agar unik:\n${duplicateSkus
          .slice(0, 8)
          .map((sku) => `• ${sku}`)
          .join(
            '\n',
          )}${duplicateSkus.length > 8 ? `\n• dan ${duplicateSkus.length - 8} SKU lainnya` : ''}\n\nSKU pertama pada produk induk tetap dipertahankan.`
      : '\n\nJika ditemukan SKU atau kombinasi variasi ganda, SKU berikutnya akan dibuat unik secara otomatis.';
    if (
      !confirm(
        `Gabungkan ${sourceIds.length} produk ke "${target?.name}"? Produk sumber akan diarsipkan.${skuNotice}`,
      )
    )
      return;
    setMerging(true);
    setError('');
    const response = await fetch('/api/admin/products/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetId: mergeTarget, sourceIds }),
    });
    const result = await response.json();
    if (response.ok) {
      const changedSkuText = result.skuChanges?.length
        ? ` ${result.skuChanges.length} SKU diubah otomatis.`
        : '';
      alert(
        `Berhasil: ${result.mergedVariants} variasi digabung dan ${result.archivedProducts} produk sumber diarsipkan.${changedSkuText}`,
      );
      setMergeIds([]);
      setMergeTarget('');
      await load();
    } else setError(result.error || 'Gagal menggabungkan produk.');
    setMerging(false);
  }
  const activeCount = items.filter(
    (item) => !item.deleted_at && item.active !== 0,
  ).length;
  const archivedCount = items.filter(
    (item) => !item.deleted_at && item.active === 0,
  ).length;
  const trashCount = items.filter((item) => Boolean(item.deleted_at)).length;
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
  const visibleItems = items
    .filter((item) => `${item.name} ${item.variants.map((v) => v.sku || '').join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .filter((item) =>
      productTab === 'trash'
        ? Boolean(item.deleted_at)
        : !item.deleted_at &&
          (productTab === 'active' ? item.active !== 0 : item.active === 0),
    )
    .filter(
      (item) =>
        catalogCategory === 'Semua' || item.category === catalogCategory,
    )
    .filter(
      (item) =>
        catalogSubcategory === 'Semua' ||
        item.subcategory === catalogSubcategory,
    )
    .sort((a, b) => {
      if (catalogSort === 'terlaris')
        return (b.sold_count || 0) - (a.sold_count || 0);
      if (catalogSort === 'terbaru')
        return String(b.created_at || '').localeCompare(
          String(a.created_at || ''),
        );
      if (catalogSort === 'termurah') return a.price - b.price;
      if (catalogSort === 'tertinggi') return b.price - a.price;
      return 0;
    });
  return (
    <section className="rounded-3xl border bg-white p-5 sm:p-7">
      {!dedicatedEdit && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
              Katalog
            </p>
            <h2 className="mt-1 font-serif text-2xl">Produk & harga</h2>
          </div>
          <button
            onClick={() => {
              window.location.assign('/admin?new=1');
            }}
            className="flex items-center gap-2 rounded-full bg-[#243b2c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Tambah produk
          </button>
        </div>
      )}
      {!dedicatedEdit && (
        <>
          <details className="admin-tool"><summary>Impor & ekspor produk CSV</summary><BulkImport onDone={load} products={items} /></details>
          <details className="admin-tool"><summary>Kelola kategori & subkategori</summary><CategoryManager items={items} onDone={load} /></details>
        </>
      )}
      {!dedicatedEdit && mergeIds.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#d7c9b7] bg-[#fffaf2] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold">
              Produk induk ({mergeIds.length} produk dipilih)
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              >
                <option value="">Pilih produk yang dipertahankan</option>
                {items
                  .filter((item) => mergeIds.includes(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.variants.length} variasi
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              disabled={merging || !mergeTarget || mergeIds.length < 2}
              onClick={mergeProducts}
              className="rounded-xl bg-[#a34f2c] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {merging
                ? 'Menggabungkan…'
                : `Gabungkan ${Math.max(0, mergeIds.length - 1)} produk`}
            </button>
            <button
              type="button"
              onClick={() => {
                setMergeIds([]);
                setMergeTarget('');
              }}
              className="rounded-xl border bg-white px-4 py-3 text-sm"
            >
              Batal
            </button>
          </div>
          <p className="mt-2 text-xs text-[#68736b]">
            Semua variasi, foto, ulasan, dan keranjang pelanggan dipindahkan.
            Produk sumber kemudian diarsipkan.
          </p>
        </div>
      )}
      {dedicatedEdit && (
        <div className="mb-5 flex flex-col justify-between gap-3 border-b pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
              {editing ? 'Edit produk' : 'Tambah produk'}
            </p>
            <h2 className="mt-1 font-serif text-3xl">{editing?.name || 'Produk baru'}</h2>
            <p className="mt-1 text-sm text-[#68736b]">
              Perbarui informasi, variasi, stok, harga, dan foto produk ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign('/admin?section=products')}
            className="rounded-full border px-4 py-2 text-sm font-semibold"
          >
            Kembali ke katalog
          </button>
        </div>
      )}
      {open && (
        <form
          id="product-editor"
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
          <textarea
            name="material"
            defaultValue={editing?.material}
            placeholder="Bahan, contoh: Linen blend 55% linen, 45% rayon"
            className="min-h-20 rounded-xl border bg-white px-4 py-3"
          />
          <textarea
            name="care_instructions"
            defaultValue={editing?.care_instructions}
            placeholder="Perawatan, contoh: Cuci lembut, jangan gunakan pemutih"
            className="min-h-20 rounded-xl border bg-white px-4 py-3"
          />
          <textarea
            name="size_guide"
            defaultValue={editing?.size_guide}
            placeholder="Panduan ukuran, contoh: S: LD 96 cm · M: LD 100 cm · L: LD 104 cm"
            className="min-h-20 rounded-xl border bg-white px-4 py-3"
          />
          <input
            name="production_estimate"
            defaultValue={editing?.production_estimate}
            placeholder="Estimasi produksi, contoh: Siap kirim / 3–5 hari kerja"
            className="rounded-xl border bg-white px-4 py-3"
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
          <label className="text-xs font-bold text-[#566158]">
            JUMLAH TERJUAL
            <input
              name="sold_count"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={editing?.sold_count ?? 0}
              className="mt-1 block w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-bold text-[#566158]">
            BERAT PRODUK (GRAM)
            <input
              name="weightGrams"
              type="number"
              min="1"
              max="50000"
              step="1"
              required
              defaultValue={editing?.weight_grams ?? 500}
              className="mt-1 block w-full rounded-xl border bg-white px-4 py-3 text-sm font-normal"
            />
            <span className="mt-1 block font-normal text-[#7b847c]">
              Dipakai untuk menghitung ongkir.
            </span>
          </label>
          <ProductGallery initial={editing?.images} />
          <VariantEditor initial={editing?.variants} preorderEnabled={Boolean(editing?.preorder_enabled)} preorderDays={editing?.preorder_days ?? 2} />
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
                if (dedicatedEdit) { window.location.assign('/admin?section=products'); return; }
                selectedImages.forEach((image) =>
                  URL.revokeObjectURL(image.url),
                );
                setSelectedImages([]);
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
      {!dedicatedEdit && (
        <>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <input aria-label="Cari produk atau SKU" placeholder="Cari nama produk atau SKU…" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-5 w-full rounded-lg border bg-white px-4 py-3 text-sm" />
          <div className="mt-6 flex gap-1 rounded-xl bg-[#f1f1eb] p-1 sm:w-fit">
            {(
              [
                ['active', 'Produk Aktif', activeCount],
                ['archived', 'Diarsipkan', archivedCount],
                ['trash', 'Tong Sampah', trashCount],
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
          <div className="mt-4 grid gap-3 rounded-2xl border bg-[#f7f4ec] p-4 sm:grid-cols-3">
            <label className="text-xs font-bold text-[#566158]">
              KATEGORI
              <select
                value={catalogCategory}
                onChange={(e) => {
                  setCatalogCategory(e.target.value);
                  setCatalogSubcategory('Semua');
                }}
                className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
              >
                <option value="Semua">Semua kategori</option>
                {categoryOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[#566158]">
              SUBKATEGORI
              <select
                value={catalogSubcategory}
                onChange={(e) => setCatalogSubcategory(e.target.value)}
                className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
              >
                <option value="Semua">Semua subkategori</option>
                {subcategoryOptions
                  .filter(
                    (value) =>
                      catalogCategory === 'Semua' ||
                      items.some(
                        (item) =>
                          item.category === catalogCategory &&
                          item.subcategory === value,
                      ),
                  )
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[#566158]">
              URUTKAN
              <select
                value={catalogSort}
                onChange={(e) => setCatalogSort(e.target.value)}
                className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
              >
                <option value="rekomendasi">Rekomendasi</option>
                <option value="terlaris">Terlaris</option>
                <option value="terbaru">Terbaru</option>
                <option value="termurah">Termurah</option>
                <option value="tertinggi">Tertinggi</option>
              </select>
            </label>
          </div>
          {visibleItems.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed px-5 py-10 text-center text-sm text-[#68736b]">
              {productTab === 'active'
                ? 'Belum ada produk aktif.'
                : productTab === 'archived'
                  ? 'Belum ada produk yang diarsipkan.'
                  : 'Tong Sampah masih kosong.'}
            </div>
          )}
          <div className="admin-product-list mt-4">
            {visibleItems.map((p) => (
              <article
                key={p.id}
                className={`admin-product-row flex gap-3 border-b p-4 ${p.active === 0 ? 'bg-[#f1f1ed]' : ''}`}
              >
                {productTab === 'active' && (
                  <input
                    type="checkbox"
                    aria-label={`Pilih ${p.name} untuk digabung`}
                    checked={mergeIds.includes(p.id)}
                    onChange={(e) => {
                      setMergeIds((current) =>
                        e.target.checked
                          ? [...current, p.id]
                          : current.filter((id) => id !== p.id),
                      );
                      if (!e.target.checked && mergeTarget === p.id)
                        setMergeTarget('');
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
                        {p.deleted_at ? 'Dihapus' : 'Diarsipkan'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#68736b]">
                    {p.category} › {p.subcategory} · stok {p.stock} ·{' '}
                    {p.sold_count || 0} terjual · {p.weight_grams || 500} gram · {p.images?.length || 1} foto
                  </p>
                  <p className="mt-1 text-sm font-bold">{rupiah(p.price)}</p>
                  {p.deleted_at && (
                    <p className="mt-1 text-[11px] font-semibold text-[#9b4b30]">
                      Dihapus{' '}
                      {new Date(p.deleted_at).toLocaleDateString('id-ID')} ·
                      dapat dipulihkan hingga{' '}
                      {new Date(
                        new Date(p.deleted_at).getTime() + 30 * 86400000,
                      ).toLocaleDateString('id-ID')}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {p.deleted_at ? (
                      <>
                        <button
                          onClick={() => restoreDeleted(p.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-[#24593d]"
                        >
                          <RotateCcw size={13} /> Pulihkan
                        </button>
                        <button
                          onClick={() => deletePermanently(p.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-red-700"
                        >
                          <Trash2 size={13} /> Hapus Permanen
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          href={`/admin?edit=${encodeURIComponent(p.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold"
                        >
                          <Pencil size={13} /> Edit
                        </a>
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
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function ReviewManager() {
  const [data, setData] = useState<any>({
    reviews: [],
    products: [],
    buyers: [],
  });
  const [form, setForm] = useState({
    productId: '',
    orderNumber: '',
    displayName: '',
    city: '',
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
        city: '',
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
    const city = prompt('Kota pelanggan', review.city || '');
    if (!city) return;
    const body = prompt('Isi ulasan', review.body);
    if (!body) return;
    await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: review.id,
        displayName,
        city,
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
        city: review.city,
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
        <input
          required
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="Kota pelanggan"
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
                  {r.display_name}
                  {r.city ? ` · ${r.city}` : ''} · {'★'.repeat(r.rating)}
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

export function ShippingManager() {
  const [couriers, setCouriers] = useState<
    { code: string; name: string; active: boolean }[]
  >([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    fetch('/api/admin/shipping-settings')
      .then((response) => response.json() as Promise<{couriers?: {code:string;name:string;active:boolean}[]}> )
      .then((data) => { if (!data.couriers) throw new Error('Pengaturan gagal dimuat.'); setCouriers(data.couriers); })
      .catch(() => setMessage('Pengaturan gagal dimuat. Muat ulang halaman untuk mencoba lagi.'));
  }, []);
  async function toggle(code: string, active: boolean) {
    setBusy(code);
    setMessage('');
    try {
    const response = await fetch('/api/admin/shipping-settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, active }),
    });
    if (response.ok) {
      setCouriers((current) =>
        current.map((courier) =>
          courier.code === code ? { ...courier, active } : courier,
        ),
      );
      setMessage('Pengaturan pengiriman tersimpan.');
    } else setMessage('Pengaturan gagal disimpan. Coba lagi.');
    } catch { setMessage('Koneksi terputus. Perubahan belum tersimpan.'); }
    finally { setBusy(''); }
  }
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a34f2c]">
        Logistik
      </p>
      <h2 className="mt-1 font-serif text-3xl">Pengaturan ekspedisi</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736b]">
        Matikan ekspedisi yang tidak ingin ditampilkan saat pelanggan mengecek
        ongkir. Perubahan langsung berlaku di checkout.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {couriers.map((courier) => (
          <div
            key={courier.code}
            className="flex items-center justify-between rounded-2xl border bg-white p-4"
          >
            <div>
              <b>{courier.name}</b>
              <p className="mt-1 text-xs text-[#7b847c]">
                {courier.active ? 'Aktif di checkout' : 'Tidak ditampilkan'}
              </p>
            </div>
            <Switch
              disabled={busy === courier.code}
              checked={courier.active}
              onCheckedChange={(checked) => toggle(courier.code, checked)}
              aria-label={`Aktifkan ${courier.name}`}
            />
          </div>
        ))}
      </div>
      {message && (
        <p className="mt-4 text-sm font-semibold text-[#566158]">{message}</p>
      )}
      <div className="mt-5 rounded-2xl bg-[#efe7d8] p-4 text-sm leading-6 text-[#566158]">
        Integrasi saat ini memakai mode sandbox Biteship. Ongkir dapat diuji,
        tetapi pembuatan resi resmi dan pickup belum aktif sampai akun produksi
        digunakan.
      </div>
    </section>
  );
}

export function printLabel(order: Order) {
    const items = JSON.parse(order.items_json) as {
      name: string;
      quantity: number;
      sku?: string;
      color?: string;
      size?: string;
    }[];
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (character) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
          })[character] || character,
      );
    const popup = window.open('', '_blank', 'width=620,height=880');
    if (!popup) return;
    popup.document.write(
      `<!doctype html><html><head><title>Label ${escape(order.order_number)}</title><style>@page{size:A6 portrait;margin:7mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;margin:0;color:#111}.label{border:2px solid #111;padding:12px;min-height:134mm}.brand{font-size:20px;font-weight:800}.order{font-size:17px;font-weight:800;border:2px solid #111;padding:8px;margin:10px 0}.box{border-top:1px solid #111;padding-top:9px;margin-top:9px}.small{font-size:10px;line-height:1.4}h2{font-size:11px;margin:0 0 5px;text-transform:uppercase}p{white-space:pre-line;margin:2px 0;line-height:1.4}ul{padding-left:18px;margin:5px 0}</style></head><body><div class="label"><div class="brand">SIMPLE GROUND</div><div class="order">${escape(order.order_number)}</div><div class="box"><h2>Penerima</h2><b>${escape(order.customer_name)}</b><p>${escape(order.customer_phone)}</p><p>${escape(order.shipping_address)}</p></div><div class="box"><h2>Isi paket</h2><ul>${items.map((item) => `<li>${item.quantity}× ${escape(item.name)}${item.color || item.size ? ` — ${escape(item.color || '-')} / ${escape(item.size || '-')}` : ''}${item.sku ? ` (${escape(item.sku)})` : ''}</li>`).join('')}</ul></div><div class="box small"><h2>Pengirim</h2><b>Simple Ground · 085172381996</b><p>Kp. Dungus Maung RT 7 RW 4, Sirnagalih, Cisurupan, Garut, Jawa Barat 44163</p></div></div><script>window.onload=()=>{window.print()}<\/script></body></html>`,
    );
    popup.document.close();
  }
