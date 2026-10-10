/**
 * Sovereign Safety — deterministic (Layer 1) validation and high-risk routing.
 *
 * Layer 1 is a static lexicon over prohibited output categories. It is
 * negation-aware so that sentences like "you are not the problem" pass.
 * It never decides the reasoning itself — it only blocks unsafe text.
 */

import type { ChatMessage } from "./types";
import type {
  ReasoningContext,
  SafetyMode,
  SafetyValidation,
  SafetyViolation,
  SafetyViolationType,
} from "./sovereign-types";
import { selectCrisisResources } from "./crisis-resources";

const NEGATIVES = new Set([
  "not", "no", "never", "don't", "dont", "doesn't", "doesnt", "isn't", "isnt",
  "aren't", "arent", "can't", "cant", "cannot", "won't", "wont", "without",
  "ain't", "aint", "don’t", "isn’t", "aren’t", "can’t", "won’t", "neither", "nor",
]);

interface LexiconRule {
  type: SafetyViolationType;
  severity: "high" | "medium" | "low";
  patterns: Array<string | RegExp>;
  note: string;
  /**
   * When true, a negation token found INSIDE the matched span means the
   * sentence denies the prohibited claim (e.g. "you are not the problem")
   * and must NOT be flagged. When false, the claim stands regardless of
   * polarity (e.g. "she does not care about you" is still a claim of
   * knowledge about her inner world).
   */
  insideNegativeSkips?: boolean;
  /**
   * When true, a negation token in the 40-char window BEFORE the match must
   * NOT cancel the rule. Used by rules whose own wording contains negation
   * ("I cannot … I cannot …") — there the repeated fence is the violation
   * itself, and the look-back window is guaranteed to contain the first
   * "cannot".
   */
  skipNegationLookback?: boolean;
}

