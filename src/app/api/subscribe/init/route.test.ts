import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { POST } from "./route";

/**
 * Behaviour tests for the on-site payment init (/api/subscribe/init).
 *
 * The route is the money entry point of the embedded checkout, so every
 * assertion here protects one of three invariants:
 *   1. the client can only choose between the two allowlisted intervals —
 *      price ids, customer ids, and tiers are never taken from the request;
 *   2. retries and double-clicks reuse the subscription Stripe already
 *      started instead of stacking a second incomplete one;
 *   3. a gateway failure never leaks Stripe's message verbatim and never
 *      writes an entitlement anywhere (activation is the webhook's job).
 */

// ── Fixtures ──────────────────────────────────────────────────────────────

interface EnvState {
  DB: unknown;
  SESSION_KV: { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void>; delete: (k: string) => Promise<void> };
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY: string;
  STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL: string;
  STRIPE_SUCCESS_URL: string;
  STRIPE_CANCEL_URL: string;
  STRIPE_PORTAL_RETURN_URL: string;
  JWT_SECRET: string;
}

const state = {
  kv: new Map<string, string>(),
  customer: null as string | null,
  tier: "free" as string | null,
  rlCount: null as string | null,
};

function resetState() {
  state.kv.clear();
  state.customer = null;
  state.tier = "free";
  state.rlCount = null;
}

const DB = {
  prepare: (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async <T,>() => {
        if (/SELECT stripe_customer_id, subscription_tier/.test(sql)) {
          return { stripe_customer_id: state.customer, subscription_tier: state.tier } as T;
        }
        return null as T;
      },
      run: async () => {
        if (/UPDATE users SET stripe_customer_id/.test(sql)) {
          state.customer = args[0] as string;
        }
        return { success: true };
      },
    }),
  }),
} as unknown as D1Database;

const env: EnvState = {
  DB,
  SESSION_KV: {
    get: async (k: string) => (k.startsWith("rl:subscribe_init:") ? state.rlCount : state.kv.get(k) ?? null),
    put: async (k: string, v: string) => {
      if (k.startsWith("rl:subscribe_init:")) state.rlCount = v;
      else state.kv.set(k, v);
    },
    delete: async (k: string) => { state.kv.delete(k); },
  },
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY: "price_month",
  STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL: "price_year",
  STRIPE_SUCCESS_URL: "https://example.com/chat?billing=success",
  STRIPE_CANCEL_URL: "https://example.com/upgrade?billing=cancelled",
  STRIPE_PORTAL_RETURN_URL: "https://example.com/account",
  JWT_SECRET: "secret",
};

vi.mock("@/lib/env", () => ({ getEnv: vi.fn(async () => env) }));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<{ SESSION_COOKIE_NAME: string }>("@/lib/auth");
  return {
    ...actual,
    verifyJWT: vi.fn(async () => ({ sub: "user_1", email: "t@example.com" })),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(body: unknown, withCookie = true): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (withCookie) headers.set("cookie", `${SESSION_COOKIE_NAME}=token`);
  return new NextRequest("http://localhost/api/subscribe/init", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

type FetchCall = { url: string; method: string; headers: Record<string, string>; body: string };

/**
 * Installs a global fetch stub that speaks Stripe's form-encoded surface.
 * `routes` maps a URL matcher to a [status, json] responder; every call is
 * recorded so tests can assert what we actually sent upstream (price ids,
 * idempotency keys, the API version pin).
 */
function stripeStub(
  routes: Array<[RegExp, (req: { body?: string; headers: Headers }) => [number, unknown]]>,
): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url: unknown, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    const h = new Headers(init?.headers || {});
    h.forEach((v, k) => { headers[k] = v; });
    calls.push({ url: String(url), method: init?.method || "GET", headers, body: init?.body ? String(init.body) : "" });
    for (const [re, respond] of routes) {
      if (re.test(String(url))) {
        const [status, json] = respond({ body: init?.body ? String(init.body) : undefined, headers: h });
        return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
      }
    }
    return new Response("not found", { status: 404 });
  });
  return { calls };
}

