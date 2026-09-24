/**
 * Cloudflare Turnstile verification helper (best-effort).
 *
 * Turnstile is defense-in-depth, not a hard gate:
 *  - Not configured (missing site key or secret) → skip entirely (returns true).
 *  - Configured but no token submitted → allowed by default. The widget can
 *    legitimately fail to load on the client (content blockers, Safari/iOS ITP
 *    third-party-cookie blocking, strict corporate networks); hard-blocking
 *    there dead-ends real signups, so we fall back on the login rate limiter
 *    and email verification instead. Set the TURNSTILE_REQUIRED="true" env var
 *    to restore strict enforcement (a missing token is then rejected).
 *  - A token IS submitted → it must pass siteverify, so forged/garbage tokens
 *    are always rejected regardless of mode.
 */
import type { AppEnv } from "./env";

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  "error-codes"?: string[];
}

export async function verifyTurnstileToken(env: AppEnv, token?: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  const siteKey = env.TURNSTILE_SITE_KEY;
  // Not configured → the widget never renders, nothing to verify.
  if (!secret || !siteKey) return true;
  // No token: best-effort by default, rejected only under strict mode.
  if (!token) return env.TURNSTILE_REQUIRED !== "true";

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as SiteVerifyResponse;
    if (!data.success) {
      console.error("[turnstile] verification failed:", data["error-codes"]);
      return false;
    }
    if (typeof data.score === "number" && data.score < 0.5) return false;
    return true;
  } catch (err) {
    console.error("[turnstile] siteverify error:", err);
    return false;
  }
}