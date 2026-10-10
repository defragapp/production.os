/**
 * Regression tests for the 2026-10 adversarial security/privacy review.
 *
 * Locks these remediations in place:
 *  F-A (P1): /api/agent-lee was a public, un-metered model proxy — now
 *            owner-only (requireOwner runs before anything is read).
 *  F-B (P2): the middleware matcher's blanket `.*\..*` exemption let a
 *            dotted path (`/api/invites/<id>.x`) skip verifySession, so a
 *            revoked cookie still reached the verifyJWT-only routes.
 *  F-D (P3): the support-notification template interpolated the public form's
 *            name/email/topic/message into the operator's email HTML raw.
 *  F-E (P2): the threads DELETE read the turn count with
 *            `json_array_length(json_extract(...))`, which returns NULL for a
 *            top-level array — every thread-delete Vectorize sweep was a no-op.
 *  F-H (P1): DELETE /api/auth/account is exempt from the middleware gate (all
 *            of `/api/auth/*` is), so its own check is the only one. It used a
 *            bare verifyJWT — which ignores `users.token_version` — so a cookie
 *            revoked by sign-out or a password reset could still delete the
 *            account and cancel Stripe billing. Now it runs verifySession, like
 *            the sibling `/api/auth/accept-terms` and `/api/auth/export`.
 *  F-I (P2): Next served the protected page shells with `Cache-Control: public`
 *            and no `Vary: Cookie`, so a shared cache was free to store an
 *            authenticated response. The middleware now sets `private,
 *            no-store` on `/api/*` and on every protected page.
 *
 * The source-scan style follows invites.test.ts / auth-intent.test.ts: these
 * are the repo's convention for invariants that live in route/middleware
 * entry points rather than importable pure modules.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { sendTemplate } from "./email";

const nodeRequire = createRequire(__filename);

// Drive the matcher through Next's OWN middleware compiler — the exact two
// functions the framework runs on every request — not a reinterpreted
// standalone RegExp. path-to-regexp anchors/wraps the source
// (`(?:/...)?(?:/<src>)(?:\.rsc|...)?[/#?]?$`) differently than
// `new RegExp("^" + src + "$")`, so a hand-compiled regex can drift from what
// actually ships. These are the internals behind
// `unstable_doesMiddlewareMatch`; feeding them the shipped literal is the only
// check that verifies real middleware behavior, not just RegExp behavior.
const { getMiddlewareMatchers } = nodeRequire("next/dist/build/analysis/get-page-static-info.js");
const { getMiddlewareRouteMatcher } = nodeRequire("next/dist/shared/lib/router/utils/middleware-route-matcher.js");

const middlewareSrc = readFileSync(join(__dirname, "../middleware.ts"), "utf8");
const agentLeeSrc = readFileSync(join(__dirname, "../app/api/agent-lee/route.ts"), "utf8");
const threadsSrc = readFileSync(join(__dirname, "../app/api/threads/route.ts"), "utf8");
const accountSrc = readFileSync(join(__dirname, "../app/api/auth/account/route.ts"), "utf8");

/** Build Next's real per-request route-matcher predicate from the shipped
 *  `config.matcher` literal in middleware.ts, decoding the string escapes
 *  exactly as the runtime does — so this can never drift from the deployed
 *  gate, and it exercises Next's semantics rather than plain RegExp's. */
