import type { NextConfig } from "next";

// Uploads (a backup file, an Excel import, and the parsed import sent back to
// be applied) are capped at 10 MB by the app itself — see MAX_BACKUP_BYTES
// and MAX_IMPORT_BYTES. These limits sit just above that, leaving room for
// multipart overhead, so the app's own clear error message is what a
// too-large file hits rather than a generic framework rejection. Next's
// defaults (1 MB for server actions) would otherwise refuse most real files.
const UPLOAD_LIMIT = "12mb";

// HSTS tells browsers to only ever use HTTPS for this site. It's only sent
// from a production build that also marks the session cookie Secure, so an
// office server deliberately running over plain HTTP (built with
// SESSION_COOKIE_SECURE=false) is never pinned to HTTPS it doesn't have.
const sendHsts =
  process.env.NODE_ENV === "production" &&
  !["false", "0"].includes(process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase() ?? "");

const securityHeaders = [
  // Nothing may frame the app (clickjacking), and forms and <base> can only
  // point back at it. Scripts and styles are left to Next's defaults, since
  // restricting those needs a per-request nonce.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(sendHsts ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: UPLOAD_LIMIT },
    // proxy.ts runs on every request, including action POSTs, and buffers
    // the body up to this size; past it the body would arrive truncated.
    proxyClientMaxBodySize: UPLOAD_LIMIT,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
