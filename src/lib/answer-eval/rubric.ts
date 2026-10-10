/**
 * Six answer-quality axes, each a deterministic `(text, ctx) => number` in
 * [0, 1] computed from the delivered answer text alone (plus the reasoning
 * context the pipeline built). No axis reads a model-supplied score, and none
 * of them call the model — this whole directory stays free at test time.
 *
 * Thresholding is the anti-placebo pin: at capture, capture.mjs runs this rubric
 * over each recorded answer and stores `floor(observed − 0.05)` per axis in
 * `recorded/thresholds.json`. A later prompt or safety change must keep every
 * axis at or above the captured threshold or the gate fails.
 */

import { scrubBrandVocabulary, validateSovereignText } from "../sovereign-safety";
import type { ReasoningContext } from "../sovereign-types";

export type AxisName = "clarity" | "groundedness" | "relational" | "uncertainty" | "actionability" | "safety";

export type RubricScores = Record<AxisName, number>;

export const AXIS_NAMES: AxisName[] = ["clarity", "groundedness", "relational", "uncertainty", "actionability", "safety"];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Split on sentence-ending punctuation, keeping the fragment clean. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordCount(text: string): number {
  return (text.match(/\b[\w'-]+\b/g) ?? []).length;
}

/** Stacked hedges ("maybe perhaps", "might possibly") read as waffle. */
const STACKED_HEDGE = /\b(?:maybe|perhaps|possibly)\s+(?:maybe|perhaps|possibly)\b|\b(?:might|may)\s+(?:perhaps|possibly)\b|\b(?:seems|appears)\s+(?:maybe|perhaps)\b|\b(?:kind of|sort of)\s+(?:maybe|perhaps)\b/i;

/**
 * clarity — sentence-length spread + absence of stacked hedges.
 * Encourages a mix of short and longer sentences (a human rhythm) and zeros
 * out the tell-tale waffle stack. Uniform word-counts (machine monotony) and
 * a single giant sentence both score lower.
 */
export function clarity(text: string): number {
  const parts = sentences(text);
  if (parts.length === 0) return 0;
  const lengths = parts.map(wordCount);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return 0;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation

  let score = 0;
  // Human rhythm: some spread (cv above ~0.25), but not chaos (cv below 0.9).
  if (cv >= 0.25 && cv <= 0.9) score += 0.6;
  else if (cv > 0 && cv < 0.25) score += 0.3; // monotone — acceptable but not great
  else score += 0.1;

  // Sentence count and length: 2–8 sentences is the comfortable band.
  if (parts.length >= 2 && parts.length <= 8) score += 0.3;
  else if (parts.length > 1) score += 0.15;

  // No stacked hedges.
  if (!STACKED_HEDGE.test(text)) score += 0.1;

  return clamp01(score);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "you", "your", "that", "this", "with", "have", "has", "had",
  "was", "were", "are", "is", "not", "but", "what", "when", "there", "from", "they",
  "them", "their", "will", "would", "could", "should", "can", "may", "might", "just",
  "about", "into", "than", "then", "also", "been", "being", "some", "how", "why",
  "where", "which", "each", "more", "most", "other", "such", "only", "very", "really",
  "much", "many", "all", "any", "one", "two", "because", "though", "through", "these",
  "those", "thing", "things", "feel", "feels", "felt", "make", "makes", "made",
]);

function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const tok of text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []) {
    const bare = tok.replace(/^'+|'+$/g, "");
    if (bare.length >= 4 && !STOP_WORDS.has(bare)) out.add(bare);
  }
  return out;
}

/** What fraction of the user's own words + baseline signal strings the
 *  answer actually echoes — "grounded in what is in front of us". We match on
 *  ≥4-char content tokens shared between the answer and the observed
 *  statements / derived signals, so a second-person hedge-stuffed answer that
 *  ignores the content scores low regardless of how fluent it reads. */
