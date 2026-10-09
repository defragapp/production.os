import { describe, it, expect, vi } from "vitest";
import { createCloudflareModel, describeModelError, ModelError, DEFAULT_MAX_TOKENS, MODEL_CALL_TIMEOUT_MS, SOVEREIGN_MODEL, SOVEREIGN_SECONDARY_MODEL } from "./sovereign-model";
import type { ModelInput } from "./sovereign-types";

function fakeEnv(run: (model: string, input: unknown, settings?: unknown) => Promise<unknown>) {
  return {
    AI: { run } as unknown,
    AI_GATEWAY_ID: "my-gateway",
  };
}

const INPUT: ModelInput = {
  messages: [{ role: "system", content: "system" }, { role: "user", content: "hi" }],
};

describe("createCloudflareModel", () => {
  it("returns gateway output and reports usedGateway", async () => {
    const model = createCloudflareModel(
      fakeEnv(async (_model, _input, settings) => {
        expect((settings as { gateway: { id: string } }).gateway.id).toBe("my-gateway");
        return { response: "hello from gateway" };
      }),
    );
    const out = await model.generate(INPUT);
    expect(out.text).toBe("hello from gateway");
    expect(out.usedGateway).toBe(true);
  });

  it("falls back to a direct call when the gateway fails", async () => {
    let directCalls = 0;
    const model = createCloudflareModel(
      fakeEnv(async (_model, _input, settings) => {
        if (settings) throw new Error("gateway down");
        directCalls += 1;
        return { response: "hello from direct" };
      }),
    );
    const out = await model.generate(INPUT);
    expect(out.text).toBe("hello from direct");
    expect(out.usedGateway).toBe(false);
    expect(directCalls).toBe(1);
  });

  it("throws ModelError when both gateway and direct calls fail", async () => {
    const model = createCloudflareModel(
      fakeEnv(async () => {
        throw new Error("entire service down");
      }),
    );
    await expect(model.generate(INPUT)).rejects.toThrow(ModelError);
  });

  it("rejects empty message inputs", async () => {
    const model = createCloudflareModel(fakeEnv(async () => ({ response: "nope" })));
    await expect(model.generate({ messages: [] })).rejects.toThrow(ModelError);
  });

  it("sends an explicit max_tokens budget, honoring default and override", async () => {
    const seen: unknown[] = [];
    const model = createCloudflareModel(
      fakeEnv(async (_model, input) => {
        seen.push(input);
        return { response: "ok" };
      }),
    );
    await model.generate(INPUT);
    expect((seen[0] as { max_tokens: number }).max_tokens).toBe(DEFAULT_MAX_TOKENS);
    await model.generate({ messages: INPUT.messages, maxTokens: 64 });
    expect((seen[1] as { max_tokens: number }).max_tokens).toBe(64);
  });

  it("self-heals a 1050 on the gateway call by falling through to the direct binding", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: Array<"gateway" | "direct"> = [];
    const model = createCloudflareModel(
      fakeEnv(async (_model, _input, settings) => {
        if (settings) {
          calls.push("gateway");
          throw new Error("error code: 1050");
        }
        calls.push("direct");
        return { response: "recovered without the gateway" };
      }),
    );
    const out = await model.generate(INPUT);
    expect(calls).toEqual(["gateway", "direct"]);
    expect(out.text).toBe("recovered without the gateway");
    expect(out.usedGateway).toBe(false);
    // The self-heal is attributable: the logged line carries the extracted code.
    expect(spy.mock.calls.flat().join(" ")).toContain("code 1050");
    spy.mockRestore();
  });

  it("skips the gateway tier entirely when gatewayId is explicitly empty", async () => {
    let gatewayCalls = 0;
    const model = createCloudflareModel(
      fakeEnv(async (_model, _input, settings) => {
        if (settings) {
          gatewayCalls += 1;
          throw new Error("should never be reached");
        }
        return { response: "direct only" };
      }),
      { gatewayId: "" },
    );
    const out = await model.generate(INPUT);
    expect(gatewayCalls).toBe(0);
    expect(out.text).toBe("direct only");
    expect(out.usedGateway).toBe(false);
  });

  it("surfaces the exact code when both tiers fail and degrades to a ModelError", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const model = createCloudflareModel(
      fakeEnv(async (_model, _input, settings) => {
        throw new Error(settings ? "error code: 1050" : "error code: 1050");
      }),
    );
    await expect(model.generate(INPUT)).rejects.toThrow(ModelError);
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).toContain("gateway run failed");
    expect(logged).toContain("direct run failed");
    expect(logged).toContain("code 1050");
    spy.mockRestore();
  });

  it("walks primary gateway → primary direct → secondary direct on a capacity outage", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const chain: Array<`${string}|${"gateway" | "direct"}`> = [];
    const model = createCloudflareModel(
      fakeEnv(async (m, _input, settings) => {
        chain.push(`${m}|${settings ? "gateway" : "direct"}`);
        // The -fp8 pool is down regionally (503/1050) on both tiers; the
        // standard pool answers.
        if (m === SOVEREIGN_MODEL) throw new Error("error code: 1050 — No available capacity for this model");
        return { response: "served by the secondary pool" };
      }),
    );
    const out = await model.generate(INPUT);
    expect(chain).toEqual([
      `${SOVEREIGN_MODEL}|gateway`,
      `${SOVEREIGN_MODEL}|direct`,
      `${SOVEREIGN_SECONDARY_MODEL}|direct`,
    ]);
    expect(out.text).toBe("served by the secondary pool");
    expect(out.usedGateway).toBe(false);
    expect(spy.mock.calls.flat().join(" ")).toContain("recovered on secondary model");
    spy.mockRestore();
  });

  it("only throws ModelError after the secondary tier also fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const model = createCloudflareModel(
      fakeEnv(async () => {
        calls += 1;
        throw new Error("error code: 1050");
      }),
    );
    await expect(model.generate(INPUT)).rejects.toThrow(ModelError);
    expect(calls).toBe(3); // gateway + direct + secondary direct
    expect(spy.mock.calls.flat().join(" ")).toContain("secondary run failed");
    spy.mockRestore();
  });

  it("skips the secondary tier when the primary IS the secondary model", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: string[] = [];
    const model = createCloudflareModel(
      fakeEnv(async (m) => {
        seen.push(m);
        throw new Error("error code: 1050");
      }),
      { model: SOVEREIGN_SECONDARY_MODEL, gatewayId: "" },
    );
    await expect(model.generate(INPUT)).rejects.toThrow(ModelError);
    expect(seen).toEqual([SOVEREIGN_SECONDARY_MODEL]); // one call, no duplicate retry
    spy.mockRestore();
  });

  it("throws ModelError when a hung generation exceeds the hard 60s budget", async () => {
    // The long-wait reliability pin: inference that never returns must fail
    // closed at the ceiling with a ModelError (so the route refunds usage and
    // shows the retry path) rather than hanging the request indefinitely.
    vi.useFakeTimers();
    try {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const model = createCloudflareModel(
        fakeEnv(() => new Promise(() => {
          /* never settles — a stalled gateway/region */
        })),
      );
      const pending = model.generate(INPUT);
      let caught: unknown;
      pending.catch((e) => {
        caught = e;
      });
      await vi.advanceTimersByTimeAsync(MODEL_CALL_TIMEOUT_MS + 1);
      await expect(pending).rejects.toThrow(ModelError);
      expect(caught).toBeInstanceOf(ModelError);
      expect((caught as Error).message).toMatch(/too long/i);
      spy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("describeModelError", () => {
  it("extracts a Cloudflare error code from the message text", () => {
    expect(describeModelError(new Error("error code: 1050"))).toContain("code 1050");
  });
  it("falls back to a trimmed message when there is no code", () => {
    expect(describeModelError(new Error("network   timeout"))).toBe("network timeout");
  });
  it("handles non-Error throws", () => {
    expect(describeModelError("boom 503")).toContain("code 503");
  });
});