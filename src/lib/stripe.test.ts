import { describe, it, expect } from "vitest";
import { priceToSubscription, tierFromSubscriptionStatus, configuredPrice, stripeConfigured } from "./stripe";
import type { AppEnv } from "./env";

const env = {
  STRIPE_PRICE_SOVEREIGN_PLUS_MONTHLY: "price_monthly",
  STRIPE_PRICE_SOVEREIGN_PLUS_ANNUAL: "price_annual",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_SUCCESS_URL: "https://example.com/success",
  STRIPE_CANCEL_URL: "https://example.com/cancel",
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