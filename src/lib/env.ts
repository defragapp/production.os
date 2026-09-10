/**
 * App environment type — self-contained so routes don't depend on
 * wrangler-generated global types (which vary by tooling version).
 */
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
}

import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getEnv(): AppEnv {
  return getCloudflareContext().env as unknown as AppEnv;
}
