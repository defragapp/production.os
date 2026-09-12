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
  const sunTheme = baseline.sunTheme !== "unknown" ? baseline.sunTheme : null;
  const moonTheme = baseline.moonTheme !== "unknown" ? baseline.moonTheme : null;

  if (sunTheme) {
    signals.push({
      source: "Sun — core expression",
      value: sunTheme,
      interpretation: "A quality that tends to express when the person is centered.",
      epistemicStatus: "baseline-supported",
    });
  }
  if (moonTheme) {
    signals.push({
      source: "Moon — inner response",
      value: moonTheme,
      interpretation: "A quality that tends to shape the person's inner, more private response.",
      epistemicStatus: "baseline-supported",
    });
  }
  for (const quality of baseline.qualities) {
    if (quality === "Insufficient data for quality derivation") continue;
    signals.push({
      source: "Derived qualities",
      value: quality,
      epistemicStatus: "baseline-supported",
    });
  }
  if (baseline.pressureResponse && !baseline.pressureResponse.startsWith("Insufficient")) {
    signals.push({
      source: "Response under pressure",
      value: baseline.pressureResponse,
      interpretation: "How the person's qualities may express when stressed — a tendency, not a rule.",
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
  return limitations;
}