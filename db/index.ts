/**
 * Database access (PostgreSQL).
 *
 * The app was originally written against Cloudflare D1, so every route uses the
 * D1 style API:  getD1().prepare(sql).bind(...values).first() / .all() / .run()
 * and getD1().batch([...statements]).
 *
 * This file keeps that exact API but runs it on PostgreSQL through `pg`, so the
 * rest of the code did not need to be rewritten. `?` placeholders are converted
 * to PostgreSQL's `$1, $2, ...` automatically.
 */
import { Pool, types, type PoolClient, type PoolConfig } from 'pg';
import { getStorage, type Storage } from '@/lib/storage';

// COUNT(*) and SUM() come back from PostgreSQL as strings (int8 / numeric).
// Return them as JavaScript numbers like D1 did.
types.setTypeParser(20, (value) => Number.parseInt(value, 10)); // int8
types.setTypeParser(1700, (value) => Number.parseFloat(value)); // numeric

type Value = string | number | boolean | null | undefined | Date;
type Queryable = Pick<Pool | PoolClient, 'query'>;

export type RunResult = {
  success: true;
  meta: { changes: number; rows_read: number; rows_written: number };
};
export type AllResult<T> = RunResult & { results: T[] };

/** Convert `?` placeholders to `$n`, ignoring `?` inside quoted strings. */
export function toPgPlaceholders(sql: string) {
  let out = '';
  let index = 0;
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (quote) {
      out += char;
      if (char === quote) {
        if (sql[i + 1] === quote) out += sql[++i];
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
    } else if (char === '?') out += `$${++index}`;
    else out += char;
  }
  return out;
}

function normalize(value: Value) {
  if (value === undefined) return null;
  // Boolean-like columns are INTEGER (0/1) to stay compatible with the old data.
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export class Statement {
  constructor(
    private readonly db: Database,
    readonly sql: string,
    readonly values: Value[] = [],
  ) {}

  bind(...values: Value[]) {
    return new Statement(this.db, this.sql, values);
  }

  async execute(client?: Queryable) {
    return (client ?? this.db.pool()).query(
      toPgPlaceholders(this.sql),
      this.values.map(normalize),
    );
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const result = await this.execute();
    const row = result.rows[0];
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<AllResult<T>> {
    const result = await this.execute();
    return {
      success: true,
      results: result.rows as T[],
      meta: {
        changes: result.rowCount ?? 0,
        rows_read: result.rows.length,
        rows_written: 0,
      },
    };
  }

  async run(): Promise<RunResult> {
    const result = await this.execute();
    return {
      success: true,
      meta: {
        changes: result.rowCount ?? 0,
        rows_read: 0,
        rows_written: result.rowCount ?? 0,
      },
    };
  }
}

export class Database {
  constructor(readonly pool: () => Pool) {}

  prepare(sql: string) {
    return new Statement(this, sql);
  }

  /** Run several statements in one transaction (all succeed or none). */
  async batch(statements: Statement[]) {
    const client = await this.pool().connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const statement of statements) {
        const result = await statement.execute(client);
        results.push({
          success: true as const,
          results: result.rows,
          meta: { changes: result.rowCount ?? 0 },
        });
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /** Raw SQL without parameters (used by scripts / maintenance). */
  async exec(sql: string) {
    await this.pool().query(sql);
  }
}

function poolConfig(): PoolConfig {
  // Cloudflare (optional): prefer a Hyperdrive binding when the app runs there.
  const cloudflare = (globalThis as Record<symbol, { env?: Record<string, { connectionString?: string }> }>)[
    Symbol.for('__cloudflare-context__')
  ];
  const connectionString =
    cloudflare?.env?.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      'DATABASE_URL belum diatur. Salin .env.example menjadi .env lalu isi koneksi PostgreSQL.',
    );
  const ssl = process.env.DATABASE_SSL;
  return {
    connectionString,
    max: Number(process.env.DB_POOL_MAX || 10),
    ssl:
      ssl === 'true' || ssl === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

const isCloudflareWorker =
  typeof navigator !== 'undefined' &&
  navigator.userAgent === 'Cloudflare-Workers';

const globalForDb = globalThis as unknown as { __sgPool?: Pool };

function pool(): Pool {
  if (isCloudflareWorker) {
    // Workers cannot share sockets between requests: keep one pool per request.
    const context = (globalThis as Record<symbol, Record<string, unknown>>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (context) return ((context.__sgPool as Pool) ??= new Pool({ ...poolConfig(), max: 1 }));
    return new Pool({ ...poolConfig(), max: 1 });
  }
  // Reuse one pool per server process (and across hot reloads in `next dev`).
  return (globalForDb.__sgPool ??= new Pool(poolConfig()));
}

const database = new Database(pool);

/** Kept under the old name so existing routes work unchanged. */
export function getD1() {
  return database;
}

export function getDb() {
  return database;
}

/** File storage for product images (local disk, S3 or Cloudflare R2). */
export function getFiles(): Storage {
  return getStorage();
}
