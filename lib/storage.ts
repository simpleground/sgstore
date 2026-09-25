/**
 * Product image storage.
 *
 * STORAGE_DRIVER=local (default) → files are saved on disk in STORAGE_LOCAL_DIR
 *                                   (default ./storage). Best for VPS & local dev.
 * STORAGE_DRIVER=s3               → any S3 compatible bucket: Cloudflare R2,
 *                                   AWS S3, MinIO, IDCloudHost, Biznet, etc.
 */
import { AwsClient } from 'aws4fetch';

export type StoredObject = {
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType: string;
  etag: string;
  size?: number;
};

export type PutOptions = {
  contentType?: string;
  /** Compatibility with the old Cloudflare R2 call signature. */
  httpMetadata?: { contentType?: string };
};

export interface Storage {
  get(key: string): Promise<StoredObject | null>;
  put(key: string, data: ArrayBuffer | Uint8Array, options?: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

export function contentTypeFor(key: string) {
  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/** Reject keys that could escape the storage folder (../, absolute paths…). */
export function safeKey(key: string) {
  const clean = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    !clean ||
    clean.length > 300 ||
    clean.split('/').some((part) => !part || part === '.' || part === '..') ||
    !/^[\w\-./]+$/.test(clean)
  )
    throw new Error('Nama file tidak valid.');
  return clean;
}

class LocalStorage implements Storage {
  constructor(private readonly root: string) {}

  private async file(key: string) {
    const path = await import('node:path');
    return path.join(path.resolve(this.root), ...safeKey(key).split('/'));
  }

  async get(key: string) {
    const fs = await import('node:fs/promises');
    let file: string;
    try {
      file = await this.file(key);
    } catch {
      return null;
    }
    try {
      const [data, stat] = await Promise.all([fs.readFile(file), fs.stat(file)]);
      return {
        body: new Uint8Array(data),
        contentType: contentTypeFor(key),
        etag: `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`,
        size: stat.size,
      };
    } catch {
      return null;
    }
  }

  async put(key: string, data: ArrayBuffer | Uint8Array) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = await this.file(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data instanceof Uint8Array ? data : new Uint8Array(data));
  }

  async delete(key: string) {
    const fs = await import('node:fs/promises');
    await fs.rm(await this.file(key), { force: true });
  }
}

class S3Storage implements Storage {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey)
      throw new Error(
        'STORAGE_DRIVER=s3 membutuhkan S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, dan S3_SECRET_ACCESS_KEY.',
      );
    this.client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: process.env.S3_REGION || 'auto',
    });
    this.base = `${endpoint.replace(/\/+$/, '')}/${bucket}`;
  }

  private url(key: string) {
    return `${this.base}/${safeKey(key).split('/').map(encodeURIComponent).join('/')}`;
  }

  async get(key: string) {
    let url: string;
    try {
      url = this.url(key);
    } catch {
      return null;
    }
    const response = await this.client.fetch(url);
    if (response.status === 404) return null;
    if (!response.ok || !response.body)
      throw new Error(`Gagal membaca file (${response.status}).`);
    return {
      body: response.body,
      contentType: response.headers.get('content-type') || contentTypeFor(key),
      etag: response.headers.get('etag') || '',
      size: Number(response.headers.get('content-length')) || undefined,
    };
  }

  async put(key: string, data: ArrayBuffer | Uint8Array, options?: PutOptions) {
    const response = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body: (data instanceof Uint8Array ? data : new Uint8Array(data)) as BodyInit,
      headers: {
        'content-type':
          options?.contentType ||
          options?.httpMetadata?.contentType ||
          contentTypeFor(key),
      },
    });
    if (!response.ok) throw new Error(`Gagal mengunggah file (${response.status}).`);
  }

  async delete(key: string) {
    const response = await this.client.fetch(this.url(key), { method: 'DELETE' });
    if (!response.ok && response.status !== 404)
      throw new Error(`Gagal menghapus file (${response.status}).`);
  }
}

const globalForStorage = globalThis as unknown as { __sgStorage?: Storage };

export function getStorage(): Storage {
  if (globalForStorage.__sgStorage) return globalForStorage.__sgStorage;
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  const storage =
    driver === 's3' || driver === 'r2'
      ? new S3Storage()
      : new LocalStorage(process.env.STORAGE_LOCAL_DIR || './storage');
  globalForStorage.__sgStorage = storage;
  return storage;
}
