/**
 * Enkripsi kunci rahasia toko (server key Midtrans, API key Biteship).
 *
 * AES-256-GCM lewat Web Crypto (jalan di Node dan Cloudflare). Kunci enkripsi
 * diturunkan (SHA-256) dari APP_ENCRYPTION_KEY. Setiap nilai diikat ke
 * "<storeId>:<nama>" sebagai additional data, sehingga ciphertext yang disalin
 * ke toko atau nama lain tidak bisa dibuka.
 *
 * Format tersimpan: v1:<iv base64>:<ciphertext+tag base64>
 */
const VERSION = 'v1';

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      'APP_ENCRYPTION_KEY belum diatur di .env (minimal 32 karakter acak). Kunci rahasia tidak dapat disimpan.',
    );
  }
}

export function encryptionConfigured() {
  return (process.env.APP_ENCRYPTION_KEY?.length ?? 0) >= 32;
}

async function key() {
  if (!encryptionConfigured()) throw new MissingEncryptionKeyError();
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(process.env.APP_ENCRYPTION_KEY),
  );
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

const context = (storeId: string, name: string) =>
  new TextEncoder().encode(`${storeId}:${name}`);

export async function encryptSecret(
  storeId: string,
  name: string,
  value: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: context(storeId, name) },
    await key(),
    new TextEncoder().encode(value),
  );
  return `${VERSION}:${toB64(iv)}:${toB64(new Uint8Array(encrypted))}`;
}

/** The plain value, or null when it cannot be decrypted (wrong key, tampered, moved). */
export async function decryptSecret(
  storeId: string,
  name: string,
  stored: string,
) {
  const [version, iv, data] = stored.split(':');
  if (version !== VERSION || !iv || !data) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromB64(iv),
        additionalData: context(storeId, name),
      },
      await key(),
      fromB64(data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
