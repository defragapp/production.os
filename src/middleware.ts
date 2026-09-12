import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";

/**
 * Server-side auth gate.
 *
 * - Public routes: /, /onboard, /api/auth (login/signup/logout/reset)
 * - Everything else requires a valid JWT session cookie.
 * - API routes return 401 JSON; page routes redirect to /onboard.
 *
 * This ensures the /chat UI and /api/chat, /api/threads, /api/baseline
 * endpoints can never be accessed without authentication.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Public routes ────────────────────────────────────────────────
  const publicRoutes = ["/", "/onboard", "/terms", "/privacy"];
  const publicApiRoutes = ["/api/auth"];

  // Allow exact public pages
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow /api/auth and /api/auth/reset (login, signup, logout, password reset)
  if (publicApiRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
    return NextResponse.next();
  }

  // ── Social/share images (public, no auth) ──────────────────────
  if (pathname.startsWith("/opengraph-image") || pathname.startsWith("/twitter-image")) {
    return NextResponse.next();
  }

  // ── Stripe webhook: verified via signature, not JWT ─────────────
  if (pathname === "/api/webhooks/stripe") {
    return NextResponse.next();
  }

  // ── Auth check ────────────────────────────────────────────────────
  const env = getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) {
    // If JWT_SECRET isn't configured, fail closed
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  const payload = await verifyJWT(token, secret);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
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
