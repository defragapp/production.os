import { describe, it, expect } from "vitest";
import { createCloudflareModel, ModelError } from "./sovereign-model";
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
});