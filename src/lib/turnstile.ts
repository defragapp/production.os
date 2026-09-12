/**
 * Cloudflare Turnstile verification helper.
 *
 * Gracefully degrades: if TURNSTILE_SECRET_KEY is not configured, verification
 * is skipped (returns true). When configured, the request must carry a valid
 * token that passes siteverify.
 */
import type { AppEnv } from "./env";

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  "error-codes"?: string[];
}

export async function verifyTurnstileToken(env: AppEnv, token?: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

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