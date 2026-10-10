/**
 * Sovereign Baseline → provenance-aware signals.
 * Translates the derived Baseline into signals that carry their source and
 * epistemic status, so the reasoning layer can use Baseline as context
 * without presenting it as verdict or destiny.
 */

import type { DerivedBaseline } from "./sovereign-prompt";
import type { BaselineSignal } from "./sovereign-types";

export function buildBaselineSignals(baseline: DerivedBaseline): BaselineSignal[] {
  const signals: BaselineSignal[] = [];

  // No separate Sun/Moon signals: those two themes are already the first entries
  // in baseline.qualities (rendered once, in plain language). Emitting them again
  // here duplicated the same line in the prompt and taught the model to recite it.
  for (const quality of baseline.qualities) {
    if (quality === "Insufficient data for quality derivation") continue;
    signals.push({
      source: "Baseline",
      value: quality,
      epistemicStatus: "baseline-supported",
    });
  }
  if (baseline.pressureResponse && !baseline.pressureResponse.startsWith("Insufficient")) {
    signals.push({
      source: "Response under pressure",
      value: baseline.pressureResponse,
      interpretation: "How these qualities may express under stress — a tendency, not a rule.",
      epistemicStatus: "baseline-supported",
    });
  }
  for (const capacity of baseline.underusedCapacities) {
    if (capacity === "Insufficient data") continue;
    signals.push({
      source: "Potentially underused capacity",
      value: capacity,
      epistemicStatus: "baseline-supported",
    });
  }

  return signals;
}

/**
 * Bounded relevance selection for the per-turn reasoning block (F1).
 *
 * The prompt is seeded with the *whole* Baseline every turn otherwise, and the
 * model reaches for whichever line it saw most rather than the one that fits the
 * question. This keeps the two anchor qualities (the most broadly relevant) plus
 * any signal the turn's own words point at, capped at `max`. The full signal pool
 * stays on `ctx.baselineSignals` — only what the model reads is trimmed.
 */
export function selectBaselineSignals(
  signals: BaselineSignal[],
  latestText: string,
  max = 3,
): BaselineSignal[] {
  if (signals.length <= max) return signals;

  const textTokens = new Set(latestText.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []);
  const anchors = signals.slice(0, 2);
  const out = [...anchors];
  for (const s of signals) {
    if (out.length >= max) break;
    if (out.includes(s)) continue;
    const toks = s.value.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [];
    if (toks.some((t) => textTokens.has(t))) out.push(s);
  }
  return out.slice(0, max);
}

export function buildBaselineLimitations(baseline: DerivedBaseline): string[] {
  const limitations: string[] = [];
  if (!baseline.sunTheme && !baseline.moonTheme) {
    limitations.push("Insufficient Baseline data to support quality derivation.");
  }
  if (!baseline.numerologyLifePath) {
    limitations.push("Numerology life path is unknown, so it is not used as context.");
  }
  if (baseline.humanDesignType === "Unknown") {
    limitations.push("Human Design type is unknown, so it is not used as context.");
  }
  if (baseline.birthTimePrecision === "approximate") {
    limitations.push("Birth time is approximate, so time-sensitive layers (Human Design type and authority, rising sign) are indicative rather than exact.");
  }
  return limitations;
}