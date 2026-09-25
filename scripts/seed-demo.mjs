// Inserts 6 demo products when the store has no products yet (for local testing).
// Usage: npm run db:seed-demo [-- --store=slug]
import { createPool, findStore } from './_lib.mjs';

const products = [
  ['1', 'Kemeja Linen Daily', 'Daily Basic', 'Kemeja', 'Sand', 289000, 20, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85'],
  ['2', 'Kaos Daily Essential', 'Daily Basic', 'Kaos', 'Oat', 159000, 30, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85'],
  ['3', 'Celana Linen Relaxed', 'Daily Basic', 'Celana', 'Sage', 319000, 18, 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=900&q=85'],
  ['4', 'Baju Chef Signature', 'Chef & Kitchen Wear', 'Baju Chef', 'White', 349000, 15, 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=900&q=85'],
  ['5', 'Apron Canvas Ground', 'Chef & Kitchen Wear', 'Apron', 'Earth', 219000, 25, 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85'],
  ['6', 'Topi Chef Classic', 'Chef & Kitchen Wear', 'Topi Chef', 'White', 129000, 30, 'https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?auto=format&fit=crop&w=900&q=85'],
];

const storeSlug = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--store='))
  ?.slice('--store='.length);
const pool = createPool();
try {
  const store = await findStore(pool, storeSlug);
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM products WHERE store_id = $1',
    [store.id],
  );
  if (rows[0].count > 0) {
    console.log(`${store.name} sudah berisi ${rows[0].count} produk — seed dilewati.`);
  } else {
    const now = new Date().toISOString();
    for (const [number, name, category, subcategory, tone, price, stock, image] of products) {
      // Product ids are unique across all stores.
      const id = store.id === 'default' ? number : `${store.id}-demo-${number}`;
      const variants = JSON.stringify([
        { sku: '', color: tone, size: 'M', normalPrice: price, price, stock },
      ]);
      await pool.query(
        `INSERT INTO products (id, store_id, name, category, subcategory, tone, description, variants_json, price, stock, image_url, active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,$12,$12)`,
        [id, store.id, name, category, subcategory, tone, `${name} dari ${store.name}.`, variants, price, stock, image, now],
      );
    }
    console.log(`✔ ${products.length} produk demo ditambahkan ke ${store.name}.`);
  }
} catch (error) {
  console.error('✖ Gagal:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
