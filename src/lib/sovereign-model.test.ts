import { describe, it, expect, vi } from "vitest";
import { createCloudflareModel, describeModelError, ModelError, DEFAULT_MAX_TOKENS } from "./sovereign-model";
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