import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1, getFiles } from '@/db';
async function auth() {
  const u = await getChatGPTUser();
  return (
    u &&
    Boolean(
      await getD1()
        .prepare('SELECT user_id FROM admin_users WHERE user_id=?')
        .bind(u.userId)
        .first(),
    )
  );
}
async function images(files: File[]) {
  if (files.length > 8) throw new Error('Maksimal 8 foto per produk.');
  const keys: string[] = [];
  for (const file of files) {
    if (!file.size) continue;
    if (
      file.size > 5e6 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      throw new Error('Setiap foto harus JPG, PNG, atau WebP maksimal 5 MB.');
    const key = `products/${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
    await getFiles().put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    keys.push(key);
  }
  return keys;
}
const imageUrl = (key: string) => `/api/product-image/${key}`;
const gallery = (p: any) => {
  const keys = JSON.parse(p.images_json || '[]') as string[];
  const urls = keys.map(imageUrl);
  if (!urls.length && p.image) urls.push(p.image);
  return urls;
};
function variants(raw: string) {
  const rows = raw
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((line) => {
      const [color, size, price, stock] = line.split('|').map((x) => x.trim());
      return { color, size, price: Number(price), stock: Number(stock) };
    });
  if (
    !rows.length ||
    rows.some((v) => !v.color || !v.size || v.price <= 0 || v.stock < 0)
  )
    throw new Error(
      'Format varian: Warna | Ukuran | Harga | Stok, satu varian per baris.',
    );
  return rows;
}
const select =
  "SELECT id,name,category,tone,price,stock,active,description,variants_json,images_json,COALESCE('/api/product-image/' || image_key,image_url) AS image FROM products";
export async function GET() {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const r = await getD1().prepare(`${select} ORDER BY updated_at DESC`).all();
  return NextResponse.json({
    products: r.results.map((p: any) => ({
      ...p,
      variants: JSON.parse(p.variants_json || '[]'),
      images: gallery(p),
    })),
  });
}
export async function POST(req: Request) {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  try {
    const f = await req.formData(),
      d1 = getD1(),
      copyId = String(f.get('copyId') || '');
    if (copyId) {
      const p = await d1
        .prepare(`${select} WHERE id=?`)
        .bind(copyId)
        .first<any>();
      if (!p) throw new Error('Produk tidak ditemukan.');
      const id = crypto.randomUUID(),
        now = new Date().toISOString();
      await d1
        .prepare(
          "INSERT INTO products (id,name,category,tone,price,stock,description,variants_json,image_url,image_key,images_json,active,created_at,updated_at) SELECT ?,name||' (Salinan)',category,tone,price,stock,description,variants_json,image_url,image_key,images_json,0,?,? FROM products WHERE id=?",
        )
        .bind(id, now, now, copyId)
        .run();
      return NextResponse.json({ ok: true, id });
    }
    const name = String(f.get('name') || '').trim(),
      category = String(f.get('category') || '').trim(),
      tone = String(f.get('tone') || '').trim(),
      description = String(f.get('description') || '').trim(),
      vs = variants(String(f.get('variants') || ''));
    const keys = await images(
      f.getAll('images').filter((v): v is File => v instanceof File),
    );
    if (!name || !category || !description || !keys.length)
      throw new Error('Lengkapi nama, kategori, deskripsi, dan foto.');
    const price = Math.min(...vs.map((v) => v.price)),
      stock = vs.reduce((s, v) => s + v.stock, 0),
      id = crypto.randomUUID(),
      now = new Date().toISOString();
    await d1
      .prepare(
        'INSERT INTO products (id,name,category,tone,price,stock,description,variants_json,image_key,images_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        name,
        category,
        tone,
        price,
        stock,
        description,
        JSON.stringify(vs),
        keys[0],
        JSON.stringify(keys),
        1,
        now,
        now,
      )
      .run();
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal menyimpan.' },
      { status: 400 },
    );
  }
}
export async function PATCH(req: Request) {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  try {
    const f = await req.formData(),
      d1 = getD1(),
      id = String(f.get('id')),
      name = String(f.get('name') || '').trim(),
      category = String(f.get('category') || '').trim(),
      tone = String(f.get('tone') || '').trim(),
      description = String(f.get('description') || '').trim(),
      vs = variants(String(f.get('variants') || '')),
      active = String(f.get('active')) === 'true' ? 1 : 0,
      old = await d1
        .prepare('SELECT image_key,images_json FROM products WHERE id=?')
        .bind(id)
        .first<{ image_key: string | null; images_json: string }>(),
      newKeys = await images(
        f.getAll('images').filter((v): v is File => v instanceof File),
      ),
      price = Math.min(...vs.map((v) => v.price)),
      stock = vs.reduce((s, v) => s + v.stock, 0),
      storedKeys = JSON.parse(old?.images_json || '[]') as string[],
      previousKeys = storedKeys.length
        ? storedKeys
        : old?.image_key
          ? [old.image_key]
          : [],
      combinedKeys =
        f.get('replaceImages') === 'true'
          ? newKeys
          : [...previousKeys, ...newKeys],
      finalKeys = combinedKeys;
    if (finalKeys.length > 8)
      throw new Error('Total foto maksimal 8 per produk.');
    if (!finalKeys.length && old?.image_key) finalKeys.push(old.image_key);
    await d1
      .prepare(
        'UPDATE products SET name=?,category=?,tone=?,price=?,stock=?,description=?,variants_json=?,active=?,image_key=COALESCE(?,image_key),images_json=?,updated_at=? WHERE id=?',
      )
      .bind(
        name,
        category,
        tone,
        price,
        stock,
        description,
        JSON.stringify(vs),
        active,
        finalKeys[0] ?? null,
        JSON.stringify(finalKeys),
        new Date().toISOString(),
        id,
      )
      .run();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memperbarui.' },
      { status: 400 },
    );
  }
}
export async function DELETE(req: Request) {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  const { id } = (await req.json()) as { id: string },
    d1 = getD1(),
    p = await d1
      .prepare('SELECT image_key FROM products WHERE id=?')
      .bind(id)
      .first<{ image_key: string | null }>();
  await d1.prepare('DELETE FROM products WHERE id=?').bind(id).run();
  if (p?.image_key) {
    const refs = await d1
      .prepare('SELECT COUNT(*) AS count FROM products WHERE image_key=?')
      .bind(p.image_key)
      .first<{ count: number }>();
    if (!refs?.count) await getFiles().delete(p.image_key);
  }
  return NextResponse.json({ ok: true });
}
