export interface AppEnv {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  AI: Ai;
  ASSETS: Fetcher;
  /**
   * Cloudflare Vectorize index (`chat-embeddings`, dim=1024, cosine) holding
   * per-turn embeddings for server-memory chat history. Powers
   * /api/chat/search — the 'big brain' semantic recall layer described in
   * docs/ai-system.md. Null when the binding is missing (e.g. local dev
   * without an index provisioned) so the app still boots; the embed path
   * becomes a no-op and search returns an empty list.
   */
  VECTORIZE?: VectorizeIndex;
  AI_GATEWAY_ID: string;
  FROM_EMAIL: string;
  BASELINE_HORIZONS_URL: string;
  STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY: string;
  STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL: string;
  STRIPE_SUCCESS_URL: string;
  STRIPE_CANCEL_URL: string;
  STRIPE_PORTAL_RETURN_URL: string;
  /**
   * Stripe publishable key for Stripe.js (client-side Payment Element).
   * Optional: when missing, the UI will fall back to Stripe-hosted Checkout.
   */
  STRIPE_PUBLISHABLE_KEY?: string;
  JWT_SECRET: string;
  /**
   * Server-side secret layered over PBKDF2 when hashing passwords (see
   * lib/auth.ts). A leaked D1 is useless without this value. Must be a long
   * random secret set via `wrangler secret put PASSWORD_PEPPER` and NEVER
   * rotated once peppered hashes exist (rotation would break existing logins).
   */
  PASSWORD_PEPPER?: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  /** Operator inbox for the /support form (falls back to FROM_EMAIL). */
  SUPPORT_INBOX?: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  /**
   * Set to "true" to make Turnstile a hard gate on signup (a missing token is
   * rejected). Leave unset for the default best-effort posture, where a client
   * that can't load the widget still gets through. See lib/turnstile.ts.
   */
  TURNSTILE_REQUIRED?: string;
  /**
   * Optional cosine-similarity floor for auto-recall, overriding the hardcoded
   * default in chat-recall.ts so sensitivity can be tuned from prod logs
   * without a code change. Unset → the module default (0.82) applies. Values
   * outside 0..1 or non-numeric are ignored and fall back to the default.
   *
   * Typed as number for the module contract, but the Workers runtime delivers
   * plain-text [vars] as a STRING (see wrangler.jsonc, "0.82"); chat-recall's
   * resolveScoreFloor coerces it, so do not assume native-number methods here.
   */
  RECALL_MIN_SCORE?: number;
  /**
   * Angular orb (in degrees) within which a transiting Saturn/Jupiter crossing a
   * natal Sun/Moon counts as an exact conjunction for the transit-nudge engine
   * (transit-signals.ts). Default 1.5 when unset; out-of-range/non-numeric are
   * ignored and fall back to the default. Same string-delivery caveat as
   * RECALL_MIN_SCORE: the runtime passes plain-text [vars] as a STRING ("1.5"),
   * coerced by resolveConjunctionOrb — do not call native-number methods here.
   */
  TRANSIT_CONJUNCTION_ORB?: number;
}

import { getCloudflareContext } from "@opennextjs/cloudflare";

let _cachedEnv: AppEnv | null = null;
let _envPromise: Promise<AppEnv> | null = null;
let _cachedCtx: ExecutionContext | null = null;

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
    (ctx) => {
      _cachedCtx = ctx.ctx;
      return (_cachedEnv = ctx.env as unknown as AppEnv) as unknown as AppEnv;
    }
  );

  return _envPromise;
}

/**
 * Schedule background work past the response boundary. This is the only
 * supported way to keep per-turn chat embeddings (Workers AI + Vectorize
 * upsert) off the critical TTFB path from within a Next.js route handler:
 * `getCloudflareContext` exposes the underlying Worker `ExecutionContext`,
 * and `waitUntil` tells the runtime to keep the isolate alive until the
 * promise settles even after the Response has been returned.
 *
 * Falls back to a swallowed promise when no context is available (e.g. unit
 * tests running outside the OpenNext wrapper) so callers never need to
 * null-check to be safe.
 */
export function waitUntil(promise: Promise<unknown>): void {
  if (_cachedCtx) {
    _cachedCtx.waitUntil(promise.catch((err) => console.error("[waitUntil]", err)));
    return;
  }
  // No context yet — kick getEnv() so the next call has one, and let the
  // current promise settle in the background (best-effort, may be cancelled
  // if the isolate is torn down before it resolves).
  void getEnv().then(() => {
    _cachedCtx?.waitUntil(promise.catch((err) => console.error("[waitUntil]", err)));
  });
}

/**
 * Synchronous wrapper for callers that need a T|Promise<T> return.
 * Still uses async context internally — callers must await the result.
 */
export function getEnvSync(): AppEnv {
  void getEnv(); // kick off async init if not already running
  throw new Error("getEnvSync is not supported — use await getEnv() instead");
}
