import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, SESSION_COOKIE_NAME, JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { getEnv } from "@/lib/env";

/**
 * Server-side auth gate.
 *
 * - Public pages: /, /onboard, /terms, /privacy, /invite (anything else
 *   renders naturally — e.g. the branded 404 for unknown paths).
 * - Authed pages: /chat, /baseline, /upgrade, /account, /settings.
 * - API: locked by default — only /api/auth*, /api/invites/info, and the
 *   signature-verified Stripe webhook are public. Everything under /api/*
 *   requires a valid JWT.
 *
 * This ensures the /chat UI and /api/chat, /api/threads, /api/baseline
 * endpoints can never be accessed without authentication. /api/invites/info
 * stays public so the /invite accept page can render status for people who
 * aren't signed in yet.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const noStore = (res: NextResponse) => {
    // User data must never be cached by the edge/CDN.
    if (pathname.startsWith("/api/")) {
      res.headers.set("Cache-Control", "no-store");
    }
    return res;
  };

  // ── Canonical domain: fold the legacy app.defrag.app identity into
  //    sovereign.defrag.app so every page/API has one canonical URL. ────
  const host = request.headers.get("host")?.replace(/:\d+$/, "").toLowerCase();
  if (host && host !== "localhost" && host !== "127.0.0.1" && host !== "sovereign.defrag.app") {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://sovereign.defrag.app");
    return NextResponse.redirect(url, 308);
  }

  // ── Public pages + Next.js metadata routes (icons, og images) ────
  const publicPages = ["/", "/onboard", "/terms", "/privacy"];
  if (
    publicPages.includes(pathname) ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image")
  ) {
    return noStore(NextResponse.next());
  }

  // ── Public API: auth endpoints, invite status, Stripe webhook ──────
  if (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/invites/info" ||
    pathname === "/api/support" ||
    pathname === "/api/webhooks/stripe"
  ) {
    return noStore(NextResponse.next());
  }

  // ── Auth check ────────────────────────────────────────────────────
  // API: locked by default (anything not exempted above).
  // Pages: only the app pages require auth — unknown paths fall through
  // so Next.js can render the branded 404.
  const isApi = pathname.startsWith("/api/");
  const PROTECTED_PAGES = ["/chat", "/baseline", "/upgrade", "/account", "/settings"];
  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!isApi && !isProtectedPage) {
    return NextResponse.next();
  }

  const env = await getEnv();
  const secret = env[JWT_SECRET_ENV_KEY];
  if (!secret) {
    // If JWT_SECRET isn't configured, fail closed
    if (isApi) {
      return noStore(NextResponse.json({ error: "Server configuration error" }, { status: 500 }));
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (isApi) {
      return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  const payload = await verifyJWT(token, secret);
  if (!payload) {
    if (isApi) {
      return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  return noStore(NextResponse.next());
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
