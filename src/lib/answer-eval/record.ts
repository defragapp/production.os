/**
 * Capture runner — the one-off, owner-authorised step that turns #59's approval
 * into committed artifacts. It is NOT part of any gate and it is never run by
 * CI: it spends paid-tier Workers AI capacity on the real model, one call per
 * fixture, and writes `recorded/` so the test suite is deterministic and free
 * thereafter.
 *
 * Faithfulness contract: this script drives the SAME pipeline entry points the
 * chat route uses (`buildReasoningContext` → `generateSovereignResponse`),
 * through a `SovereignModel` adapter that calls the real model over the
 * account's Workers AI REST endpoint with the same messages and the same
 * `max_tokens` budget. The recorded `text` is the final DELIVERED text —
 * post-validation, post-repair, post-scrub — which is exactly what the runner
 * stub replays, so replay is byte-for-byte deterministic.
 *
 * Generation tier note: the product prefers the AI Gateway binding, which a
 * plain Node script cannot reach; the direct `ai/run` endpoint is 1:1 for the
 * same model + prompt, so `tier` is recorded honestly as "direct".
 *
 * Threshold rule (the anti-placebo pin): each axis threshold is
 * `floor((observed − 0.05) × 100) / 100` — floored at 2 decimals, never
 * hand-picked. `observed` is stored alongside so the test can re-verify the
 * derivation and detect hand-edited thresholds.
 *
 * No `process`/env here: capture.mjs (plain JS) reads env and calls runCapture.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_MAX_TOKENS, SOVEREIGN_MODEL } from "../sovereign-model";
import type { SovereignModel } from "../sovereign-model";
import { buildReasoningContext, generateSovereignResponse } from "../sovereign-reasoning";
import type { ModelInput, ModelOutput } from "../sovereign-types";
import { scoreAnswer, scoreTotal, type RubricScores } from "./rubric";
import { FIXTURE_BASELINE, FIXTURES } from "./fixtures";
import { promptShaOf } from "./runner";

export interface CaptureOptions {
  accountId: string;
  apiToken: string;
  /** Where recorded/*.json land. Defaults to this directory's `recorded/`. */
  outDir?: string;
}

export interface AiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface RecordedAnswer {
  fixtureId: string;
  model: string;
  tier: "direct";
  capturedAt: string;
  promptSha: string;
  text: string;
  usage: AiUsage;
  /** Additive provenance: the observed rubric scores thresholds were cut from. */
  observed: RubricScores;
  observedTotal: number;
}

export interface ThresholdEntry {
  clarity: number;
  groundedness: number;
  relational: number;
  uncertainty: number;
  actionability: number;
  safety: number;
}

/** floor((observed − 0.05) × 100) / 100 — floored at 2 decimals, never negative. */
export function thresholdFor(observed: number): number {
  return Math.max(0, Math.floor((observed - 0.05) * 100) / 100);
}

/** Real-model adapter over the Workers AI REST endpoint (direct tier). */
export function restModel(opts: CaptureOptions): SovereignModel & { lastUsage: AiUsage } {
  const state: { lastUsage: AiUsage } = { lastUsage: {} };
  const generate = async (input: ModelInput): Promise<ModelOutput> => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/ai/run/${SOVEREIGN_MODEL}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: input.messages, max_tokens: DEFAULT_MAX_TOKENS }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      result?: { response?: string; usage?: AiUsage };
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok || !json.success || typeof json.result?.response !== "string") {
      const detail = json.errors?.map((e) => e.message).join("; ") ?? res.statusText;
      throw new Error(`Workers AI REST call failed: ${detail || "unknown error"}`);
    }
    state.lastUsage = json.result.usage ?? {};
    return { text: json.result.response, usedGateway: false };
  };
  // Live getter — lastUsage must reflect the most recent call, not a snapshot.
  return { generate, get lastUsage() { return state.lastUsage; } } as SovereignModel & { lastUsage: AiUsage };
}

export async function runCapture(opts: CaptureOptions): Promise<{ recorded: RecordedAnswer[]; thresholds: Record<string, ThresholdEntry> }> {
  if (!opts.apiToken) throw new Error("CLOUDFLARE_API_TOKEN is required");
  if (!opts.accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required");

  const model = restModel(opts);
  const recorded: RecordedAnswer[] = [];
  const thresholds: Record<string, ThresholdEntry> = {};

  for (const fixture of FIXTURES) {
    const ctx = await buildReasoningContext({ history: fixture.history, baseline: FIXTURE_BASELINE });
    const promptSha = promptShaOf(ctx, fixture.history, FIXTURE_BASELINE);

    // One real generation per fixture, through the real pipeline so repair /
    // validation / scrub all run exactly as production would run them.
    const result = await generateSovereignResponse(ctx, fixture.history, FIXTURE_BASELINE, model);
    if (!result.validated) {
      throw new Error(`Fixture ${fixture.id} produced no validated answer (usedFallback=${result.usedFallback}) — re-capture after fixing the fixture.`);
    }

    const observed = scoreAnswer(result.text, ctx);
    recorded.push({
      fixtureId: fixture.id,
      model: SOVEREIGN_MODEL,
      tier: "direct",
      capturedAt: new Date().toISOString(),
      promptSha,
      text: result.text,
      usage: model.lastUsage,
      observed,
      observedTotal: scoreTotal(observed),
    });

    thresholds[fixture.id] = {
      clarity: thresholdFor(observed.clarity),
      groundedness: thresholdFor(observed.groundedness),
      relational: thresholdFor(observed.relational),
      uncertainty: thresholdFor(observed.uncertainty),
      actionability: thresholdFor(observed.actionability),
      safety: thresholdFor(observed.safety),
    };
  }

  const outDir = opts.outDir ?? fileURLToPath(new URL("./recorded/", import.meta.url));
  mkdirSync(outDir, { recursive: true });
  for (const entry of recorded) {
    writeFileSync(`${outDir}/${entry.fixtureId}.json`, `${JSON.stringify(entry, null, 2)}\n`);
  }
  writeFileSync(`${outDir}/thresholds.json`, `${JSON.stringify(thresholds, null, 2)}\n`);

  return { recorded, thresholds };
}