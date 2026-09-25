import { googleClientId } from '@/lib/site';

export type GoogleIdentity = { sub: string; email: string; name: string };

/** Verify a Google Identity Services credential (ID token). */
export async function verifyGoogleCredential(
  credential: string,
): Promise<GoogleIdentity | null> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );
  if (!response.ok) return null;
  const token = (await response.json()) as Record<string, string>;
  if (
    token.aud !== googleClientId() ||
    !['accounts.google.com', 'https://accounts.google.com'].includes(token.iss) ||
    token.email_verified !== 'true' ||
    Number(token.exp) * 1000 < Date.now() ||
    !token.sub ||
    !token.email
  )
    return null;
  return {
    sub: token.sub,
    email: token.email.toLowerCase(),
    name: token.name || token.email,
  };
}
