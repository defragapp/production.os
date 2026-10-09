import { NextRequest, NextResponse } from "next/server";
import { JWT_SECRET_ENV_KEY } from "@/lib/auth";
import { verifySession } from "@/lib/session";
import { getEnv } from "@/lib/env";

/** The one canonical origin every public URL resolves to. */
const CANONICAL_HOST = "sovereign.defrag.app";

/**
 * Hosts that must NOT be folded into the canonical domain:
 * local dev, and Cloudflare preview deployments (`*.workers.dev`), which exist
 * precisely so a build can be exercised before it is the real thing.
 */
function isNonCanonicalAllowed(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".workers.dev");
}

/**
 * Server-side auth gate.
 *
 * - Public pages (explicit set, line ~55): /, /onboard, /terms, /privacy, /redeem.
 *   Other public surfaces — /invite, /about, /faq, … — are NOT in that array;
 *   they render via the fall-through below ("not an API and not a protected page"),
 *   and unknown paths still reach the branded 404. /invite stays public this way so an
 *   accept link works before the recipient has an account.
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
  if (host && host !== CANONICAL_HOST && !isNonCanonicalAllowed(host)) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  // ── Public pages + Next.js metadata routes (icons, og images) ────
  // /redeem is public so a gifted-pass recipient sees the branded invitation
  // before they have an account; the claim itself is gated at POST /api/redeem.
  const publicPages = ["/", "/onboard", "/terms", "/privacy", "/redeem"];
  if (
    publicPages.includes(pathname) ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/opengraph-image")
  ) {
    return noStore(NextResponse.next());
  }

  // ── Public API: auth endpoints, invite status, Stripe webhook ──────
  if (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
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
  if (!env[JWT_SECRET_ENV_KEY]) {
    // Fail closed when the signing secret is absent — a session cannot be
    // verified, so nothing behind the wall may be served.
    if (isApi) {
      return noStore(NextResponse.json({ error: "Server configuration error" }, { status: 500 }));
    }
    return NextResponse.redirect(new URL("/onboard", request.url));
  }

  // Carry the original destination through the sign-in wall so a person sent
  // to /settings from a support reply lands on /settings after signing in.
  const nextIntent = `&next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  // Signature + live session generation. `verifySession` also checks the
  // token's `tv` against users.token_version, so signing out or resetting a
  // password revokes every cookie issued before it — a bare JWT check could not
  // do that. A missing cookie and a revoked/expired one are the same situation
  // for the person: sign in again.
  const session = await verifySession(env, request);
  if (!session) {
    if (isApi) {
      return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    // A stranger who hit the paywall is a prospective member, not a returning
    // one — send them to Create account, not the "Welcome back" Sign in card.
    const isPaywall = pathname === "/upgrade" || pathname.startsWith("/upgrade/");
    const mode = isPaywall ? "signup" : "login";
    return NextResponse.redirect(new URL(`/onboard?mode=${mode}${nextIntent}`, request.url));
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
     * - paths carrying a dot (file-like assets: /sw.js, /manifest.webmanifest,
     *   /sitemap.xml) — EXCEPT anything under `api/`. The blanket `.*\\..*`
     *  exemption was an auth hole: a dotted dynamic segment
     *   (`/api/invites/<id>.x`) skipped middleware entirely, and any route
     *   relying on the matcher for the token_version revocation check would
     *   honour a revoked cookie. Every `/api/*` path must reach the
     *   verifySession gate below, dots or not (route-level `getAuthPayload`
     *   calls `verifySession` too, but the matcher stays the primary gate).
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|(?!api/).*\\..*).*)",
  ],
};
