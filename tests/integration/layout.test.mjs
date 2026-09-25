// Multi-store phase 9: per-store layout (header, banner, cards, corners, fonts,
// section order, footer) and banner images per slide.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { adminLogin, call, createStoreAdmin, db, tinyPng } from './helpers.mjs';

const HOST = 'toko-tata.platform.test';
const STORE = 'it-store-layout';
const s = {};

const as = (who, path, options = {}) =>
  call(path, { host: HOST, cookie: s[who], ...options });
const load = async () =>
  (await as('store_owner', '/api/admin/appearance')).body.appearance;
const patch = (appearance) =>
  as('store_owner', '/api/admin/appearance', {
    method: 'PATCH',
    json: appearance,
  });
const uploadSlide = (who, index, bytes = tinyPng) => {
  const form = new FormData();
  form.set('field', 'slide');
  form.set('index', String(index));
  form.set('file', new File([bytes], 'banner.png', { type: 'image/png' }));
  return as(who, '/api/admin/appearance/images', { method: 'POST', form });
};
const slide = (title) => ({
  eyebrow: '',
  title,
  body: '',
  category: 'Semua',
  label: 'Lihat',
});

before(async () => {
  await db.query(
    "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ($1,'toko-tata','Toko Tata','t','t')",
    [STORE],
  );
  for (const role of ['store_owner', 'store_staff']) {
    const account = await createStoreAdmin(STORE, role);
    s[role] = (await adminLogin({ ...account, host: HOST })).cookie;
  }
});

after(() => db.end());

