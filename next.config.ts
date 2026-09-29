import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Dev-only: `initOpenNextCloudflareForDev` wires a `getPlatformProxy()` into
// route loaders so `next dev` can read D1/KV/AI bindings. Under `next build`
// the same call makes static-page generation spin up workerd and contend for
// the `.wrangler/state` SQLite lock (SQLITE_BUSY) for routes that need no
// bindings at build time — every public/legal page is a pure render and
// `/support` is `force-dynamic`. Gate it to development so prod builds never
// launch a Worker.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // microphone=(self): first-party dictation (Web Speech API, /chat) must
    // not be blocked by policy; camera and geolocation stay denied everywhere.
    value: "camera=(), microphone=(self), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Dev-only: Fast Refresh's react-refresh runtime uses eval; prod builds don't.
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com https://static.cloudflareinsights.com"
        : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://js.stripe.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://challenges.cloudflare.com https://api.stripe.com https://cloudflareinsights.com",
      "frame-src 'self' https://challenges.cloudflare.com https://checkout.stripe.com https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ship no client source maps: build logic and prompt scaffolding stay out
  // of the browser bundle surface.
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Next.js stamps `s-maxage=31536000` on prerendered HTML, which pins
        // stale pages in device caches (iOS Safari, home-screen PWAs) across
        // deploys. Force revalidation on every document request; hashed
        // static assets under /_next/static keep their immutable caching.
        source: "/((?!api|_next/static|_next/image).*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;