function middlewareMatcherFromSource(): (path: string) => boolean {
  // Grab the one double-quoted matcher pattern (the string carrying the
  // `_next/static` exemption), escapes included, then JSON.parse to decode.
  const m = /"((?:[^"\\]|\\.)*\?!_next\/static(?:[^"\\]|\\.)*)"/.exec(middlewareSrc);
  if (!m) throw new Error("middleware.ts: matcher pattern not found");
  const source = JSON.parse(`"${m[1]}"`);
  const matchers = getMiddlewareMatchers([source], {});
  const routeMatch = getMiddlewareRouteMatcher(matchers);
  return (path: string) => Boolean(routeMatch(path, { headers: new Headers() }, {}));
}

describe("F-B: middleware matcher gates every /api path, dotted or not", () => {
  const matched = middlewareMatcherFromSource();

  it("runs middleware on dotted /api paths (the revoked-cookie bypass)", () => {
    // A dot in a dynamic segment used to skip the whole gate — the routes
    // behind it only verifyJWT, so token_version revocation was bypassable.
    expect(matched("/api/invites/abc.")).toBe(true);
    expect(matched("/api/invites/1.2.3")).toBe(true);
    expect(matched("/api/journeys/x.y")).toBe(true);
  });
  it("still gates the ordinary authed surfaces", () => {
    expect(matched("/api/chat")).toBe(true);
    expect(matched("/api/agent-lee")).toBe(true);
    expect(matched("/chat")).toBe(true);
  });
  it("keeps skipping the file-like assets the exemption exists for", () => {
    expect(matched("/sw.js")).toBe(false);
    expect(matched("/manifest.webmanifest")).toBe(false);
    expect(matched("/robots.txt")).toBe(false);
    expect(matched("/favicon.ico")).toBe(false);
    expect(matched("/_next/static/chunks/app.js")).toBe(false);
  });
});

describe("F-A: /api/agent-lee is owner-only", () => {
  it("denies through requireOwner BEFORE parsing the body or touching the model", () => {
    expect(agentLeeSrc).toContain('import { requireOwner } from "@/lib/owner"');
    const gateIdx = agentLeeSrc.indexOf("requireOwner(request)");
    const bodyIdx = agentLeeSrc.indexOf("request.json()");
    const modelIdx = agentLeeSrc.indexOf("model.generate");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(bodyIdx).toBeGreaterThan(gateIdx);
    expect(modelIdx).toBeGreaterThan(gateIdx);
  });
});

describe("F-D: support-notification escapes operator-facing strings", () => {
  const env = { RESEND_API_KEY: "test-key" } as never;

  it("renders name/topic/message HTML-escaped into the operator email", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await sendTemplate(env, "support-notification", "ops@example.com", {
        name: "Eve <script>alert(1)</script>",
        email: "eve@evil.com",
        topic: 'Billing <a href="https://evil.example">click here</a>',
        message: '<img src=x onerror=alert(1)>\n<b>bold</b>',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // The fetch init's body carries the rendered HTML; assert on it.
      const [, init] = fetchMock.mock.calls[0] as [unknown, { body: string }];
      const body = String(init.body);
      expect(body).not.toContain("<script>alert(1)</script>");
      expect(body).toContain("&lt;script&gt;");
      expect(body).not.toContain("<img src=x onerror=alert(1)>");
      expect(body).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(body).not.toContain('<a href="https://evil.example">click here</a>');
      expect(body).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("F-E: thread-delete Vectorize sweep reads a real turn count", () => {
  it("counts messages with json_array_length(message_history), not the NULL-returning wrapper", () => {
    // Assert on the prepared statement itself, not free prose (the fix's
    // explanatory comment still quotes the old broken SQL on purpose).
    expect(threadsSrc).toContain(
      'prepare("SELECT json_array_length(message_history) AS n FROM threads WHERE id = ? AND user_id = ?")',
    );
    expect(threadsSrc).not.toContain(
      'prepare("SELECT json_array_length(json_extract(message_history))',
    );
  });
});

describe("F-H: account deletion honours the session revocation generation", () => {
  it("runs the full session check (verifySession), not a bare JWT", () => {
    // The whole of `/api/auth/*` is exempt from the middleware gate so sign-in
    // can be public — which makes this route's own check the only one. A bare
    // verifyJWT only proves the signature and expiry; it never reads
    // `users.token_version`, so a cookie revoked by sign-out or a password
    // reset would still authorise a destructive delete + billing cancellation.
    expect(accountSrc).toContain('from "@/lib/session"');
    expect(accountSrc).toMatch(/verifySession\(env, request\)/);
    expect(accountSrc).not.toContain("verifyJWT");
  });
});

describe("F-I: session-scoped responses can never be stored by a shared cache", () => {
  it("sets private, no-store on /api/* AND on the protected pages", () => {
    // Next serves the protected page shells with `Cache-Control: public,
    // max-age=0, must-revalidate` and no `Vary: Cookie`, so a shared cache is
    // free to store an authenticated response. The middleware is the one place
    // every response passes through, so the override belongs there.
    expect(middlewareSrc).toContain('"private, no-store"');
    expect(middlewareSrc).toMatch(
      /pathname\.startsWith\("\/api\/"\)\s*\|\|\s*isProtectedPagePath\(pathname\)/,
    );
    expect(middlewareSrc).toContain("const PROTECTED_PAGES = [");
  });
});
