export interface AppEnv {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  AI: Ai;
  ASSETS: Fetcher;
  AI_GATEWAY_ID: string;
  FROM_EMAIL: string;
  BASELINE_HORIZONS_URL: string;
  STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY: string;
  STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL: string;
  STRIPE_SUCCESS_URL: string;
  STRIPE_CANCEL_URL: string;
  JWT_SECRET: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

import { getCloudflareContext } from "@opennextjs/cloudflare";

let _cachedEnv: AppEnv | null = null;
let _envPromise: Promise<AppEnv> | null = null;

/**
 * Returns the Cloudflare environment bindings.
 * Use async mode so this is safe to call during static prerendering
 * (e.g. landing page) as well as in server components and API routes.
 * The first call initializes the context; subsequent calls hit the cache.
 */
export async function getEnv(): Promise<AppEnv> {
  if (_cachedEnv) return _cachedEnv;
  if (_envPromise) return _envPromise;

  _envPromise = getCloudflareContext({ async: true }).then(
    (ctx) => ((_cachedEnv = ctx.env as unknown as AppEnv) as unknown as AppEnv)
  );

  return _envPromise;
}

/**
 * Synchronous wrapper for callers that need a T|Promise<T> return.
 * Still uses async context internally — callers must await the result.
 */
export function getEnvSync(): AppEnv {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  getEnv(); // kick off async init if not already running
  throw new Error("getEnvSync is not supported — use await getEnv() instead");
}
