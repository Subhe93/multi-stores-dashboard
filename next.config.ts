import path from 'node:path';
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// @multi-stores/core is a file: dependency linked from the sibling repo
// multi-stores-shared/packages/core (M5.3). Turbopack only reads files inside
// its root, so the root (and the output tracing root, which must match) is
// the parent folder that holds all four repos, here and on the server.
const workspaceRoot = path.join(__dirname, '..');

// Baseline security headers (see multi-stores-api/docs/OPERATIONS.md,
// "Security headers"). The dashboard frames the storefront's builder preview
// and sandboxed mail previews; nothing frames the dashboard itself, so
// X-Frame-Options: DENY is safe. CSP is intentionally not set yet.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
