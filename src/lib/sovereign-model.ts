/**
 * Sovereign Model Adapter — non-streaming complete generation with a
 * Cloudflare AI Gateway-first call and a direct fallback, plus response
 * normalization to a single text field.
 */

import type { ModelInput, ModelOutput } from "./sovereign-types";

export const SOVEREIGN_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
export const DEFAULT_GATEWAY_ID = "sovereign-ai-gateway";

export class ModelError extends Error {}

export interface SovereignModel {
  generate(input: ModelInput): Promise<ModelOutput>;
}

type AiRun = (model: string, input: unknown, settings?: unknown) => Promise<unknown>;

/** Keep the model contract platform-agnostic while still typed at call sites. */
export function createCloudflareModel(
  env: { AI: unknown; AI_GATEWAY_ID: string },
  options: { model?: string; gatewayId?: string } = {},
): SovereignModel {
  const model = options.model ?? SOVEREIGN_MODEL;
  const gatewayId = options.gatewayId ?? (env.AI_GATEWAY_ID || DEFAULT_GATEWAY_ID);
  const ai = env.AI as unknown as { run: AiRun };

  return {
    async generate(input: ModelInput): Promise<ModelOutput> {
      const messages = modelMessages(input);
      if (messages.length === 0) throw new ModelError("No messages to send to the model.");
      try {
        const result = await ai.run(model, { messages }, { gateway: { id: gatewayId } });
        return { text: extractText(result), usedGateway: true };
      } catch (gatewayErr) {
        console.error("[sovereign-model] gateway run failed:", gatewayErr);
        try {
          const result = await ai.run(model, { messages });
          return { text: extractText(result), usedGateway: false };
        } catch (directErr) {
          console.error("[sovereign-model] direct run failed:", directErr);
          throw new ModelError("AI service is temporarily unavailable. Please try again.");
        }
      }
    },
  };
}

function modelMessages(input: ModelInput): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const system = input.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .filter(Boolean)
    .join("\n\n");
  const rest = input.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }))
    .filter((m) => m.content.trim().length > 0);
  if (system) return [{ role: "system", content: system }, ...rest];
  return rest;
}

export function extractText(result: unknown): string {
  if (typeof result === "string") return result.trim();
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.response === "string" && r.response.trim()) return r.response.trim();
    if (typeof r.text === "string" && r.text.trim()) return r.text.trim();
    if (Array.isArray(r.output)) {
      const parts = r.output
        .map((o) => (typeof o === "string" ? o : o && typeof o === "object" ? String((o as Record<string, unknown>).response ?? "") : ""))
        .filter(Boolean);
      if (parts.length) return parts.join("").trim();
    } else if (r.output && typeof r.output === "object") {
      const out = r.output as Record<string, unknown>;
      if (typeof out.response === "string" && out.response.trim()) return out.response.trim();
      if (typeof out.text === "string" && out.text.trim()) return out.text.trim();
    }
  }
  throw new ModelError("AI response did not contain recognizable text.");
}