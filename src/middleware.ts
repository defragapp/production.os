import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";

/**
 * Server-side auth gate.
 *
 * - Public pages: /, /onboard, /terms, /privacy (anything else renders
 *   naturally — e.g. the branded 404 for unknown paths).
 * - Authed pages: /chat, /baseline, /upgrade, /account.
 * - API: locked by default — only /api/auth* and the signature-verified
 *   Stripe webhook are public. Everything under /api/* requires a valid JWT.
 *
 * This ensures the /chat UI and /api/chat, /api/threads, /api/baseline
 * endpoints can never be accessed without authentication.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Public pages + Next.js metadata routes (icons, og images) ────
  const publicPages = ["/", "/onboard", "/terms", "/privacy"];
  if (
    publicPages.includes(pathname) ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image")
  ) {
    return NextResponse.next();
  }

  // ── Public API: auth endpoints + Stripe webhook ──────────────────
  if (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/webhooks/stripe"
  ) {
    return NextResponse.next();
  }

  // ── Everything else requires a valid session ─────────────────────
  const isApi = pathname.startsWith("/api/");

  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) {
    // If JWT_SECRET isn't configured, fail closed
    if (isApi) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  const payload = await verifyJWT(token, secret);
  if (!payload) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static, _next/image (static assets)
     * - favicon.ico, robots.txt
     * - .open-next assets
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\..*).*)",
  ],
};