describe('tata letak bawaan', () => {
  it('toko tanpa pengaturan memakai tata letak awal', async () => {
    const appearance = await load();
    assert.deepEqual(appearance.layout, {
      header: 'classic',
      hero: 'split',
      productCard: 'classic',
      corners: 'rounded',
      background: 'neutral',
      footer: 'dark',
      productColumns: 4,
      sections: ['catalog', 'about', 'reviews', 'newsletter'],
      showTrustBar: true,
    });
    for (const host of [HOST, undefined]) {
      const home = await call('/', { host });
      // HTML attributes only (the page data also names the props, as undefined).
      for (const attribute of [
        'data-sf-font="',
        'data-corners="',
        'data-background="',
        'data-variant="light"',
      ])
        assert.ok(!home.text.includes(attribute), `${host} ${attribute}`);
    }
  });

  it('nilai yang tidak dikenal kembali ke bawaan; urutan dilengkapi', async () => {
    const appearance = await load();
    const response = await patch({
      ...appearance,
      theme: { ...appearance.theme, font: 'comic-sans' },
      layout: {
        header: 'melayang',
        hero: 'banner',
        productColumns: 7,
        sections: ['newsletter', 'newsletter', 'iklan'],
      },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const saved = await load();
    assert.equal(saved.theme.font, 'classic');
    assert.equal(saved.layout.header, 'classic');
    assert.equal(saved.layout.hero, 'banner');
    assert.equal(saved.layout.productColumns, 4);
    assert.deepEqual(saved.layout.sections, [
      'newsletter',
      'catalog',
      'about',
      'reviews',
    ]);
  });
});

describe('pemilik mengubah tata letak', () => {
  before(async () => {
    const appearance = await load();
    const response = await patch({
      ...appearance,
      theme: { ...appearance.theme, font: 'elegant' },
      layout: {
        header: 'brand',
        hero: 'simple',
        productCard: 'framed',
        corners: 'sharp',
        background: 'warm',
        footer: 'light',
        productColumns: 3,
        sections: ['newsletter', 'catalog', 'reviews', 'about'],
        showTrustBar: false,
      },
      content: {
        ...appearance.content,
        heroSlides: [slide('Banner tata letak.')],
        newsletter: {
          enabled: true,
          eyebrow: 'Kabar',
          title: 'Newsletter di atas katalog.',
          body: '',
        },
      },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });

  it('pilihan dipasang di halaman toko', async () => {
    const home = await call('/', { host: HOST });
    assert.equal(home.status, 200);
    for (const text of [
      'data-sf-font="elegant"',
      'data-corners="sharp"',
      'data-background="warm"',
      'data-variant="light"',
      'Banner tata letak.',
    ])
      assert.ok(home.text.includes(text), text);
    // Section order: newsletter before the catalogue.
    assert.ok(
      home.text.indexOf('Newsletter di atas katalog.') <
        home.text.indexOf('Pilihan produk'),
    );
    // Trust bar hidden.
    assert.ok(!home.text.includes('Siap dikirim'));
  });

  it('halaman produk & checkout ikut memakai font, sudut, dan latar toko', async () => {
    const checkout = await call('/checkout', { host: HOST });
    assert.ok(checkout.text.includes('data-corners="sharp"'));
  });

  it('toko lain tidak terpengaruh', async () => {
    const home = await call('/');
    assert.ok(!home.text.includes('data-corners="'));
    assert.ok(home.text.includes('Siap dikirim'));
  });

  it('perubahan tata letak tercatat', async () => {
    const { rows } = await db.query(
      "SELECT meta_json FROM audit_logs WHERE store_id=$1 AND action='appearance.update' ORDER BY id DESC LIMIT 1",
      [STORE],
    );
    assert.match(JSON.parse(rows[0].meta_json).fields, /layout/);
  });
});

describe('gambar banner per slide', () => {
  it('staf ditolak, slide yang tidak ada ditolak', async () => {
    assert.equal((await uploadSlide('store_staff', 0)).status, 403);
    assert.equal((await uploadSlide('store_owner', 3)).status, 400);
    assert.equal((await uploadSlide('store_owner', -1)).status, 400);
  });

  it('diunggah ke slide dan tampil di beranda', async () => {
    const appearance = await load();
    assert.equal(
      (
        await patch({
          ...appearance,
          layout: { ...appearance.layout, hero: 'banner' },
          content: {
            ...appearance.content,
            heroSlides: [slide('Slide satu.'), slide('Slide dua.')],
          },
        })
      ).status,
      200,
    );
    const response = await uploadSlide('store_owner', 1);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    s.bannerUrl = response.body.url;
    assert.match(
      s.bannerUrl,
      /^\/api\/product-image\/stores\/it-store-layout\/branding\/[0-9a-f-]+\.png$/,
    );
    const saved = await load();
    assert.equal(saved.content.heroSlides[0].image, '');
    assert.ok(s.bannerUrl.endsWith(saved.content.heroSlides[1].image));
    assert.equal((await call(s.bannerUrl, { host: HOST })).status, 200);
  });

  it('gambar ikut pindah saat slide diurutkan ulang', async () => {
    const appearance = await load();
    const [first, second] = appearance.content.heroSlides;
    assert.equal(
      (
        await patch({
          ...appearance,
          content: { ...appearance.content, heroSlides: [second, first] },
        })
      ).status,
      200,
    );
    const saved = await load();
    assert.equal(saved.content.heroSlides[0].title, 'Slide dua.');
    assert.ok(s.bannerUrl.endsWith(saved.content.heroSlides[0].image));
  });

  it('gambar tidak bisa diarahkan ke file lain lewat data teks', async () => {
    const appearance = await load();
    const response = await patch({
      ...appearance,
      content: {
        ...appearance.content,
        heroSlides: appearance.content.heroSlides.map((item) => ({
          ...item,
          image: 'stores/default/branding/milik-toko-lain.png',
        })),
      },
    });
    assert.equal(response.status, 200);
    const saved = await load();
    assert.deepEqual(
      saved.content.heroSlides.map((item) => item.image),
      ['', ''],
    );
    // The replaced banner was removed from storage.
    assert.equal((await call(s.bannerUrl, { host: HOST })).status, 404);
  });

  it('slide yang dihapus ikut menghapus gambarnya', async () => {
    const upload = await uploadSlide('store_owner', 0);
    assert.equal(upload.status, 200);
    const appearance = await load();
    assert.equal(
      (
        await patch({
          ...appearance,
          content: {
            ...appearance.content,
            heroSlides: [appearance.content.heroSlides[1]],
          },
        })
      ).status,
      200,
    );
    assert.equal((await call(upload.body.url, { host: HOST })).status, 404);
  });
});
