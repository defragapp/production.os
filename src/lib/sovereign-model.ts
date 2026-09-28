/**
 * Sovereign Model Adapter — non-streaming complete generation with a
 * Cloudflare AI Gateway-first call and a direct fallback, plus response
 * normalization to a single text field.
 */

import type { ModelInput, ModelOutput } from "./sovereign-types";

export const SOVEREIGN_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
export const DEFAULT_GATEWAY_ID = "sovereign-ai-gateway";

/**
 * Default generation output budget. Cloudflare's implicit default is small
 * enough to truncate a typical Sovereign answer mid-sentence, so we always send
 * an explicit value. Bounded upward to keep per-message compute cost sane.
 */
export const DEFAULT_MAX_TOKENS = 1024;

export class ModelError extends Error {}

export interface SovereignModel {
  generate(input: ModelInput): Promise<ModelOutput>;
}

type AiRun = (model: string, input: unknown, settings?: unknown) => Promise<unknown>;

/**
 * Extract a stable, greppable cause from a binding failure. Cloudflare surfaces
 * Workers AI / AI Gateway errors as `error code: 1050` inside the message text,
 * so we pull the numeric code out and log it alongside a trimmed message. This
 * keeps a self-heal event attributable (1050 spend/rate block vs. a malformed
 * gateway id vs. a network drop) without dumping a whole stack per turn.
 */
export function describeModelError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = /\b(\d{3,4})\b/.exec(message)?.[1];
  const trimmed = message.replace(/\s+/g, " ").trim().slice(0, 200);
  return code ? `code ${code}: ${trimmed}` : trimmed;
}

/** Keep the model contract platform-agnostic while still typed at call sites. */
export function createCloudflareModel(
  env: { AI: unknown; AI_GATEWAY_ID: string },
  options: { model?: string; gatewayId?: string } = {},
): SovereignModel {
  const model = options.model ?? SOVEREIGN_MODEL;
  // An explicitly-empty gatewayId (options.gatewayId === "") disables the
  // gateway tier; otherwise fall back to the configured id, then the default.
  const gatewayId = (options.gatewayId ?? (env.AI_GATEWAY_ID || DEFAULT_GATEWAY_ID)).trim();
  const ai = env.AI as unknown as { run: AiRun };

  return {
    async generate(input: ModelInput): Promise<ModelOutput> {
      const messages = modelMessages(input);
      if (messages.length === 0) throw new ModelError("No messages to send to the model.");
      const params = { messages, max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS };

      // Tier 1 — AI Gateway (caching, rate limits, analytics). Skipped cleanly
      // when no gateway id is configured, so a blank id never becomes an
      // invalid `{ gateway: { id: "" } }` call the binding would reject.
      if (gatewayId) {
        try {
          const result = await ai.run(model, params, { gateway: { id: gatewayId } });
          return { text: extractText(result), usedGateway: true };
        } catch (gatewayErr) {
          // Self-heal: a stale/misconfigured gateway (the common cause of a
          // 1050 on the gateway call while the underlying binding is healthy)
          // falls through to a direct binding call instead of failing the turn.
          console.error(`[sovereign-model] gateway run failed (${describeModelError(gatewayErr)}) — retrying via direct binding`);
        }
      }

      // Tier 2 — direct binding, no gateway indirection. This is the last
      // automatic tier; if it also fails we surface the code and degrade
      // gracefully so the caller refunds usage and shows a friendly retry
      // message rather than crashing the session.
      try {
        const result = await ai.run(model, params);
        return { text: extractText(result), usedGateway: false };
      } catch (directErr) {
        console.error(`[sovereign-model] direct run failed (${describeModelError(directErr)})`);
        throw new ModelError("Sovereign couldn't reach the AI just now — try again in a moment.");
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