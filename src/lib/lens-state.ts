import { cookies } from "next/headers";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";

/**
 * Server-side resolution of the visitor's product state for the lens pages
 * (/self, /people, /systems). The marketing surfaces used to hard-code CTAs
 * that contradicted reality for a signed-in user who already has a Baseline
 * ("Build your Baseline" — the thing you just built). Resolving on the server
 * means the first HTML paint already carries the correct string: no
 * useEffect swap, no hydration flicker, no layout shift.
 *
 * Best-effort by design: these are public pages, so any failure (no cookie,
 * stale JWT, missing secret) degrades to the anonymous state rather than
 * redirecting. Never throws.
 */
export type LensState = { isAuthed: boolean; hasBaseline: boolean };

const ANON: LensState = { isAuthed: false, hasBaseline: false };

export async function resolveLensState(): Promise<LensState> {
  try {
    const env = await getEnv();
    const secret = env[JWT_SECRET_ENV_KEY];
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!secret || !token) return ANON;
    const payload = await verifyJWT(token, secret);
    if (!payload) return ANON;
    const baseline = await env.DB.prepare("SELECT user_id FROM baselines WHERE user_id = ?")
      .bind(payload.sub)
      .first();
    return { isAuthed: true, hasBaseline: !!baseline };
  } catch {
    return ANON;
  }
}
