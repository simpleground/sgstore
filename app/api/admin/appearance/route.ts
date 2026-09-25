import { NextResponse } from 'next/server';
import { authorizeStore } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import {
  AppearanceError,
  getStoreAppearance,
  imageUrl,
  IMAGE_FIELDS,
  saveStoreAppearance,
  validateAppearance,
} from '@/lib/store-appearance';

export async function GET() {
  const auth = await authorizeStore('settings.manage');
  if (!auth.ok) return auth.response;
  const appearance = await getStoreAppearance(auth.admin.store);
  return NextResponse.json(
    {
      appearance,
      imageUrls: Object.fromEntries(
        IMAGE_FIELDS.map((field) => [
          field,
          imageUrl(appearance.images[field]),
        ]),
      ),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

/** Theme, homepage content and SEO. Images change through ./images. */
export async function PATCH(request: Request) {
  const auth = await authorizeStore('settings.manage');
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  try {
    const current = await getStoreAppearance(admin.store);
    const next = validateAppearance(
      await request.json().catch(() => ({})),
      current,
    );
    const changed = (['theme', 'content', 'seo'] as const).filter(
      (key) => JSON.stringify(next[key]) !== JSON.stringify(current[key]),
    );
    await saveStoreAppearance(admin.store.id, next);
    if (changed.length)
      await audit(admin, {
        storeId: admin.store.id,
        action: 'appearance.update',
        meta: { fields: changed.join(', ') },
      });
    return NextResponse.json({ ok: true, changed });
  } catch (error) {
    if (error instanceof AppearanceError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
