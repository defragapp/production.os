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
    note: "Presenting Baseline as fixed identity, destiny, or instruction is prohibited.",
    patterns: [
      /\byour\s+baseline\s+(?:says|predicts|determines|destines|means)\s+you\b/i,
      /\baccording\s+to\s+your\s+baseline[,]?\s+you(?:'re| are)\s+\w+\b/i,
      /\byour\s+baseline\s+shows\s+you\s+are\s+(\w+\s+\w+)?\b/i,
      /\byour\s+human\s+design\s+(?:says|means|determines|makes)\s+you\b/i,
      /\byour\s+life\s+path\s+(?:means|determines|predestines|destines)\s+you\b/i,
      /\bhuman\s+design\s+dictates\b/i,
      /\byou\s+are\s+(?:a\s+)?(?:pure\s+)?generator\b.*\bso\s+you\s+should\b/i,
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
      // determine whether he is trying to hurt you").
      if (containsNegative(before)) continue;
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

export function validateSovereignText(
  text: string,
  ctx?: Pick<ReasoningContext, "correctionState">,
): SafetyValidation {
  if (!text || text.trim().length === 0) {
    return { allowed: false, violations: [{ type: "unsupported-claim", severity: "low", matchedText: "", note: "Empty response is not allowed." }] };
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
];

const GROUNDED_PATTERNS = [
  /\b(?:sexual(?:ly)?\s+)?abuse(?:d|ive)?\b/i,
  /\braped\b/i,
  /\bmolest(?:ed|ation)?\b/i,
  /\bdomestic\s+violence\b/i,
  /\bhit\s+me\b(?!\s+with\s+an\s+(?:idea|emotion))/i,
  /\b(?:hits|hit|beat|beats|beaten|slapped|slaps|punched|kicks|kicked|strangled|hurt)\s+(?:me|my)\b/i,
  /\bmy\s+(?:partner|husband|wife|boyfriend|girlfriend|dad|father|mom|mother|stepdad|stepmom|parent)\s+(?:hits|hits?|beat|beats|hurts?|pushes|slaps|abuses|abused)\b/i,
  /\bforced\s+me\s+to\b/i,
  /\b(?:touches?|touched)\s+me\s+without\s+(?:my\s+)?consent\b/i,
  /\bwas\s+(?:sexually\s+)?abused\b/i,
  /\b(?:childhood|growing\s+up)(?:\s+\w+)?\s+(?:abuse|trauma)\b/i,
  /\bmy\s+ex\s+(?:hit|beat|abused|stalked)\s+me\b/i,
];

export function detectSafetyMode(messages: ChatMessage[]): SafetyMode {
  const text = messages.map((m) => m.content).join("\n");
  if (ESCALATE_PATTERNS.some((p) => p.test(text))) return "escalate";
  if (GROUNDED_PATTERNS.some((p) => p.test(text))) return "grounded";
  return "standard";
}

export function buildSafetyResponse(mode: Exclude<SafetyMode, "standard">): string {
  if (mode === "escalate") {
    return [
      "Thank you for trusting me with this. I'm not equipped to analyze what you're going through — and right now, what matters most is that you're not alone in it.",
      "",
      "If you are thinking about ending your life, please reach out now — you don't carry this alone:",
      "- US: National Suicide Prevention Lifeline — call or text 988 (988lifeline.org)",
      "- US: Crisis Text Line — text HOME to 741741",
      "- Canada: call or text 988",
      "- UK: Samaritans — call 116 123",
      "- International: find help near you at findahelpline.com",
      "",
      "A counselor or care provider is the right person to help with what you're feeling. I'm still here for exploring patterns and meaning when you want to talk something through — gently, and at your pace.",
    ].join("\n");
  }
  return [
    "Thank you for telling me what you've experienced. I'm a non-clinical reflection tool, and I am not able to analyze a situation involving abuse or violence — that deserves trained, professional support, and it is not yours to carry in isolation.",
    "",
    "Please reach out to a professional or helpline you trust:",
    "- US: National Domestic Violence Hotline — call 800-799-7233 or text START to 88788 (thehotline.org)",
    "- Canada: Crisis Services Canada — 800-363-9010 (crisisservicescanada.ca)",
    "- UK: National Domestic Abuse Helpline — 0808 2000 247 (nationaldahelpline.org.uk)",
    "",
    "If you are in immediate danger, local emergency services can help. I'm still here for exploring patterns and meaning at other times.",
  ].join("\n");
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