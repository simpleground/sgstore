import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `pg` uses Node APIs; keep it out of the server bundle.
  serverExternalPackages: ['pg'],
  // Needed only for the optional Cloudflare build: ship pg's Workers socket
  // implementation (harmless on a normal Node.js/VPS deployment).
  outputFileTracingIncludes: { '/*': ['./node_modules/pg-cloudflare/**/*'] },
  poweredByHeader: false,
};

export default nextConfig;
