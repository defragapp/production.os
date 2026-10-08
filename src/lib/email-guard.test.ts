import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { recipientMailAllowed, RECIPIENT_CAP } from "./email-guard";
import type { AppEnv } from "./env";

/** Minimal in-memory KV stand-in — records writes, can be made to throw. */
function fakeKv(opts: { failGet?: boolean; failPut?: boolean } = {}) {
  const store = new Map<string, { value: string; ttl?: number }>();
  const kv = {
    async get(key: string) {
      if (opts.failGet) throw new Error("kv down");
      return store.get(key)?.value ?? null;
    },
    async put(key: string, value: string, init?: { expirationTtl?: number }) {
      if (opts.failPut) throw new Error("kv write down");
      store.set(key, { value, ttl: init?.expirationTtl });
    },
  };
  return { kv, store, env: { SESSION_KV: kv } as unknown as AppEnv };
}

describe("recipientMailAllowed — per-recipient cap (F-F)", () => {
  it("admits up to the cap, consuming one slot each time", async () => {
    const { env, store } = fakeKv();
    for (let i = 0; i < RECIPIENT_CAP; i++) {
      await expect(recipientMailAllowed(env, "victim@example.com")).resolves.toBe(true);
    }
    expect(store.get("recipient-mail-rl:victim@example.com")?.value).toBe(String(RECIPIENT_CAP));
  });

  it("refuses past the cap and does not increment the counter further", async () => {
    const { env, store } = fakeKv();
    for (let i = 0; i < RECIPIENT_CAP; i++) await recipientMailAllowed(env, "victim@example.com");
    await expect(recipientMailAllowed(env, "victim@example.com")).resolves.toBe(false);
    expect(store.get("recipient-mail-rl:victim@example.com")?.value).toBe(String(RECIPIENT_CAP));
  });

  it("keys per recipient — one flooded address does not mute everyone", async () => {
    const { env } = fakeKv();
    for (let i = 0; i < RECIPIENT_CAP; i++) await recipientMailAllowed(env, "victim@example.com");
    await expect(recipientMailAllowed(env, "someone-else@example.com")).resolves.toBe(true);
  });

  it("normalises case and whitespace into the same bucket", async () => {
    const { env } = fakeKv();
    for (let i = 0; i < RECIPIENT_CAP; i++) await recipientMailAllowed(env, ` VICTIM@Example.com `);
    await expect(recipientMailAllowed(env, "victim@example.com")).resolves.toBe(false);
  });

  it("sets a window TTL on the counter", async () => {
    const { env, store } = fakeKv();
    await recipientMailAllowed(env, "victim@example.com");
    expect(store.get("recipient-mail-rl:victim@example.com")?.ttl).toBe(3600);
  });

  it("fails OPEN when KV cannot be read — a KV hiccup must not dead-end signups", async () => {
    const { env } = fakeKv({ failGet: true });
    await expect(recipientMailAllowed(env, "victim@example.com")).resolves.toBe(true);
  });

  it("still admits when the counter write fails after a passing read", async () => {
    const { env } = fakeKv({ failPut: true });
    await expect(recipientMailAllowed(env, "victim@example.com")).resolves.toBe(true);
  });
});

describe("email-guard call sites are wired (contract)", () => {
  const sources: Array<[label: string, path: string]> = [
    ["signup verify/welcome", "src/app/api/auth/route.ts"],
    ["verification resend", "src/app/api/auth/resend/route.ts"],
    ["invite send", "src/app/api/invites/route.ts"],
  ];
  for (const [label, path] of sources) {
    it(`${label} gates its send behind recipientMailAllowed`, () => {
      const src = readFileSync(path, "utf8");
      expect(src).toContain('from "@/lib/email-guard"');
      expect(src).toMatch(/recipientMailAllowed\(/);
    });
  }
});
