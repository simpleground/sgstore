/** Public base URL of the shop, e.g. https://simpleground.online (no trailing slash). */
export function siteUrl() {
  return (process.env.SITE_URL || 'https://simpleground.online').replace(/\/+$/, '');
}

/** Cookies are marked `Secure` only when the site is served over HTTPS. */
export function secureCookies() {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production' && siteUrl().startsWith('https://');
}

export const DEFAULT_GOOGLE_CLIENT_ID =
  '288475161498-4t2ksn25uhbgc2vm1f1h9bvsuln5feu0.apps.googleusercontent.com';

export function googleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
}
