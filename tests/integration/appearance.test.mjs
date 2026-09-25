// Multi-store phase 5: per-store theme, homepage content, SEO and branding images.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { adminLogin, call, createStoreAdmin, db, tinyPng } from './helpers.mjs';

const HOST = 'toko-tampil.platform.test';
const STORE = 'it-store-look';
const s = {};

const as = (who, path, options = {}) =>
  call(path, { host: HOST, cookie: s[who].cookie, ...options });
const upload = (who, field, bytes, type = 'image/png', name = 'gambar.png') => {
  const form = new FormData();
  form.set('field', field);
  form.set('file', new File([bytes], name, { type }));
  return as(who, '/api/admin/appearance/images', { method: 'POST', form });
};
const load = async () =>
  (await as('store_owner', '/api/admin/appearance')).body;
const patch = (who, appearance) =>
  as(who, '/api/admin/appearance', { method: 'PATCH', json: appearance });

before(async () => {
  await db.query(
    "INSERT INTO stores (id,slug,name,created_at,updated_at) VALUES ($1,'toko-tampil','Toko Tampil','t','t')",
    [STORE],
  );
  for (const role of ['store_owner', 'store_admin', 'store_staff']) {
    const account = await createStoreAdmin(STORE, role);
    const { cookie } = await adminLogin({ ...account, host: HOST });
    s[role] = { ...account, cookie };
  }
});

after(() => db.end());

describe('toko bawaan tetap seperti sebelumnya', () => {
  it('konten, judul, ikon, dan gambar bagikan Simple Ground', async () => {
    const home = await call('/');
    for (const text of [
      '<title>Simple Ground — Daily &amp; Kitchen Wear</title>',
      'Seragam kerja yang terasa senyaman pakaian sehari-hari.',
      'Tentang Simple Ground',
      'Ground Notes',
      'Belanja online · Bayar VA / QRIS · WhatsApp untuk konsultasi',
      'href="/favicon.svg"',
      '/og.png',
    ])
      assert.ok(home.text.includes(text), text);
    assert.doesNotMatch(home.text, /<html[^>]*data-brand-primary/);
  });
});

describe('toko baru memakai tampilan netral, bukan milik Simple Ground', () => {
  it('judul & sambutan memakai nama toko', async () => {
    const home = await call('/', { host: HOST });
    assert.equal(home.status, 200);
    assert.ok(home.text.includes('<title>Toko Tampil</title>'));
    assert.ok(home.text.includes('Selamat datang di Toko Tampil.'));
    for (const text of [
      'Simple Ground',
      'Ground Notes',
      '/favicon.svg',
      '/og.png',
      'simple-ground-building',
    ])
      assert.ok(!home.text.includes(text), text);
  });
});

describe('izin', () => {
  it('staf tidak boleh mengubah tampilan', async () => {
    assert.equal(
      (await as('store_staff', '/api/admin/appearance')).status,
      403,
    );
    assert.equal((await patch('store_staff', {})).status, 403);
    assert.equal((await upload('store_staff', 'logo', tinyPng)).status, 403);
  });

  it('admin toko boleh', async () => {
    const response = await as('store_admin', '/api/admin/appearance');
    assert.equal(response.status, 200);
    assert.equal(response.body.appearance.content.heroSlides.length, 1);
  });
});

describe('validasi', () => {
  const cases = [
    {
      label: 'warna terlalu terang',
      change: (a) => ({ ...a, theme: { ...a.theme, primaryColor: '#ffff00' } }),
    },
    {
      label: 'kode warna salah',
      change: (a) => ({ ...a, theme: { ...a.theme, accentColor: 'merah' } }),
    },
    {
      label: 'tanpa slide',
      change: (a) => ({ ...a, content: { ...a.content, heroSlides: [] } }),
    },
    {
      label: 'lebih dari 6 slide',
      change: (a) => ({
        ...a,
        content: {
          ...a.content,
          heroSlides: Array(7).fill(a.content.heroSlides[0]),
        },
      }),
    },
    {
      label: 'bagian Tentang tanpa judul',
      change: (a) => ({
        ...a,
        content: {
          ...a.content,
          about: { ...a.content.about, enabled: true, title: '' },
        },
      }),
    },
  ];
  for (const { label, change } of cases)
    it(`${label} ditolak`, async () => {
      const { appearance } = await load();
      assert.equal(
        (await patch('store_owner', change(appearance))).status,
        400,
      );
    });

  it('gambar tidak bisa diganti lewat data teks (mis. menunjuk file toko lain)', async () => {
    const { appearance } = await load();
    const response = await patch('store_owner', {
      ...appearance,
      images: {
        ...appearance.images,
        logo: 'stores/default/branding/milik-orang-lain.png',
      },
    });
    assert.equal(response.status, 200);
    assert.equal((await load()).appearance.images.logo, '');
  });
});