const LEXICON: LexiconRule[] = [
  {
    type: "diagnosis",
    severity: "high",
    note: "Clinical naming or pathology language is prohibited.",
    patterns: [
      /\bdiagnos(?:ed|is|e)\b/i,
      /\bdisorder\b/i,
      /\bnarcissi(?:st|sm|tic)\b/i,
      /\bcodependen(?:t|cy)\b/i,
      /\bborderline\b/i,
      /\bschizo(?:phren|phrenic)\b/i,
      /\bclinical depress(?:ion|ed)\b/i,
      /\bbipolar\b/i,
      /\bptsd\b/i,
      /\badhd\b/i,
      /\bocd\b/i,
      /\bpersonality disorder\b/i,
      /\battachment(?:al)? (?:style|disorder|issues)\b/i,
      /\bavoidant(?: |-)attachment\b/i,
      /\banxious(?: |-)attachment\b/i,
      /\bthis sounds like a?\s*(?:textbook |classic |clear |case of )?\w+\s*(?:disorder|syndrome)\b/i,
      // Paraphrase-resistant pathologizing: a pop-clinical noun asserted as the
      // cause ("your fear of abandonment is driving this"). The causal frame is
      // required so a hedged interpretive question ("could a fear of
      // abandonment be why…?") stays allowed — only diagnosis-as-fact is blocked.
      /\b(?:fear of (?:abandonment|rejection|intimacy|engulfment)|inner\s+child|wounded\s+child|abandonment\s+(?:issue|wound|trauma)|attachment\s+(?:issue|wound)|trust\s+issue|control\s+issue)[^.]{0,24}\b(?:is|are|was|were)\s+(?:why|driving|causing|behind|the\s+reason)\b/i,
    ],
  },
  {
    type: "identity-verdict",
    severity: "high",
    note: "Installing an identity label as a verdict is prohibited.",
    insideNegativeSkips: true,
    patterns: [
      /\byou(?:'re| are)\s+(?:(?:very|so|just|really|such|quite)\s+)?(?:not\s+|never\s+)?(?:a\s+)?(?:burden|problem|failure|narcissist|toxic|selfish|needy|broken|weak|manipulative|controlling|dramatic|intense|difficult|mess|lost cause)\b/i,
      /\byou have low (?:self-worth|self-esteem)\b/i,
      /\byou(?:'re| are) (?:the )?reason (?:why |)(?:bad |negative |crappy |toxic )?things (?:happen|keep happening)\b/i,
      /\byou attract (?:people|partners|relationships) who (?:take advantage|hurt|use|leave)\b/i,
      /\bthe real you (?:is|is that|wants)\b/i,
      /\bdeep down you(?:'re| are)\b/i,
      // "You attract toxic partners" — the original rule required a trailing
      // "who…" clause; the derogatory-qualified object form is the same verdict
      // and must be caught too.
      /\byou\s+(?:always\s+)?(?:attract|draw\s+in|pull\s+in|surround\s+yourself\s+with)\s+(?:toxic|narcissis\w*|abusive|manipulative|selfish|emotionally\s+unavailable|the\s+wrong|bad|damaged)\s+(?:people|partners?|relationships?|friends?|them)\b/i,
      // "You're someone who makes everything about yourself" — an identity
      // verdict wrapped in "someone who…" that never names a listed adjective.
      /\byou(?:'re| are)\s+(?:just\s+)?(?:a\s+)?(?:person|someone|type\s+of\s+person)\s+who\s+(?:makes?\s+everything\s+about|only\s+thinks\s+about|can'?t\s+(?:hear|take|accept|see)|never\s+(?:listens?|admits?))\b/i,
    ],
  },
  {
    type: "motive-certainty",
    severity: "high",
    note: "Asserting another person's intention as certain is prohibited.",
    patterns: [
      /\b(?:he|she|they)\s+(?:is|are|was|were|'s)\s+(?:definitely\s+|clearly\s+|obviously\s+|surely\s+)?(?:trying to|intending to|planning to|meant to|intended to)\s+(?:hurt|manipulate|control|use|gaslight|punish|abandon|destroy|ruin)\s+you\b/i,
      /\b(?:she|he)\s+(?:wanted|wants|intended|intends)\s+to\s+(?:hurt|punish|manipulate|demean|belittle)\s+you\b/i,
      /\b(?:it's|it is)\s+obvious\s+(?:that\s+)?(?:they|he|she)\s+wants?\b/i,
      /\bwithout\s+(?:any\s+)?doubt\s+(?:they|he|she)\s+(?:are|is|want|wants)\b/i,
      /\b(?:they|he|she)\s+(?:deliberately|intentionally|on purpose)\s+(?:hurt|ignored|excluded|lied) you\b/i,
    ],
  },
  {
    type: "hidden-emotion-certainty",
    severity: "medium",
    note: "Claiming knowledge of another person's inner feelings is prohibited.",
    patterns: [
      /\b(?:he|she)\s+(?:secretly|actually|really|quietly)\s+(?:loves|cares|is (?:in )?love)\s+with you\b/i,
      /\b(?:he|she|they)\s+(?:is|are)\s+(?:secretly|probably|definitely)\s+(?:jealous|insecure|afraid|threatened|intimidated|resentful)\b/i,
      /\b(?:he|she)\s+means\s+well\s+but\b/i,
      /\b(?:he|she)\s+doesn'?t\s+feel\b/i,
      /\b(?:he|she)\s+is\s+just\s+afraid\s+to\s+love\s+you\b/i,
      /\byou\s+intimidate\s+(?:him|her)\b/i,
      /\b(?:he|she)\s+misses\s+you\s+but\s+(?:won'?t|can'?t)\s+say\s+it\b/i,
      /\bthey\s+actually\s+(?:do\s+care|care)\b\s?about you\b/i,
      // Bare declarative inner-state claims (no adverb present): "She cares
      // about you", "He loves you", "He misses you". The 40-char negation look-
      // back in flagged() still spares the honest "I can't tell whether she
      // cares about you" framing, so this lifts recall without killing hedged text.
      /\b(?:he|she|they)\s+(?:deep\s+down\s+|secretly\s+|actually\s+|truly\s+|genuinely\s+|clearly\s+)?(?:cares?\s+about|loves?|misses?|needs?)\s+you\b/i,
      // "He's just too scared to say it" — asserting the felt reason for silence.
      /\b(?:he|she|they)\s+(?:is|'s|are|'re)\s+(?:just\s+|too\s+)?(?:scared|afraid|terrified)\s+to\s+(?:say|admit|open|commit|love|be\s+with)\b/i,
    ],
  },
  {
    type: "relationship-verdict",
    severity: "high",
    note: "Judging who is right inside a relationship — or naming the other person's role — is prohibited.",
    patterns: [
      /\b(?:is|are|was|were)\s+(?:clearly\s+|definitely\s+)?(?:manipulating|gaslighting|using|playing|controlling|taking advantage of)\s+you\b/i,
      /\b(?:he|she|they)\s+(?:is|are)\s+(?:toxic|abusive|manipulative|a narcissist|using you|playing you|gaslighting you)\b/i,
      /\byou\s+deserve\s+better\s+(?:than|treatment|because)\b/i,
      /\byou\s+deserve\s+someone\s+who\b/i,
      /\bdoesn'?t\s+deserve\s+you\b/i,
      /\b(?:they|he|she)\s+do(?:esn'?t|n'?t)\s+care\s+about\s+you\b/i,
      /\b(?:they|he|she)\s+(?:does\s+not|do\s+not)\s+care\s+about\s+you\b/i,
      /\bthe\s+(?:real )?problem\s+is\s+(?:him|her|them)\b/i,
      /\b(?:he|she)\s+is\s+(?:treating|being)\s+you\s+(?:like|badly)\s+for\s+a\s+reason\b/i,
    ],
  },
  {
    type: "system-blame",
    severity: "medium",
    note: "Blaming a system (parents, Baseline, upbringing) as a certain cause is prohibited.",
    patterns: [
      /\byour\s+(?:parents|mother|father|family|childhood|upbringing)\s+(?:made|makes|caused|is the reason)\s+you\b/i,
      /\bbecause\s+of\s+your\s+(?:baseline|astro(?:logy|logical chart)|chart|human design|numerology|sun sign|moon sign)\b/i,
      /\byour\s+(?:baseline|chart|human design|numerology|sun sign|moon sign)\s+(?:made|makes|determines|means)\s+you\b/i,
      /\byou'?re\s+(?:trapped|locked|stuck)\s+in\s+your\s+(?:baseline|design|chart)\b/i,
      /\bit'?s\s+(?:all|entirely)\s+your\s+(?:parents'|mother'?s|father'?s|family'?s)\s+fault\b/i,
    ],
  },
  {
    type: "baseline-determinism",
    severity: "high",
    note: "Presenting the Baseline or Human Design as fixed identity — for the user or another person — is prohibited.",
    patterns: [
      /\byour\s+baseline\s+(?:says|predicts|determines|destines|means)\s+you\b/i,
      /\baccording\s+to\s+your\s+baseline[,]?\s+you(?:'re| are)\s+\w+\b/i,
      /\byour\s+baseline\s+shows\s+you\s+are\s+(\w+\s+\w+)?\b/i,
      /\byour\s+human\s+design\s+(?:says|means|determines|makes)\s+you\b/i,
      /\byour\s+life\s+path\s+(?:means|determines|predestines|destines)\s+you\b/i,
      /\bhuman\s+design\s+dictates\b/i,
      /\byou\s+are\s+(?:a\s+)?(?:pure\s+)?generator\b.*\bso\s+you\s+should\b/i,
      // Naming ANOTHER person a Human Design type hands down an identity verdict
      // about them and name-drops the framework in the same breath. The 40-char
      // negation look-back still spares honest "I can't tell whether she is a
      // Generator" framing, so hedged references stay allowed.
      /\b(?:he|she|they|your\s+(?:partner|wife|husband|spouse|boyfriend|girlfriend|ex|mother|mom|mum|father|dad|sister|brother|friend|boss|coworker|co-worker|colleague|roommate))(?:(?:'s|’s|'re|’re)|\s+(?:is|are))\s+(?:a\s+true\s+|a\s+pure\s+|just\s+|actually\s+|really\s+|basically\s+|simply\s+|clearly\s+|classic\s+|a\s+|an\s+)*(?:generator|projector|reflector|manifesting\s+generator|manifestor)s?\b/i,
    ],
  },
  {
    type: "destiny",
    severity: "high",
    note: "Predicting outcomes or installing destiny is prohibited.",
    patterns: [
      /\b(?:it'?s|this\s+is)\s+(?:your\s+)?(?:destiny|fate)\b/i,
      /\bfated\s+to\b/i,
      /\bdestined\s+to\b/i,
      /\bit\s+was\s+meant\s+to\s+be\b/i,
      /\bwritten\s+in\s+the\s+stars\b/i,
      /\bsoulmate\b/i,
      /\btwin\s+flame\b/i,
      /\bkarma\s+(?:will|has)\b/i,
      /\byou\s+are\s+meant\s+to\s+(?:be\s+with|end\s+up\s+with)\b/i,
      /\bthe\s+universe\s+(?:has|will|wants)\s+you\s+to\b/i,
      /\byou'll\s+(?:always|never)\s+find\b/i,
      /\byou\s+will\s+(?:never|always)\s+(?:be|find|have)\b/i,
    ],
  },
  {
    type: "overvalidation",
    severity: "low",
    note: "Overvalidation and certainty-claims are prohibited.",
    patterns: [
      /\byou(?:'re| are)\s+(?:absolutely|100%|completely|totally|entirely|perfectly)\s+right\b/i,
      /\bthat'?s\s+(?:absolutely|100%|completely|totally|entirely|perfectly)\s+(?:right|correct|true)\b/i,
      /\byou'?re\s+right\s+to\s+feel\b/i,
      /\banyone\s+would\s+feel\b/i,
      /\bthere'?s\s+no\s+question\s+(?:that|about)\b/i,
      /\bobviously\s+(?:you|this|that|they)\b/i,
      /\bwithout\s+(?:any\s+)?doubt\b/i,
      /\bundeniably\b/i,
      /\bno\s+one\s+would\s+blame\s+you\b/i,
      /\beveryone\s+would\s+agree\b/i,
    ],
  },
  {
    type: "prescriptive-authority",
    severity: "medium",
    note: "Commands, shoulds, and prescriptive verdicts are prohibited.",
    patterns: [
      /\byou\s+(?:really\s+|honestly\s+|definitely\s+)?should(?:n'?t)?\b/i,
      /\byou\s+must\b/i,
      /\byou\s+ought\s+to\b/i,
      /\byou\s+have\s+to\b/i,
      /\bwhat\s+you\s+need\s+to\s+do\s+(?:is|now)\b/i,
      /\bleave\s+(?:him|her|them)\b/i,
      /\bbreak\s+up\s+with\s+(?:him|her|them)\b/i,
      /\bdivorce\s+(?:him|her)\b/i,
      /\bcut\s+(?:him|her|them)\s+off\b/i,
      /\bstop\s+helping\s+(?:him|her|them)\b/i,
      /\byou\s+(?:should|must)\s+stop\b/i,
    ],
  },
  {
    type: "unsupported-claim",
    severity: "low",
    note: "Asserting certainty without evidence is prohibited.",
    patterns: [
      /\bthe\s+truth\s+is\b/i,
      /\bthe\s+(?:simple\s+)?fact\s+is\b/i,
      /\bthe\s+reality\s+is\b/i,
      /\bstudies?\s+show\b/i,
      /\bresearch\s+(?:proves?|shows)\b/i,
      /\bscience\s+(?:says|proves)\b/i,
      /\bit'?s\s+proven\b/i,
      /\bit\s+is\s+a\s+fact\b/i,
      /\bdefinitely\s+means\b/i,
      /\bunquestionably\b/i,
      /\bclearly\s+shows?\b/i,
      /\bevidence\s+proves?\b/i,
    ],
  },
  {
    type: "projection-as-fact",
    severity: "medium",
    note: "Naming someone as 'projecting' as a certain fact is prohibited — it can only be offered as one possible interpretation.",
    patterns: [
      /\b(?:is|are)\s+(?:definitely\s+|clearly\s+|just\s+|simply\s+|obviously\s+)?project(?:ing|ion)\b/i,
      /\b(?:they|he|she)(?:'re|’re|\s+are|\s+is)\s+projecting\b[^.!?]{0,24}?\b(?:onto|on\s+to)\b/i,
      // Bare verb form: "He projects his guilt onto you" — the same verdict
      // without a "is/are" helper.
      /\b(?:they|he|she)\s+projects?\b[^.!?]{0,24}?\b(?:onto|on\s+to)\b/i,
    ],
  },
  {
    type: "fixed-family-role",
    severity: "high",
    note: "Installing a family role as fixed identity is prohibited — the role can be named as experienced, never as what someone is.",
    patterns: [
      /\b(?:you\s+(?:are|were|'re|’re)|they\s+made\s+you)\s+(?:the\s+)?(?:scapegoat|golden\s+child|family\s+fixer|identified\s+patient|peacekeeper)\b/i,
      /\bcast\s+you\s+as\s+the\s+(?:scapegoat|golden\s+child|family\s+fixer|identified\s+patient|peacekeeper)\b/i,
    ],
  },
  {
    type: "spiritual-causation",
    severity: "high",
    note: "Claiming a spiritual, ancestral, or curse-based cause as certain is prohibited.",
    patterns: [
      /\b(?:literal|real|ancestral|generational)\s+curse\b/i,
      /\b(?:God|the\s+universe|your\s+bloodline|your\s+ancestors?)\s+(?:caused|is\s+causing|is\s+forcing|wants|made)\b/i,
      /\blow\s+frequency\b/i,
    ],
  },
  {
    type: "therapy-claim",
    severity: "high",
    note: "Presenting this tool as therapy or treatment — or promising that therapy or anything will cure — is prohibited.",
    patterns: [
      /\b(?:as\s+your\s+therapist|acting\s+as\s+your\s+(?:therapist|counselor|counsellor))\b/i,
      /\b(?:therap(?:y|ist)|counsel(?:ing|ling)|treatment)\s+will\s+(?:fix|heal|cure|solve|resolve|change)\b/i,
      /\bthis\s+will\s+heal\s+your\s+trauma\b/i,
      /\bI\s+can\s+(?:treat|cure|diagnose)\b/i,
    ],
  },
  {
    type: "institutional-tone",
    severity: "low",
    note: "Canned institutional phrasing is prohibited — write in the product's own plain voice.",
    patterns: [
      /\bas\s+an\s+ai\b/i,
      /\binsufficient\s+data\b/i,
      /\bthe\s+subject\s+presents\b/i,
      /\bit\s+is\s+recommended\s+that\b/i,
    ],
  },
  {
    type: "excessive-disclaimer",
    severity: "low",
    skipNegationLookback: true,
    note: "Repeated disclaimers in a row read as defensive and cold; one honest limit statement is enough.",
    patterns: [
      /\bi\s+(?:cannot|can'?t)\b[^.!?]{0,160}[.!?]\s*\bi\s+(?:cannot|can'?t)\b/i,
    ],
  },
];

function containsNegative(text: string): boolean {
  const tokens = text.toLowerCase().split(/[^a-z']+/).filter(Boolean);
  return tokens.some((t) => NEGATIVES.has(t));
}

function flagged(
  text: string,
  rule: LexiconRule,
): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const body = text.toLowerCase();
  for (const pattern of rule.patterns) {
    const matches = typeof pattern === "string"
      ? (() => {
          const idx = body.indexOf(pattern.toLowerCase());
          return idx === -1 ? [] : [{ index: idx, length: pattern.length }];
        })()
      : (() => {
          const re = pattern.flags.includes("g") ? pattern : new RegExp(pattern.source, pattern.flags + "g");
          return [...body.matchAll(re)].map((m) => ({
            index: m.index ?? -1,
            length: m[0].length,
          }));
        })();
    for (const match of matches) {
      if (match.index === -1) continue;
      const before = body.slice(Math.max(0, match.index - 40), match.index);
      const inside = body.slice(match.index, match.index + Math.min(match.length, 60));
      // Negation DIRECTLY before the claim cancels it (e.g. "I can't
      // determine whether he is trying to hurt you"). Rules whose own wording
      // contains negation opt out — for them the look-back window is part of
      // the violation itself, not a hedge around it.
      if (!rule.skipNegationLookback && containsNegative(before)) continue;
      // Negation INSIDE the claim only cancels identity-style wording
      // ("you are NOT the problem"). For inner-world claims the negative is
      // itself the assertion ("she doesn't care about you").
      if (rule.insideNegativeSkips === true && containsNegative(inside)) continue;
      violations.push({
        type: rule.type,
        severity: rule.severity,
        matchedText: text.slice(match.index, match.index + Math.min(match.length, 80)).trim(),
        note: rule.note,
      });
      // One flagged span per rule keeps repair instructions bounded.
      break;
    }
    if (violations.length) return violations;
  }
  return violations;
}

const LEAK_MARKERS: RegExp[] = [
  /\bAPPLICATION REASONING CONTEXT\b/i,
  /\bBASELINE CONTEXT \(derived signals/i,
  /\bMEANING TARGETS \(loaded concepts/i,
  /\bUNKNOWNS \(do not resolve/i,
  /\bREJECTED HYPOTHESES \(do NOT re-assert/i,
  /\bQUESTION LEVEL\b/i,
  /\bUSER DEFINITIONS\b/i,
  /\breasoning context\b/i,
  /\bepistemic status\b/i,
  // Internal enum tokens and derived-data labels never occur in natural prose;
  // if the model echoes them ("your baseline-supported signals", "derived
  // baseline") it is leaking the reasoning layer and must be repaired.
  /\b(?:baseline-supported|model-hypothesis|user-interpretation)\b/i,
  /\bderived (?:baseline|signals?|summaries?)\b/i,
];

function detectLeakage(text: string): { index: number; length: number } | null {
  const lower = text.toLowerCase();
  for (const re of LEAK_MARKERS) {
    const match = lower.match(re);
    if (match && match.index !== undefined) {
      return { index: match.index, length: match[0].length };
    }
  }
  return null;
}

export function validateSovereignText(
  text: string,
  ctx?: Pick<ReasoningContext, "correctionState">,
): SafetyValidation {
  if (!text || text.trim().length === 0) {
    return { allowed: false, violations: [{ type: "unsupported-claim", severity: "low", matchedText: "", note: "Empty response is not allowed." }] };
  }

  // Never expose the reasoning system's internal context in user-visible text.
  const leak = detectLeakage(text);
  if (leak) {
    return {
      allowed: false,
      violations: [{
        type: "unsupported-claim",
        severity: "high",
        matchedText: text.slice(leak.index, leak.index + leak.length).trim(),
        note: "The response leaks the reasoning system's internal context; rewrite wholly without that structure.",
      }],
    };
  }

  const violations: SafetyViolation[] = [];
  for (const rule of LEXICON) {
    violations.push(...flagged(text, rule));
  }

  // Re-asserting a hypothesis the user rejected must be blocked.
  const correctionState = ctx?.correctionState;
  if (correctionState?.rejectedHypotheses.length) {
    for (const rejected of correctionState.rejectedHypotheses) {
      const a = normalizePhrase(rejected);
      const b = normalizePhrase(text);
      if (a.length >= 5 && b.includes(a)) {
        violations.push({
          type: "unsupported-claim",
          severity: "high",
          matchedText: rejected.slice(0, 80),
          note: "This re-asserts a hypothesis the user already rejected.",
        });
      }
    }
  }

  return { allowed: violations.length === 0, violations };
}

function normalizePhrase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// ── High-risk routing ─────────────────────────────────────────────────

const ESCALATE_PATTERNS = [
  /\bkill\s+myself\b/i,
  /\bsuicide\b/i,
  /\bsuicid(?:al|ality)\b/i,
  /\bend\s+my\s+life\b/i,
  /\bend\s+it\s+all\b/i,
  /\bhurt\s+myself\b/i,
  /\bself[- ]harm\b/i,
  /\bself-?harm(?:ing|ed)?\b/i,
  /\bdon'?t\s+want\s+to\s+(?:go\s+on|live)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bwish\s+I\s+were\s+dead\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\btake\s+my\s+(?:own\s+)?life\b/i,
  /\bbed\s+myself\s+up\b/i,
  /\bending\s+(?:my\s+)?life\b/i,
  // Spanish crisis disclosures (kept to unmistakable phrasings; accented and
  // unaccented forms both match, since typing without accents is common).
  /\b(?:quiero|voy\s+a|pienso)\s+(?:morir|suicidarme|matarme)\b/i,
  /\bno\s+quiero\s+(?:vivir|seguir\s+(?:viviendo|adelante)|seguir)\b/i,
  /\bme\s+quiero\s+(?:matar|suicidar)\b/i,
  /\bacabar\s+con\s+mi\s+vida\b/i,
  /\bquitarme\s+la\s+vida\b/i,
  /\bno\s+tengo\s+(?:razones|motivos|ganas)\s+(?:de|para)\s+vivir\b/i,
  /\b(?:me\s+hago\s+(?:daño|dano)|hacerme\s+(?:daño|dano)|autolesion(?:arme|es)?)\b/i,
  /\bsuicidio\b|\bpensamientos\s+suicidas\b/i,
  // French crisis disclosures (both straight and typographic apostrophes).
  /\bje\s+(?:veux|vais)\s+(?:me\s+tuer|me\s+suicider)\b/i,
  /\bje\s+veux\s+mourir\b/i,
  /\bje\s+ne\s+veux\s+plus\s+(?:vivre|continuer)\b/i,
  /\b(?:mettre\s+fin\s+à\s+mes\s+jours|mettre\s+un\s+terme\s+à\s+ma\s+vie|en\s+finir\s+avec\s+la\s+vie)\b/i,
  /\b(?:automutilation|plus\s+de\s+raison\s+de\s+vivre)\b/i,
  /\b(?:je\s+ne\s+vois\s+plus\s+d['’]avenir|je\s+suis\s+fatigu[ée]e?\s+de\s+vivre)\b/i,
  /\bpens[ée]es\s+suicidaires\b/i,
];

const GROUNDED_PATTERNS = [
  /\b(?:sexual(?:ly)?\s+)?abuse(?:d|ive)?\b/i,
  /\braped\b/i,
  /\bmolest(?:ed|ation)?\b/i,
  /\bdomestic\s+violence\b/i,
  /\bhit\s+me\b(?!\s+with\s+an\s+(?:idea|emotion))/i,
  // Bare verb+me forms are ambiguous in writing, so this rule stays silent
  // unless the sentence is unambiguous physical violence — a clear past/passive
  // act ("I was hit", "he knocked me down"), a non-idiomatic verb ("strangles
  // me"), or a verb that can't parse as emotional hurt ("slaps me"). "Did he
  // mean to hurt me?" and "she hurts my feelings" must NOT route a plain
  // relationship question to the DV script. Named-abuser disclosures are
  // covered by the next rule; sexual-abuse and "hit me with an idea"-style
  // idioms keep their own dedicated handling.
  /\b(?:hits?|slaps?|punch(?:es|ed)?|kicks?|strangl(?:es|ed)|chokes?|shoves)\s+me\b/i,
  /\bwas\s+(?:hit|beaten|strangled|choked|knocked\s+down|slapped|punched|kicked|burned)\b/i,
  /\b(?:beat|beats|hit|hits)\s+me\s+(?:up\b|with\b|by\b|when\b|and\b|black(?:ed|s)?\b|knocks?\b)/i,
  /\b(?:my\s+)?(?:ex(?:-\w+)?|partner|husband|wife|boyfriend|girlfriend|dad|father|mom|mother|stepdad|stepmom|parent)\s+(?:hits?|beats?|hurts?|pushes|slaps|abuses|abused)\s+me\b/i,
  /\b(?:he|she|they)(?:'s|\s+is|\s+was)?\s+hurts?\s+me\b/i,
  /\bforced\s+me\s+to\b/i,
  /\b(?:touches?|touched)\s+me\s+without\s+(?:my\s+)?consent\b/i,
  /\bwas\s+(?:sexually\s+)?abused\b/i,
  /\b(?:childhood|growing\s+up)(?:\s+\w+)?\s+(?:abuse|trauma)\b/i,
  /\bmy\s+ex\s+(?:hit|beat|abused|stalked)\s+me\b/i,
  // Spanish abuse/violence disclosures (physical or unambiguous; accented and
  // unaccented forms both match). Note: JS \b treats accented finals like ó as
  // non-word, so accented past-tense verbs use (?!\S) instead of a trailing \b.
  /\bme\s+(?:pega|golpea|empuja|ahorca|estrangula)\b/i,
  /\bme\s+(?:peg[oó]|golpe[oó]|empuj[oó]|ahorc[oó])(?!\S)/i,
  /\b(?:fui\s+golpead[oa]|me\s+han\s+golpeado|fui\s+agredid[oa])\b/i,
  /\bme\s+oblig(?:a|ó|o)\s+(?:a\s+acostarme|a\s+tener\s+sexo|a\s+hacer\s+algo\s+sexual)\b/i,
  /\bme\s+toc(?:a|ó|o)\s+sin\s+(?:mi\s+)?(?:consentimiento|permiso)\b/i,
  /\bno\s+me\s+deja\s+salir\b/i,
  /\b(?:violencia\s+dom[eé]stica|maltrat(?:o|a))\b/i,
  /\b(?:abus(?:o\s+sexual|ad[oa])|fui\s+violad[oa])\b/i,
  /\bme\s+viol(?:a|ó|o)(?!\S)/i,
  /\b(?:acoso|me\s+acosa)\b/i,
  // French abuse/violence disclosures (both apostrophe forms).
  /\bil\s+me\s+(?:bat|tape|frappe|frappait|pousse|étrangle)\b/i,
  /\bil\s+m['’]a\s+(?:frapp[ée]e?|battue?|pouss[ée]e?|viol[ée]e?)\b/i,
  /\bje\s+suis\s+(?:battue?|frapp[ée]e?|viol[ée]e?)\b/i,
  /\b(?:violence\s+domestique|maltraitance)\b/i,
  /\bil\s+me\s+force\s+(?:à\s+(?:avoir\s+des\s+rapports\s+sexuels|faire\s+quelque\s+chose\s+de\s+sexuel))\b/i,
  /\b(?:ne\s+me\s+laisse\s+pas\s+partir|m['’]oblige\s+à\s+avoir\s+des\s+rapports)\b/i,
  /\bil\s+me\s+touche\s+sans\s+(?:mon\s+)?consentement\b/i,
  /\b(?:me\s+harc[èe]le|harc[ée]l(?:ement|é|ée))(?!\S)/i,
  /\babus\s+sexuel\b/i,
];

export function detectSafetyMode(messages: ChatMessage[]): SafetyMode {
  // Only the user's turns carry disclosure intent. The assistant's own
  // safety/helpline text repeats crisis and abuse words, so scanning it would
  // let our prior reply re-trigger the gate on an unrelated later turn.
  const userTurns = messages.filter((m) => m.role === "user");
  const userText = userTurns.map((m) => m.content).join("\n");
  // Crisis stays conservative and thread-wide: any self-harm signal from the
  // user in the retained thread keeps routing to resources. Erring toward help
  // here is intentional and is never loosened for answer quality.
  if (ESCALATE_PATTERNS.some((p) => p.test(userText))) return "escalate";
  // Abuse/grounding is scoped to the CURRENT user turn. A disclosure is
  // acknowledged + redirected on the turn it appears; once the conversation
  // moves to an unrelated, safe question, inference resumes rather than
  // freezing forever. A fresh disclosure in the current turn still fires.
  const currentTurn = userTurns.length > 0 ? userTurns[userTurns.length - 1].content : "";
  if (GROUNDED_PATTERNS.some((p) => p.test(currentTurn))) return "grounded";
  return "standard";
}

/**
 * Pre-model prompt-injection / system-prompt-extraction detector.
 *
 * The Engine's system prompt and derivation rules are the product's core IP
 * (Terms §5/§7). A request that reads like it is trying to lift them out —
 * "ignore previous instructions", "print your system prompt", "repeat the
 * words above starting with You are", "dump buildSystemPrompt" — is answered
 * with a calm deflection BEFORE any model call: zero tokens spent, zero IP
 * leaked. Deliberately narrow: it fires on extraction/injection shapes, not
 * on a person sincerely asking what the tool is or how it works in general
 * terms (that conversation belongs to /faq and /support, and the model can
 * handle it inside its prompt without ever revealing the prompt itself).
 */
const EXTRACTION_PATTERNS = [
  // Classic instruction-override injections, with a payload noun in reach.
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|your)\s+(?:instructions?|rules?|prompts?|directives?|guidelines?|context)\b/i,
  // Direct asks to reveal the system prompt or internal rules.
  /\b(?:print|show|reveal|display|output|repeat|dump|leak|paste)\s+(?:me\s+)?(?:your|the|any)\s+(?:hidden\s+|secret\s+|internal\s+)?(?:system\s+prompts?|prompt|instructions?|rules?|guidelines?|directives?)\b/i,
  // "Repeat everything above" family, including the starting-words variant.
  /\brepeat\s+(?:everything|all\s+(?:of\s+)?this|the\s+(?:text|words|content|message)s?\s+above|what\s+(?:comes|is)\s+above)\b/i,
  /\b(?:above|previous|earlier)\s+(?:text|words|content|instructions?|prompt)s?\b.{0,40}\b(?:starting|beginning)\s+with\b/i,
  /\bstarting\s+with\s+["'`]?\s*you\s+are\b/i,
  // Naming internal symbols or the prompt machinery itself.
  /\b(?:buildSystemPrompt|sovereign-prompt|systemPrompt|system_prompt)\b/i,
  // Role/identity overrides aimed at unhinging the guardrails.
  /\b(?:you\s+are\s+now|pretend\s+(?:to\s+be|you(?:'re|\s+are)))\s+[^.]{0,60}\b(?:unrestricted|unfiltered|jailbreak|dan|no\s+rules?|developer\s+mode)/i,
  /\b(?:enter|switch\s+(?:to|into)|enable)\s+(?:developer|debug|god|jailbreak|unrestricted)\s+mode\b/i,
];

export function detectExtractionAttempt(messages: ChatMessage[]): boolean {
  // Only the human turns carry intent to extract; assistant text is our own.
  const text = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  return EXTRACTION_PATTERNS.some((p) => p.test(text));
}

/** The deflection the chat route streams in place of a model call. Grounded,
 *  in voice, and it confirms nothing about what lies behind the curtain. */
export function buildExtractionDeflection(): string {
  return [
    "I won't reproduce my internal instructions — what shapes how I answer is part of the tool, and the invitation to lift it out isn't one I take.",
    "",
    "What I can tell you plainly: this is a self-reflection space, your answers are grounded in your own Baseline and what you've shared, and nothing here is a substitute for professional care. If you're curious how Sovereign works at a high level, the FAQ and the Terms say what I can honestly say.",
    "",
    "If there's something real you want to look at — a dynamic, a relationship, a decision — I'm right here for that.",
  ].join("\n");
}

/**
 * Pre-model cross-account data-request detector.
 *
 * The thread loader already scopes every read to the authenticated caller
 * (Gate 34 proves a stranger's session cannot reach another account's rows),
 * so this is defence in depth for the ASK itself: a request shaped like
 * "show me another user's baseline" or "dump all users" is refused before any
 * model tokens are spent, rather than relying on the loader to return an empty
 * result the model might then narrate around. Deliberately narrow — it fires
 * on other-people's-private-data and bulk-dump shapes, never on the ordinary
 * relationship questions ("how might another person see this", "my partner's
 * side") that are the product. Consented peer summaries are assembled through
 * buildConsentedPeers and never reach here as a match.
 */
const CROSS_ACCOUNT_PATTERNS = [
  // "another/other/someone else's" (+ optional user/account/person) + a private-data noun.
  /\b(?:another|other|someone\s+else|somebody\s+else|anyone\s+else)(?:\s+(?:user|account|person|people|member|customer|client))?\s*(?:'?s|s')\s+(?:baseline|data|thread|conversation|message|chart|record|profile|email|password|login)s?\b/i,
  // "all/every/each/any <user|account|…>'s <private noun>".
  /\b(?:all|every|each|any)\s+(?:registered\s+)?(?:user|account|member|customer|people|person)s?\s*(?:'?s|s')\s+(?:baseline|data|thread|conversation|message|chart|record|profile|email|password|login)s?\b/i,
  // "everyone's <private noun>".
  /\beveryone\s*(?:'?s|s')\s+(?:baseline|data|thread|conversation|message|chart|record|profile|email|password|login)s?\b/i,
  // Exfil verb + collective: "dump all users", "export the entire database".
  /\b(?:dump|export|scrape|harvest|enumerate)\b[^.]{0,30}?\b(?:all|every|the\s+(?:entire|whole|full))\b[^.]{0,30}?\b(?:user|account|baseline|thread|database|customer|member|record|email)s?\b/i,
];

export function detectCrossAccountRequest(messages: ChatMessage[]): boolean {
  // Only the human turns carry intent to exfiltrate; assistant text is our own.
  const text = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  return CROSS_ACCOUNT_PATTERNS.some((p) => p.test(text));
}

/** The deflection the chat route streams in place of a model call for a
 *  cross-account ask. Honest about the boundary, it grants nothing, confirms
 *  nothing about who else is on the platform, and points a genuinely locked-out
 *  person at a human. */
export function buildCrossAccountDeflection(): string {
  return [
    "I can only work with your own account and the people who have chosen to share with you here. Someone else's private data — their Baseline, their threads, their sign-in — isn't something I'll pull up or hand over, to you or to anyone.",
    "",
    "What I can do is look at a relationship through what you've shared and how you experience it. And if you think someone has gotten into your account without permission, the support page tells you how to reach a person about it.",
  ].join("\n");
}

export function buildSafetyResponse(mode: Exclude<SafetyMode, "standard">): string {
  const { resources, selectionNotice } = selectCrisisResources(mode);
  const lines = resources.map((r) => r.line);
  if (mode === "escalate") {
    return [
      "Thank you for trusting me with this. I'm not equipped to analyze what you're going through — and right now, what matters most is that you're not alone in it.",
      "",
      "If you are thinking about ending your life, please reach out now — you don't carry this alone:",
      ...lines,
      "",
      selectionNotice,
      "",
      "A counselor or care provider is the right person to help with what you're feeling. I'm still here for exploring what keeps happening and what it means when you want to talk something through — gently, and at your pace.",
    ].join("\n");
  }
  return [
    "Thank you for telling me what you've experienced. I'm a non-clinical reflection tool, and I am not able to analyze a situation involving abuse or violence — that deserves trained, professional support, and it is not yours to carry in isolation.",
    "",
    "Please reach out to a professional or helpline you trust:",
    ...lines,
    "",
    selectionNotice,
    "",
    "If you are in immediate danger, local emergency services can help. I'm still here for exploring what keeps happening and what it means at other times.",
  ].join("\n");
}

/**
 * Deterministic brand-lexicon scrub for the final model answer. The nouns here
 * are banned in user-facing copy (see AGENTS.md / BRAND.md). The small model
 * still reaches for "pattern" even after the system-prompt steering, and unlike
 * the semantic safety lexicon — where a blind swap could change meaning and must
 * go through repair/fallback — a pure synonym substitution of these words is
 * safe to apply directly to validated text: "dynamic"/"tension"/"celestial" are
 * never themselves prohibited, so this can't introduce a violation. Applied to
 * the validated answer in the generation pipeline before it is stored/streamed.
 */
const BRAND_SYNONYMS: Array<{ re: RegExp; out: string }> = [
  { re: /\bPatterns\b/g, out: "Dynamics" },
  { re: /\bPATTERNS\b/g, out: "DYNAMICS" },
  { re: /\bpatterns\b/g, out: "dynamics" },
  { re: /\bPattern\b/g, out: "Dynamic" },
  { re: /\bPATTERN\b/g, out: "DYNAMIC" },
  { re: /\bpattern\b/g, out: "dynamic" },
  { re: /\bFriction\b/g, out: "Tension" },
  { re: /\bfriction\b/g, out: "tension" },
  { re: /\bNatal\b/g, out: "Celestial" },
  { re: /\bnatal\b/g, out: "celestial" },
  { re: /\bEphemeris\b/g, out: "Planetary data" },
  { re: /\bephemeris\b/g, out: "planetary data" },
];

export function scrubBrandVocabulary(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, out: replacement } of BRAND_SYNONYMS) out = out.replace(re, replacement);
  return out;
}

export function buildGroundedFallback(): string {
  return [
    "I want to be careful with what I say here. There are claims in that response I can't support from what you've shared, so I won't repeat them as fact.",
    "",
    "What I can do is help you examine the parts that are actually knowable: what happened, what you made it mean, and what is yours to decide regardless. One possibility worth examining is still open, if you want to look at it together. Could you tell me a little more about what happened — and what you made it mean?",
  ].join("\n");
}

export function buildRepairInstruction(violations: SafetyViolation[]): string {
  const lines = (
    "Your previous response contained content that violates this system's safety rules. "
    + "Rewrite the entire response so that EACH of the following is satisfied:"
  );
  const bullets = violations
    .slice(0, 4)
    .map((v) => `- Fix: ${v.note} (something like "${v.matchedText.trim().slice(0, 60)}" is not allowed).`);
  return [lines, ...bullets, "- Keep the genuinely helpful parts that remain valid; do not discard the whole response."].join("\n");
}