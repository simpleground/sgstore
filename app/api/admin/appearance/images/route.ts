import { NextResponse } from 'next/server';
import { getFiles } from '@/db';
import { authorizeStore, type StoreAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import {
  getStoreAppearance,
  imageUrl,
  IMAGE_FIELDS,
  saveStoreAppearance,
  type ImageField,
} from '@/lib/store-appearance';
import { storeFileKey } from '@/lib/tenant';

const MAX_BYTES: Record<ImageField, number> = {
  logo: 1_000_000,
  favicon: 256_000,
  about: 3_000_000,
  share: 2_000_000,
};

const LABELS: Record<ImageField, string> = {
  logo: 'Logo',
  favicon: 'Ikon tab',
  about: 'Foto bagian Tentang',
  share: 'Gambar saat dibagikan',
};

/** Image type from the file's first bytes (never trust the browser's type). SVG is refused. */
function sniff(bytes: Uint8Array): 'png' | 'jpg' | 'webp' | null {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

const isField = (value: unknown): value is ImageField =>
  typeof value === 'string' &&
  (IMAGE_FIELDS as readonly string[]).includes(value);

/** Delete a replaced upload (only this store's own branding files, never shared assets). */
async function removeOld(admin: StoreAdmin, key: string) {
  if (key.startsWith(`stores/${admin.store.id}/branding/`))
    await getFiles()
      .delete(key)
      .catch(() => {});
}

export async function POST(request: Request) {
  const auth = await authorizeStore('settings.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const form = await request.formData().catch(() => null);
  const field = form?.get('field');
  const file = form?.get('file');
  if (!isField(field) || !(file instanceof File))
    return NextResponse.json(
      { error: 'Pilih jenis gambar dan berkasnya.' },
      { status: 400 },
    );
  if (file.size > MAX_BYTES[field])
    return NextResponse.json(
      {
        error: `${LABELS[field]} maksimal ${Math.round(MAX_BYTES[field] / 1000)} KB.`,
      },
      { status: 400 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type)
    return NextResponse.json(
      { error: 'Gunakan gambar PNG, JPG, atau WebP.' },
      { status: 400 },
    );
  const key = storeFileKey(admin.store.id, 'branding', type);
  await getFiles().put(key, bytes, {
    contentType: type === 'jpg' ? 'image/jpeg' : `image/${type}`,
  });
  const appearance = await getStoreAppearance(admin.store);
  const previous = appearance.images[field];
  await saveStoreAppearance(admin.store.id, {
    ...appearance,
    images: { ...appearance.images, [field]: key },
  });
  await removeOld(admin, previous);
  await audit(admin, {
    storeId: admin.store.id,
    action: 'appearance.image',
    meta: { fields: LABELS[field] },
  });
  return NextResponse.json({ ok: true, url: imageUrl(key) });
}

export async function DELETE(request: Request) {
  const auth = await authorizeStore('settings.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const { field } = (await request.json().catch(() => ({}))) as {
    field?: unknown;
  };
  if (!isField(field))
    return NextResponse.json(
      { error: 'Jenis gambar tidak valid.' },
      { status: 400 },
    );
  const appearance = await getStoreAppearance(admin.store);
  const previous = appearance.images[field];
  await saveStoreAppearance(admin.store.id, {
    ...appearance,
    images: { ...appearance.images, [field]: '' },
  });
  await removeOld(admin, previous);
  await audit(admin, {
    storeId: admin.store.id,
    action: 'appearance.image',
    meta: { fields: `${LABELS[field]} dihapus` },
  });
  return NextResponse.json({ ok: true });
}
