import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Embedded-checkout contract (the on-site payment step that replaces the
 * user-facing redirect to hosted Checkout).
 *
 * The route behaviour is pinned by its own Vitest suite now that the vitest
 * config mirrors the tsconfig `@/` alias; what a behaviour harness cannot
 * cover is the *wiring* between Stripe.js and the server's authority, so this
 * follows the repo's established source-shape pattern
 * (`chat-stream-contract.test.ts`, `advisory-hardening.test.ts`) to lock the
 * three invariants that make the flow safe:
 *
 *   1. card data never touches our origin — the form is Stripe's Payment
 *      Element, confirmed with `redirect: "if_required"` so 3-D Secure is
 *      handled from the returned status, not a blind success;
 *   2. no browser-visible surface can name a price, tier, or customer — the
 *      request body is only the interval, and the server resolves everything
 *      else from its own config;
 *   3. nothing in the init path writes an entitlement — activation stays the
 *      webhook's exclusive job, and the client polls /api/auth (server truth)
 *      instead of declaring itself upgraded.
 */

const page = readFileSync("src/app/upgrade/page.tsx", "utf8");
const initRoute = readFileSync("src/app/api/subscribe/init/route.ts", "utf8");
const webhook = readFileSync("src/app/api/webhooks/stripe/route.ts", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");

describe("edge gating matches each endpoint's sensitivity", () => {
  it("the publishable-config probe is public (browser-safe) but the subscribe init is not", () => {
    // /api/stripe/config returns only pk_ values, so signed-out /upgrade can
    // still decide embedded-vs-hosted; the money init keeps the middleware's
    // default-lock on /api/* and does its own JWT verification.
    expect(middleware).toContain('pathname === "/api/stripe/config"');
    // The public-allowlist block is the region between the "Public API"
    // marker and its closing `return noStore(...)`; subscribe must appear
    // nowhere in it.
    const allowlist = middleware.slice(
      middleware.indexOf("Public API"),
      middleware.indexOf("// ── Auth check"),
    );
    expect(allowlist).not.toContain("/api/subscribe");
  });
});

describe("payment step uses Stripe Elements, not our own inputs", () => {
  it("confirms through the Payment Element with if_required redirects", () => {
    expect(page).toContain("<PaymentElement");
    expect(page).toContain('redirect: "if_required"');
    expect(page).toContain("stripe.confirmPayment(");
  });

  it("renders no hand-rolled card, expiry, or CVC field", () => {
    // Payment credentials may only exist inside Stripe's iframes. Asserted on
    // JSX element form, not the word: the explanatory comments legitimately
    // name the fields they forbid.
    expect(page).not.toMatch(/<input[^>]*(card|cvc|expiry)/i);
  });

  it("handles the 3-D Secure requires_action status instead of assuming success", () => {
    expect(page).toContain("requires_action");
    expect(page).toContain("next_action");
  });
});

describe("the server decides every money fact", () => {
  it("the client sends only the interval — no price, customer, or tier in the body", () => {
    const bodyLine = page.match(/body: JSON\.stringify\(\{[^}]*\}\)/g)
      ?.find((m) => m.includes("interval"));
    expect(bodyLine).toBeTruthy();
    expect(bodyLine).not.toMatch(/price|customer|tier/i);
  });

  it("init resolves the price from the allowlisted env config only", () => {
    expect(initRoute).toContain("configuredPrice(env, interval)");
    // interval is allowlisted before any Stripe call.
    const allowlistIdx = initRoute.indexOf('body.interval === "annual"');
    const createIdx = initRoute.indexOf("createSubscriptionWithClientSecret(");
    expect(allowlistIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(allowlistIdx);
  });

  it("init carries idempotency keys on both Stripe mutations and never trusts a client-supplied customer", () => {
    expect(initRoute).toContain("createStripeCustomer(env, payload.sub, payload.email, `cust_${payload.sub}`)");
    expect(initRoute).toContain("`subscribe_${payload.sub}_${interval}`");
    expect(initRoute).toContain("stripe_customer_id, subscription_tier FROM users WHERE id = ?");
    expect(initRoute).not.toMatch(/body\.(customerId|customer_id|price)/);
  });

  it("retries reuse the in-flight subscription instead of stacking a second one", () => {
    expect(initRoute).toContain("subscribe-inflight:");
    expect(initRoute).toContain("getSubscription(env, inflight)");
  });
});

describe("entitlement stays server-side and webhook-authoritative", () => {
  it("the init path never writes subscription_tier", () => {
    expect(initRoute).not.toContain("SET subscription_tier");
  });

  it("the client's success claim is a poll of /api/auth, not the browser's own verdict", () => {
    // The post-confirmation path must resolve through the bounded poll of
    // /api/auth (server truth) — never a client-side "tier = sovereign+".
    // Asserted inside the pollEntitlement block itself (source order between
    // the sibling callbacks proves nothing about when they run).
    const pollDefIdx = page.indexOf("const pollEntitlement");
    const callIdx = page.indexOf("await pollEntitlement()", pollDefIdx);
    expect(pollDefIdx).toBeGreaterThan(-1);
    const pollBlock = pollDefIdx <= callIdx ? page.slice(pollDefIdx, callIdx) : "";
    expect(pollBlock).toContain("fetch(\"/api/auth\")");
    expect(pollBlock).toContain('"/chat?billing=success"');
    expect(pollBlock).toContain("sovereign+");
  });

  it("the webhook still verifies signatures before touching the database", () => {
    const verifyIdx = webhook.indexOf("verifyStripeSignature(");
    const firstWriteIdx = webhook.indexOf("UPDATE users");
    expect(verifyIdx).toBeGreaterThan(-1);
    expect(verifyIdx).toBeLessThan(firstWriteIdx);
  });

  it("subscription webhooks self-heal the customer↔account link the embedded flow relies on", () => {
    // No checkout.session.completed fires in this flow, so the sub event
    // handler must be the one to persist stripe_customer_id from metadata.
    expect(webhook).toContain("UPDATE users SET stripe_customer_id = ? WHERE id = ?");
  });
});
