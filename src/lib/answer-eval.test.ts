/**
 * Answer-quality gate — replays every recorded answer through the REAL
 * pipeline (generateSovereignResponse) with a stub, so this test stays free:
 * zero model calls, deterministic, runs on every `npm test`.
 *
 * It pins four things:
 *  1. promptSha drift — the recorded answer must still be the answer to the
 *     prompt the current code builds. The moment the prompt changes (like #53
 *     will), recordings are stale and must be re-captured; the before/after
 *     comparison is exactly what this gate is for.
 *  2. replay fidelity — the delivered text must match the recorded text
 *     (validation + scrub must not mangle it).
 *  3. thresholds — each axis must still score ≥ the captured threshold
 *     (`floor(observed − 0.05)`, never hand-picked).
 *  4. the negative control — a deliberately bad answer must FAIL the rubric
 *     (safety 0) and the pipeline must refuse it (usedFallback).
 *
 * All recorded data lives in src/lib/answer-eval/recorded/ and is committed.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_BASELINE, FIXTURES, NEGATIVE_CONTROL } from "./answer-eval/fixtures";
import { AXIS_NAMES, scoreAnswer, scoreTotal } from "./answer-eval/rubric";
import { promptShaOf, replayFixture } from "./answer-eval/runner";
import { thresholdFor, type RecordedAnswer, type ThresholdEntry } from "./answer-eval/record";

const RECORDED_DIR = fileURLToPath(new URL("./answer-eval/recorded/", import.meta.url));

function readRecorded(fixtureId: string): RecordedAnswer {
  return JSON.parse(readFileSync(join(RECORDED_DIR, `${fixtureId}.json`), "utf8")) as RecordedAnswer;
}

function readThresholds(): Record<string, ThresholdEntry> {
  return JSON.parse(readFileSync(join(RECORDED_DIR, "thresholds.json"), "utf8")) as Record<string, ThresholdEntry>;
}

describe("answer-eval — recorded answers stay above captured thresholds", () => {
  const thresholds = readThresholds();

  for (const fixture of FIXTURES) {
    it(`${fixture.id}: replay is faithful, prompt is unchanged, every axis ≥ threshold`, async () => {
      const recorded = readRecorded(fixture.id);

      // Replay through the REAL pipeline with the stub that returns the
      // recorded answer — the same seam the golden evals (sovereign-evals)
      // proved, so validation/repair/scrub all run for real.
      const { ctx, result } = await replayFixture(fixture.history, FIXTURE_BASELINE, recorded.text);

      // 1. Prompt drift: the recorded sha must equal the prompt built today.
      const nowSha = promptShaOf(ctx, fixture.history, FIXTURE_BASELINE);
      expect(nowSha, "prompt drifted — re-capture with: node src/lib/answer-eval/capture.mjs").toBe(recorded.promptSha);

      // 2. The delivered answer must be byte-identical to what was recorded.
      expect(result.validated, "recorded answer no longer validates").toBe(true);
      expect(result.usedFallback, "recorded answer fell back to grounded response").toBe(false);
      expect(result.text).toBe(recorded.text);

      // 3. Threshold ratchet per axis.
      const scores = scoreAnswer(result.text, ctx);
      const entry = thresholds[fixture.id];
      expect(entry, `no thresholds row for ${fixture.id}`).toBeDefined();
      for (const axis of AXIS_NAMES) {
        expect(scores[axis], `${fixture.id} axis ${axis} dropped below threshold`).toBeGreaterThanOrEqual(entry[axis]);
      }

      // 4. Output vocabulary: no banned term, at least one required term.
      const lower = result.text.toLowerCase();
      for (const banned of fixture.expect.must_avoid) {
        expect(lower, `${fixture.id}: banned term "${banned}" present`).not.toContain(banned.toLowerCase());
      }
      const included = fixture.expect.must_include_any.some((term) => lower.includes(term.toLowerCase()));
      expect(included, `${fixture.id}: none of the required terms present`).toBe(true);
    });
  }

  it("thresholds are derived, never hand-picked (floor(observed − 0.05))", () => {
    for (const fixture of FIXTURES) {
      const recorded = readRecorded(fixture.id);
      const entry = thresholds[fixture.id];
      for (const axis of AXIS_NAMES) {
        expect(recorded.observed[axis], `${fixture.id} observed.${axis} missing`).toBeDefined();
        expect(entry[axis]).toBe(thresholdFor(recorded.observed[axis]));
      }
    }
  });

  it("negative control: rubric fails it and the pipeline refuses it", async () => {
    const minObservedTotal = Math.min(...FIXTURES.map((f) => readRecorded(f.id).observedTotal));

    const { ctx, result } = await replayFixture(NEGATIVE_CONTROL.history, FIXTURE_BASELINE, NEGATIVE_CONTROL.recorded);

    // The rubric must fail the deliberately bad answer: safety 0.
    const scores = scoreAnswer(NEGATIVE_CONTROL.recorded, ctx);
    expect(scores.safety, "negative control must fail the safety axis").toBe(0);
    // And its aggregate must sit below the worst real recorded answer.
    expect(scoreTotal(scores), "negative control must score below every real answer").toBeLessThan(minObservedTotal);

    // And the real pipeline must refuse it (repair cannot rescue garbage).
    expect(result.usedFallback, "negative control must be refused by the pipeline").toBe(true);
  });

  it("recorded set covers all fixtures and every recorded file has live credentials fields", () => {
    // Every fixture must have a recorded answer; extra files in the dir would
    // mean a fixture was removed without re-capturing (kept as a stray pin).
    // We only assert the positive direction: fixtures → recorded files.
    for (const fixture of FIXTURES) {
      const recorded = readRecorded(fixture.id);
      expect(recorded.fixtureId).toBe(fixture.id);
      expect(recorded.model).toMatch(/^@cf\//);
      expect(recorded.tier).toBe("direct");
      expect(recorded.promptSha).toMatch(/^[0-9a-f]{64}$/);
      expect(recorded.text.length).toBeGreaterThan(0);
      expect(typeof recorded.capturedAt).toBe("string");
    }
  });
});