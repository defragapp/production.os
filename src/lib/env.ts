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
export function getEnv(): AppEnv {
  return getCloudflareContext().env as unknown as AppEnv;
}
