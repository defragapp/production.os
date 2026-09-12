"use client";

import Script from "next/script";

/**
 * Cloudflare Web Analytics beacon.
 * Renders only when NEXT_PUBLIC_CF_BEACON_TOKEN is set (wrangler.jsonc vars),
 * so it's a no-op until a token is provisioned from the dashboard:
 * Cloudflare Dashboard → Web Analytics → add site sovereign.defrag.app → copy token.
 */
export function WebAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;
  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
      strategy="afterInteractive"
    />
  );
}