describe('pemilik mengubah tampilan', () => {
  before(async () => {
    const { appearance } = await load();
    const response = await patch('store_owner', {
      ...appearance,
      theme: {
        primaryColor: '#1E3A8A',
        accentColor: '#9d174d',
        font: 'modern',
      },
      content: {
        ...appearance.content,
        announcement: 'Gratis ongkir minggu ini',
        tagline: 'Toko biru yang ramah.',
        heroSlides: [
          {
            eyebrow: 'BARU',
            title: 'Koleksi biru telah tiba.',
            body: 'Lihat semuanya.',
            category: 'Semua',
            label: 'Belanja',
          },
          {
            eyebrow: 'KAOS',
            title: 'Kaos harian.',
            body: '',
            category: 'Daily Basic',
            label: 'Lihat kaos',
          },
        ],
        about: {
          enabled: true,
          eyebrow: 'Cerita kami',
          title: 'Dibuat di Bandung.',
          body: 'Usaha keluarga sejak 2020.',
          imageAlt: '',
          highlights: [{ title: 'Cepat', caption: 'dikirim hari ini' }],
        },
        showReviews: false,
        newsletter: { enabled: false, eyebrow: '', title: '', body: '' },
      },
      seo: {
        title: 'Toko Tampil — Serba Biru',
        description: 'Semua serba biru.',
        shareDescription: '',
      },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });

  it('warna & font toko dipasang di halaman', async () => {
    const home = await call('/', { host: HOST });
    assert.match(home.text, /<html[^>]*data-brand-primary=""/);
    assert.match(home.text, /<html[^>]*data-brand-accent=""/);
    assert.match(home.text, /--brand-primary:#1e3a8a/);
    assert.match(home.text, /--brand-accent-base:#9d174d/);
    assert.match(home.text, /<body[^>]*data-font="modern"/);
  });

  it('konten & SEO beranda berubah', async () => {
    const home = await call('/', { host: HOST });
    for (const text of [
      '<title>Toko Tampil — Serba Biru</title>',
      'Semua serba biru.',
      'Gratis ongkir minggu ini',
      'Koleksi biru telah tiba.',
      'Dibuat di Bandung.',
      'dikirim hari ini',
      'Toko biru yang ramah.',
    ])
      assert.ok(home.text.includes(text), text);
    assert.ok(!home.text.includes('Ulasan pelanggan'));
    assert.ok(
      !home.text.includes('newsletter-email') &&
        !home.text.includes('Email kamu'),
    );
  });

  it('toko lain tidak terpengaruh', async () => {
    const home = await call('/');
    assert.doesNotMatch(home.text, /<html[^>]*data-brand-primary/);
    assert.ok(!home.text.includes('#1e3a8a'));
    assert.ok(home.text.includes('Ground Notes'));
  });
});

describe('logo & gambar', () => {
  it('file yang bukan gambar (mis. SVG berisi skrip) ditolak', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const response = await upload(
      'store_owner',
      'logo',
      svg,
      'image/png',
      'logo.png',
    );
    assert.equal(response.status, 400);
  });

  it('ukuran terlalu besar ditolak', async () => {
    const big = Buffer.concat([tinyPng, Buffer.alloc(300_000)]);
    assert.equal((await upload('store_owner', 'favicon', big)).status, 400);
  });

  it('logo diunggah, tampil, dan hanya bisa diambil lewat toko ini', async () => {
    const response = await upload('store_owner', 'logo', tinyPng);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    s.logoUrl = response.body.url;
    assert.match(
      s.logoUrl,
      /^\/api\/product-image\/stores\/it-store-look\/branding\/[0-9a-f-]+\.png$/,
    );
    assert.equal((await call(s.logoUrl, { host: HOST })).status, 200);
    assert.equal((await call(s.logoUrl)).status, 404);
    const home = await call('/', { host: HOST });
    assert.ok(home.text.includes(s.logoUrl));
  });

  it('favicon & gambar bagikan dipakai di metadata', async () => {
    const favicon = await upload('store_owner', 'favicon', tinyPng);
    const share = await upload('store_owner', 'share', tinyPng);
    const home = await call('/', { host: HOST });
    assert.ok(home.text.includes(`rel="icon" href="${favicon.body.url}"`));
    assert.match(
      home.text,
      new RegExp(`property="og:image" content="[^"]*${share.body.url}`),
    );
  });

  it('mengganti logo menghapus file lama', async () => {
    const replaced = await upload('store_owner', 'logo', tinyPng);
    assert.equal(replaced.status, 200);
    assert.equal((await call(s.logoUrl, { host: HOST })).status, 404);
    s.logoUrl = replaced.body.url;
  });

  it('logo bisa dihapus', async () => {
    const response = await as('store_owner', '/api/admin/appearance/images', {
      method: 'DELETE',
      json: { field: 'logo' },
    });
    assert.equal(response.status, 200);
    const home = await call('/', { host: HOST });
    assert.ok(!home.text.includes(s.logoUrl));
    assert.equal((await call(s.logoUrl, { host: HOST })).status, 404);
  });
});

describe('halaman lain', () => {
  it('judul halaman produk & login admin memakai nama toko', async () => {
    const login = await call('/admin/login', { host: HOST });
    assert.ok(login.text.includes('Masuk Admin | Toko Tampil'));
    assert.ok(login.text.includes('Masuk ke Toko Tampil'));
  });

  it('aktivitas mencatat perubahan tampilan', async () => {
    const { body } = await as('store_owner', '/api/admin/audit');
    const actions = body.entries.map((entry) => entry.action);
    assert.ok(actions.includes('appearance.update'));
    assert.ok(actions.includes('appearance.image'));
  });
});
