// Integration tests against a real PostgreSQL + a running Next.js dev server.
//
// Usage:  TEST_DATABASE_URL=postgres://user:pass@localhost:5432/db npm run test:integration
//
// Safe for an existing database: every run creates its own temporary schema
// (sg_it_<random>), applies db/migrations there, and drops only that schema at
// the end. Existing tables in the database are never read or changed.
// Biteship is replaced by a local mock server; no external payment or shipping
// API is called.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const root = join(import.meta.dirname, '..');
const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) {
  console.error(
    '✖ TEST_DATABASE_URL belum diatur.\n' +
      '  Contoh: TEST_DATABASE_URL=postgres://sgstore:sgstore@localhost:5432/sgstore npm run test:integration\n' +
      '  (tes memakai schema sementara sendiri dan menghapusnya lagi; tabel yang ada tidak disentuh)',
  );
  process.exit(1);
}

const schema = `sg_it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const databaseUrl = withSearchPath(baseUrl, schema);
const admin = new pg.Client({ connectionString: baseUrl });
const children = [];
let biteship;
let storageDir;
let logFile;

function withSearchPath(url, searchPath) {
  const parsed = new URL(url);
  parsed.searchParams.set('options', `-c search_path=${searchPath}`);
  return parsed.toString();
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function run(command, args, env, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      ...options,
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

/**
 * Mock of POST /v1/rates/couriers: one "reg" service per requested courier.
 * The service name echoes the origin postal code and API key it received, so
 * tests can check which store configuration was used.
 */
function startBiteshipMock() {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        const parsed = JSON.parse(body || '{}');
        const apiKey = String(request.headers.authorization || '').replace(/^Bearer /, '');
        const couriers = String(parsed.couriers || '')
          .split(',')
          .filter(Boolean);
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            pricing: couriers.map((code, index) => ({
              courier_code: code,
              courier_name: code.toUpperCase(),
              courier_service_code: 'reg',
              courier_service_name: `Reguler origin=${parsed.origin_postal_code} key=${apiKey}`,
              price: 10000 + index * 1000,
              shipment_duration_range: '2 - 3',
              shipment_duration_unit: 'days',
            })),
          }),
        );
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error('Server Next.js berhenti sebelum siap.');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Server Next.js tidak siap dalam 4 menit.');
}

async function cleanup() {
  for (const child of children)
    if (child.exitCode === null) child.kill('SIGTERM');
  biteship?.close();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } catch (error) {
    console.error(`! Schema ${schema} gagal dihapus:`, error.message);
  }
  await admin.end().catch(() => {});
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
}

let exitCode = 1;
try {
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  console.log(`→ schema sementara: ${schema}`);

  const baseEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NEXT_TELEMETRY_DISABLED: '1',
  };
  if ((await run(process.execPath, ['scripts/migrate.mjs'], baseEnv)) !== 0)
    throw new Error('Migrasi gagal.');

  biteship = await startBiteshipMock();
  storageDir = await mkdtemp(join(tmpdir(), 'sg-it-storage-'));
  logFile = join(storageDir, 'next.log');
  const port = await freePort();
  const appUrl = `http://127.0.0.1:${port}`;
  const serverEnv = {
    ...baseEnv,
    NODE_ENV: 'development',
    SITE_URL: appUrl,
    ADMIN_EMAIL: 'admin@integration.test',
    ADMIN_PASSWORD: 'integration-password-123',
    ADMIN_NAME: 'Integration Admin',
    ADMIN_EMAILS: '',
    DEFAULT_STORE_SLUG: '',
    // Stores are reachable as <slug>.platform.test (tests send that Host header).
    PLATFORM_ROOT_DOMAIN: 'platform.test',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: join(storageDir, 'files'),
    BITESHIP_API_KEY: 'integration-test',
    BITESHIP_API_URL: `http://127.0.0.1:${biteship.address().port}`,
    BITESHIP_MODE: '',
    APP_ENCRYPTION_KEY: 'integration-test-encryption-key-0123456789abcdef',
    MIDTRANS_SERVER_KEY: 'integration-server-key',
    MIDTRANS_CLIENT_KEY: 'integration-client-key',
    MIDTRANS_IS_PRODUCTION: 'false',
  };

  console.log(
    `→ menyalakan next dev di ${appUrl} (kompilasi pertama bisa 1–2 menit)…`,
  );
  const log = createWriteStream(logFile);
  const server = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'dev',
      '--webpack',
      '-p',
      String(port),
      '-H',
      '127.0.0.1',
    ],
    { cwd: root, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  children.push(server);
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  await waitForServer(`${appUrl}/api/health`, server);

  const testDir = join(root, 'tests', 'integration');
  const files = (await readdir(testDir))
    .filter((file) => file.endsWith('.test.mjs'))
    .sort();
  exitCode = await run(
    process.execPath,
    [
      '--import',
      './tests/support/register.mjs',
      '--test',
      '--test-concurrency=1',
      ...files.map((file) => join('tests', 'integration', file)),
    ],
    {
      ...serverEnv,
      TEST_APP_URL: appUrl,
      TEST_DATABASE_URL: baseUrl,
      TEST_SCHEMA: schema,
    },
  );
} catch (error) {
  console.error('✖', error.message);
} finally {
  if (exitCode !== 0 && logFile) {
    const log = await readFile(logFile, 'utf8').catch(() => '');
    if (log)
      console.error(
        `\n--- log server Next.js (akhir) ---\n${log.slice(-6000)}`,
      );
  }
  await cleanup();
  process.exit(exitCode);
}
