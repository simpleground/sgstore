import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
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
export async function POST(req: Request) {
  if (!(await auth()))
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  try {
    const { rows } = (await req.json()) as { rows: any[] };
    if (!Array.isArray(rows) || !rows.length || rows.length > 500)
      throw new Error('Maksimal 500 baris sekali impor.');
    const groups = new Map<string, any>();
    for (const r of rows) {
      const normalPrice = Number(r.normal_price);
      const discountPercent = Number(r.discount_percent);
      const price = Math.round(normalPrice * (1 - discountPercent / 100));
      if (
        !r.name ||
        !r.category ||
        !r.subcategory ||
        !r.color ||
        !r.size ||
        normalPrice <= 0 ||
        discountPercent < 0 ||
        discountPercent >= 100 ||
        price <= 0 ||
        Number(r.stock) < 0
      )
        throw new Error('Ada baris yang belum lengkap.');
      const k = `${r.name}|${r.category}|${r.subcategory}`;
      const g = groups.get(k) ?? { ...r, variants: [] };
      g.variants.push({
        sku: r.sku || '',
        color: r.color,
        size: r.size,
        normalPrice,
        price,
        stock: Number(r.stock),
      });
      groups.set(k, g);
    }
    const d = getD1(),
      now = new Date().toISOString();
    await d.batch(
      [...groups.values()].map((g) => {
        const prices = g.variants.map((v: any) => v.price),
          stock = g.variants.reduce((s: number, v: any) => s + v.stock, 0);
        return d
          .prepare(
            'INSERT INTO products (id,name,category,subcategory,tone,price,stock,description,variants_json,image_url,images_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)',
          )
          .bind(
            crypto.randomUUID(),
            g.name,
            g.category,
            g.subcategory,
            g.color,
            Math.min(...prices),
            stock,
            g.description || g.name,
            JSON.stringify(g.variants),
            g.image_url || null,
            '[]',
            now,
            now,
          );
      }),
    );
    return NextResponse.json({ ok: true, count: groups.size });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Impor gagal.' },
      { status: 400 },
    );
  }
}
