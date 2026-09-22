import { describe, it, expect, vi, afterEach } from "vitest";
import { priceToSubscription, tierFromSubscriptionStatus, configuredPrice, stripeConfigured, createPortalSession } from "./stripe";
import type { AppEnv } from "./env";

const env = {
  STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY: "price_monthly",
  STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL: "price_annual",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_SUCCESS_URL: "https://example.com/success",
  STRIPE_CANCEL_URL: "https://example.com/cancel",
  STRIPE_PORTAL_RETURN_URL: "https://example.com/account",
} as unknown as AppEnv;

describe("configuredPrice", () => {
  it("returns the matching price per interval", () => {
    expect(configuredPrice(env, "monthly")).toBe("price_monthly");
    expect(configuredPrice(env, "annual")).toBe("price_annual");
  });
});

describe("priceToSubscription", () => {
  it("maps known price ids to sovereign_plus", () => {
    expect(priceToSubscription(env, "price_monthly")).toEqual({ plan: "sovereign_plus", interval: "monthly" });
    expect(priceToSubscription(env, "price_annual")).toEqual({ plan: "sovereign_plus", interval: "annual" });
  });

  it("falls back to free for unknown or missing price ids", () => {
    expect(priceToSubscription(env, "price_unknown")).toEqual({ plan: "free" });
    expect(priceToSubscription(env, undefined)).toEqual({ plan: "free" });
  });
});

describe("tierFromSubscriptionStatus", () => {
  it("treats active/trialing as sovereign_plus", () => {
    expect(tierFromSubscriptionStatus("active")).toBe("sovereign_plus");
    expect(tierFromSubscriptionStatus("trialing")).toBe("sovereign_plus");
  });

  it("treats everything else as free", () => {
    expect(tierFromSubscriptionStatus("canceled")).toBe("free");
    expect(tierFromSubscriptionStatus("past_due")).toBe("free");
  });
});

describe("stripeConfigured", () => {
  it("is true when required values are present", () => {
    expect(stripeConfigured(env)).toBe(true);
  });

  it("is false when the secret is missing", () => {
    expect(stripeConfigured({ ...env, STRIPE_SECRET_KEY: "" } as unknown as AppEnv)).toBe(false);
  });
});

describe("createPortalSession", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts customer + return_url and returns the portal url", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://billing.stripe.com/session/xyz" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const result = await createPortalSession(env, "cus_123");
    expect(result.url).toBe("https://billing.stripe.com/session/xyz");

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    expect(init.method).toBe("POST");
    expect(init.body).toContain("customer=cus_123");
    expect(init.body).toContain("return_url=https%3A%2F%2Fexample.com%2Faccount");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
  });

  it("throws when Stripe returns an error", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "No such customer: cus_nope" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    await expect(createPortalSession(env, "cus_nope")).rejects.toThrow("No such customer: cus_nope");
  });

  it("throws when no return URL is configured", async () => {
    const withoutReturn = { ...env, STRIPE_PORTAL_RETURN_URL: "" } as unknown as AppEnv;
    await expect(createPortalSession(withoutReturn, "cus_123")).rejects.toThrow(
      "Stripe portal return URL is not configured",
    );
  });
});