const okCustomer: [RegExp, () => [number, unknown]] = [/\/v1\/customers$/, () => [200, { id: "cus_123" }]];

function subResponse(status: string, extra: Record<string, unknown> = {}): [RegExp, () => [number, unknown]] {
  return [/\/v1\/subscriptions$/, () => [200, {
    id: "sub_created_1",
    status,
    latest_invoice: { payment_intent: { client_secret: "pi_secret_abc" } },
    ...extra,
  }]];
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("/api/subscribe/init", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetState();
  });

  it("rejects unauthenticated requests without touching Stripe", async () => {
    const stub = stripeStub([]);
    const res = await POST(makeRequest({ interval: "monthly" }, false));
    expect(res.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  it("rate-limits repeated inits per account", async () => {
    stripeStub([okCustomer, subResponse("incomplete")]);
    state.rlCount = "20";
    const res = await POST(makeRequest({ interval: "monthly" }));
    expect(res.status).toBe(429);
  });

  it("allowlists the interval — a tampered value is a 400, never another price", async () => {
    const stub = stripeStub([]);
    for (const interval of ["weekly", "lifetime", "", undefined, 123, { evil: true }]) {
      const res = await POST(makeRequest({ interval }));
      expect(res.status).toBe(400);
    }
    expect(stub.calls).toHaveLength(0);
  });

  it("refuses to start a second subscription for a sovereign+ account", async () => {
    const stub = stripeStub([]);
    state.tier = "sovereign+";
    const res = await POST(makeRequest({ interval: "monthly" }));
    expect(res.status).toBe(409);
    expect(stub.calls).toHaveLength(0);
  });

  it("creates the subscription with the SERVER-side monthly price and returns only the client secret", async () => {
    const stub = stripeStub([okCustomer, subResponse("incomplete")]);
    const res = await POST(makeRequest({ interval: "monthly" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ subscriptionId: "sub_created_1", status: "incomplete", clientSecret: "pi_secret_abc" });
    // No price id or customer id leaks to the browser response above; the
    // upstream POST must have carried the configured monthly price.
    const subCall = stub.calls.find((c) => c.url.endsWith("/v1/subscriptions"))!;
    expect(subCall.body).toContain("items%5B0%5D%5Bprice%5D=price_month");
    expect(subCall.body).toContain("payment_behavior=default_incomplete");
    expect(subCall.headers["idempotency-key"]).toBe("subscribe_user_1_monthly");
    expect(subCall.headers["stripe-version"]).toBeTruthy();
    // First-timer: the customer is created and persisted (customer reuse).
    expect(stub.calls.some((c) => c.url.endsWith("/v1/customers"))).toBe(true);
    expect(state.customer).toBe("cus_123");
    // The tier-sync stamp is cleared so /api/auth reconciles promptly.
    expect(Array.from(state.kv.keys())).toContain("subscribe-inflight:user_1:monthly");
  });

  it("maps annual to the annual price id", async () => {
    const stub = stripeStub([okCustomer, subResponse("incomplete")]);
    await POST(makeRequest({ interval: "annual" }));
    const subCall = stub.calls.find((c) => c.url.endsWith("/v1/subscriptions"))!;
    expect(subCall.body).toContain("items%5B0%5D%5Bprice%5D=price_year");
    expect(subCall.headers["idempotency-key"]).toBe("subscribe_user_1_annual");
  });

  it("reuses the existing customer instead of creating a second one", async () => {
    const stub = stripeStub([subResponse("incomplete")]);
    state.customer = "cus_existing";
    const res = await POST(makeRequest({ interval: "monthly" }));
    expect(res.status).toBe(200);
    expect(stub.calls.some((c) => c.url.endsWith("/v1/customers"))).toBe(false);
    const subCall = stub.calls.find((c) => c.url.endsWith("/v1/subscriptions"))!;
    expect(subCall.body).toContain("customer=cus_existing");
  });

  it("re-reads an in-flight incomplete subscription instead of POSTing a duplicate", async () => {
    const stub = stripeStub([
      [/\/v1\/subscriptions\/sub_stamped$/, () => [200, {
        id: "sub_stamped",
        status: "incomplete",
        latest_invoice: { payment_intent: { client_secret: "pi_secret_stamped" } },
      }]],
    ]);
    state.kv.set("subscribe-inflight:user_1:monthly", "sub_stamped");
    state.customer = "cus_existing";
    const res = await POST(makeRequest({ interval: "monthly" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ subscriptionId: "sub_stamped", status: "incomplete", clientSecret: "pi_secret_stamped" });
    // Exactly one call, and it was a GET — no second subscription was created.
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].method).toBe("GET");
  });

  it("answers an already-active subscription with 409 and no client secret", async () => {
    const stub = stripeStub([
      [/\/v1\/subscriptions\/sub_live$/, () => [200, { id: "sub_live", status: "active" }]],
    ]);
    state.kv.set("subscribe-inflight:user_1:monthly", "sub_live");
    state.customer = "cus_existing";
    const res = await POST(makeRequest({ interval: "monthly" }));
    const data = await res.json() as { clientSecret?: string | null; status?: string; subscriptionId?: string; error?: string };
    expect(res.status).toBe(409);
    expect(data.clientSecret).toBeNull();
    expect(stub.calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("surfaces requires_action as a recoverable null-secret state, not a fake success", async () => {
    stripeStub([okCustomer, [/\/v1\/subscriptions$/, () => [200, {
      id: "sub_3ds",
      status: "requires_action",
      latest_invoice: { payment_intent: { client_secret: null } },
    }]]]);
    const res = await POST(makeRequest({ interval: "monthly" }));
    const data = await res.json() as { clientSecret?: string | null; status?: string; subscriptionId?: string; error?: string };
    expect(res.status).toBe(200);
    expect(data).toEqual({ subscriptionId: "sub_3ds", status: "requires_action", clientSecret: null });
  });

  it("maps Stripe API errors to a generic 502 and never leaks the upstream message", async () => {
    stripeStub([okCustomer, [/\/v1\/subscriptions$/, () => [402, { error: { message: "card_declined: insufficient_funds on cus_123" } }]]]);
    const res = await POST(makeRequest({ interval: "monthly" }));
    const data = await res.json() as { error?: string };
    expect(res.status).toBe(502);
    expect(data.error).toBe("Couldn't start payment — try again in a moment.");
  });

  it("treats Stripe's duplicate-subscription rejection as 409, not a gateway error", async () => {
    stripeStub([okCustomer, [/\/v1\/subscriptions$/, () => [400, {
      error: { message: "customer already has a subscription for price_month in the customer's currency: active subscription exists" },
    }]]]);
    const res = await POST(makeRequest({ interval: "monthly" }));
    expect(res.status).toBe(409);
  });

  it("maps a network failure to the same generic 502", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw new TypeError("network down"); });
    const res = await POST(makeRequest({ interval: "monthly" }));
    expect(res.status).toBe(502);
    const data = await res.json() as { error?: string };
    expect(data.error).toBe("Couldn't start payment — try again in a moment.");
  });

  it("falls through to a fresh create when the stamped subscription no longer exists", async () => {
    const stub = stripeStub([
      [/\/v1\/subscriptions\/sub_gone$/, () => [404, { error: { message: "No such subscription" } }]],
      subResponse("incomplete"),
    ]);
    state.kv.set("subscribe-inflight:user_1:monthly", "sub_gone");
    state.customer = "cus_existing";
    const res = await POST(makeRequest({ interval: "monthly" }));
    expect(res.status).toBe(200);
    expect((await res.json() as { clientSecret?: string | null }).clientSecret).toBe("pi_secret_abc");
    const post = stub.calls.find((c) => c.method === "POST" && c.url.endsWith("/v1/subscriptions"));
    expect(post).toBeTruthy();
  });
});