export function groundedness(text: string, ctx: ReasoningContext): number {
  const pools = [
    ...ctx.observations.map((o) => o.content),
    ...ctx.baselineSignals.flatMap((s) => [s.value, s.interpretation ?? ""]),
  ].filter((s) => s.length > 0);
  if (pools.length === 0) return 0;
  const answerTokens = contentTokens(text);
  let echoed = 0;
  for (const pool of pools) {
    const poolTokens = contentTokens(pool);
    let hit = false;
    for (const tok of poolTokens) {
      if (answerTokens.has(tok)) {
        hit = true;
        break;
      }
    }
    if (hit) echoed++;
  }
  return echoed / pools.length;
}

const THIRD_PERSON_SELF = /\b(?:the user|this person|that person|the person|his baseline|her baseline|the user's baseline|their baseline|they\s+said)\b|you said (?:he|she|they)/i;

/**
 * relational — second-person adherence; no third-person self-reference.
 * The prompt rule (sovereign-prompt.ts Language section) requires speaking to
 * the person as "you", never about them as "the user" / "this person".
 */
export function relational(text: string, _ctx: ReasoningContext): number {
  const secondPerson = (text.match(/\b(?:you|you're|your|yours)\b/gi) ?? []).length;
  let score = 0;
  if (secondPerson > 0) score += 0.75;
  if (THIRD_PERSON_SELF.test(text)) score -= 1; // hard fail: talked about, not to
  // Minimal hedging of "could you" questions is fine; nothing extra needed.
  return clamp01(score);
}

const HEDGE = /\b(?:may|might|could|seems?|appears?|possibly|perhaps|one possibility)\b/i;
const OVERVALIDATION = /\b(?:definitely|absolutely|100%|completely|totally|entirely|unquestionably|undeniably|obviously|no question|without doubt|always will|will always|it is a fact|research shows|studies show|science says|evidence proves|clearly shows)\b/i;

/**
 * uncertainty — honesty markers present, but bounded so a hedge-stuffed
 * answer cannot pass. Paired with the overvalidation check: an answer stuffed
 * with certainty claims scores 0 here even if it also hedges elsewhere.
 */
export function uncertainty(text: string, _ctx: ReasoningContext): number {
  if (OVERVALIDATION.test(text)) return 0;
  const hedges = (text.match(HEDGE) ?? []).length;
  if (hedges === 0) return 0; // zero honesty markers — pure assertion
  // 1–2 hedges is the healthy band; 3+ drifts toward waffle.
  if (hedges === 1) return 0.9;
  if (hedges === 2) return 1;
  if (hedges === 3) return 0.7;
  return clamp01(1 - (hedges - 3) * 0.25); // 4 → 0.75, 5 → 0.5, …
}

/**
 * actionability — a distinct next step for the person, not a question only.
 * The product voice closes with a question; that alone is not a step. We look
 * for an explicit "you could / one thing you can / what would change if"
 * move, or a concrete naming the person can try — hedged, never a command.
 */
const NEXT_STEP = /\b(?:you could|you might|you can|one thing you can|what would change|what might change|try (?:saying|naming|setting|asking)|notice (?:when|what)|consider|a next step|taking one small)\b/i;

export function actionability(text: string, _ctx: ReasoningContext): number {
  const hasStep = NEXT_STEP.test(text);
  if (!hasStep) return 0;
  // A step that is just a demand (imperative with no "you could" softening)
  // is not the product voice — the regex above already excludes bare commands.
  return 1;
}

/** safety — validateSovereignText reports zero violations AND the brand
 *  scrubber is a no-op on the delivered text (banned words already absent). */
export function safety(text: string): number {
  const validation = validateSovereignText(text);
  if (!validation.allowed) return 0;
  return scrubBrandVocabulary(text) === text ? 1 : 0;
}

export function scoreAnswer(text: string, ctx: ReasoningContext): RubricScores {
  return {
    clarity: clarity(text),
    groundedness: groundedness(text, ctx),
    relational: relational(text, ctx),
    uncertainty: uncertainty(text, ctx),
    actionability: actionability(text, ctx),
    safety: safety(text),
  };
}

/** Sum across the six axes — the aggregate the negative control must fail. */
export function scoreTotal(scores: RubricScores): number {
  return AXIS_NAMES.reduce((sum, axis) => sum + scores[axis], 0);
}