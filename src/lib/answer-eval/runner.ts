/**
 * Runner — replays each fixture through the REAL `generateSovereignResponse`
 * using a `SovereignModel` stub that returns the recorded text. Same seam the
 * golden evals already proved (sovereign-evals.test.ts), which is what keeps
 * this deterministic: zero model calls at test time, yet every repair /
 * validation / fallback branch of the pipeline still runs for real.
 *
 * The recorded answer is the final DELIVERED text (post-validation, post-
 * scrub) from the live capture. Replaying it must therefore validate clean:
 * `validated === true` and `text === recorded.text`. If a later change to the
 * prompt or safety rules breaks that, the gate fails and the fixture must be
 * re-captured — which is the before/after measurement working as intended.
 */

import { createHash } from "node:crypto";
import { buildReasoningContext, buildReasoningPrompt, generateSovereignResponse } from "../sovereign-reasoning";
import type { DerivedBaseline } from "../sovereign-prompt";
import type { SovereignModel } from "../sovereign-model";
import type { ChatMessage } from "../types";
import type { ReasoningContext, SovereignGenerationResult } from "../sovereign-types";

/** Stub that returns the recorded text on every call (including a repair
 *  attempt — so a regression that makes the recorded answer fail validation
 *  surfaces as `usedFallback`, never as a silent re-generation). */
export function recordingModel(text: string): SovereignModel {
  return {
    async generate() {
      return { text, usedGateway: false };
    },
  };
}

/** SHA-256 hex of the exact prompt (system + windowed history) the pipeline
 *  builds for this fixture. capture.mjs stores it; the test asserts it still
 *  matches, so a prompt drift is caught even if the answer text is unchanged. */
export function promptShaOf(ctx: ReasoningContext, history: ChatMessage[], baseline: DerivedBaseline): string {
  const messages = buildReasoningPrompt(ctx, history, baseline);
  return createHash("sha256").update(JSON.stringify(messages)).digest("hex");
}

export interface ReplayResult {
  ctx: ReasoningContext;
  result: SovereignGenerationResult;
}

/** Replay one fixture: build the real reasoning context, run the real
 *  pipeline against the stub, return both so the rubric can score the exact
 *  context + delivered text the pipeline produced. */
export async function replayFixture(
  history: ChatMessage[],
  baseline: DerivedBaseline,
  recordedText: string,
): Promise<ReplayResult> {
  const ctx = await buildReasoningContext({ history, baseline });
  const result = await generateSovereignResponse(ctx, history, baseline, recordingModel(recordedText));
  return { ctx, result };
}