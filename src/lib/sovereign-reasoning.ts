/**
 * Sovereign Reasoning — conservative classification, meaning detection,
 * context building, and the generation → validation → repair pipeline.
 *
 * The context here is internal. It is composed server-side from server-owned
 * signals (Baseline) plus what the user described — never from raw Baseline
 * JSON and never from client-supplied "system" messages.
 */

import type { DerivedBaseline } from "./sovereign-prompt";
import { buildSystemPrompt } from "./sovereign-prompt";
import { buildBaselineSignals, buildBaselineLimitations } from "./sovereign-baseline";
import {
  buildGroundedFallback,
  buildRepairInstruction,
  buildSafetyResponse,
  detectSafetyMode,
  validateSovereignText,
} from "./sovereign-safety";
import type { SovereignModel } from "./sovereign-model";
import type { ChatMessage } from "./types";
import type {
  AuthorizationContext,
  BaselineSignal,
  CorrectionState,
  Domain,
  ExpressionCandidate,
  ConsequenceCandidate,
  Hypothesis,
  MeaningTarget,
  ModelInput,
  Observation,
  PatternCandidate,
  ReasoningClassification,
  ReasoningContext,
  RelationshipScope,
  SovereignGenerationResult,
  SovereignResponsePlan,
  Unknown,
} from "./sovereign-types";

const MAX_CONTEXT_MESSAGES = 20;

// ── Meaning triggers (from the reasoning model spec) ──────────────────

export const MEANING_TRIGGERS = [
  "love", "success", "failure", "enough", "respect", "loyalty", "responsibility",
  "safety", "trust", "family", "commitment", "freedom", "helping", "fairness",
  "betrayal", "abandonment", "control", "strength", "weakness", "independence",
  "being needed", "being good", "being selfish",
] as const;

function triggerRegex(concept: string): RegExp {
  if (concept === "helping") return /\bhelp(?:ing|ed|s)?\b/i;
  return new RegExp(`\\b${concept.replace(/\s+/g, "\\s+")}\\b`, "i");
}

export function findMeaningTriggers(text: string): string[] {
  const hits = new Set<string>();
  for (const concept of MEANING_TRIGGERS) {
    if (triggerRegex(concept).test(text)) hits.add(concept);
  }
  return [...hits];
}

const USER_DEFINITION_PATTERNS = [
  /([a-z]+)\s+(?:means|mean)\s+(?:to\s+me|for\s+me)\s+([^.!?]+)/gi,
  /for\s+me[,]?\s+([a-z]+)\s+(?:is|means)\s+([^.!?]+)/gi,
  /([a-z]+)\s+is\s+([^.!?]{4,})\s+to\s+me/gi,
];

export function extractUserDefinitions(conversationText: string): Record<string, string> {
  const defs: Record<string, string> = {};
  for (const rx of USER_DEFINITION_PATTERNS) {
    for (const m of conversationText.matchAll(rx)) {
      const concept = m[1].toLowerCase();
      const definition = m[2].trim();
      if (concept && definition && definition.length >= 3) defs[concept] = definition;
    }
  }
  return defs;
}

export function detectMeaningTargets(
  latestUserContent: string,
  conversationText: string,
): MeaningTarget[] {
  const userDefinitions = extractUserDefinitions(conversationText);
  const targets: MeaningTarget[] = [];
  for (const concept of findMeaningTriggers(latestUserContent)) {
    const definition = userDefinitions[concept];
    const exists = typeof definition === "string";
    targets.push({
      concept,
      definitionKnown: exists,
      materiallyRelevant: true,
      ...(exists ? { userDefinition: definition } : {}),
      ...(exists && typeof definition === "string"
        ? { clarificationQuestion: `Is what you mean by ${concept} the same as: "${definition}"?` }
        : { clarificationQuestion: `What does ${concept} mean to you?` }),
    });
  }
  return targets;
}

// ── Classification ────────────────────────────────────────────────────

const SELF_CUES = [
  /\bam\s+I\b/i,
  /\bwhy\s+am\s+I\b/i,
  /\bwhat\s+kind\s+of\s+person\b/i,
  /\bhuman\s+design\b/i,
  /\bbaseline\b/i,
  /\bmy\s+chart\b/i,
  /\bI\s+always\b/i,
  /\bI\s+tend\s+to\b/i,
  /\bI\s+find\s+myself\b/i,
  /\bI\s+keep\s+doing\b/i,
  /\bwh(?:y|at)\s+do\s+I\b/i,
];

const BETWEEN_PERSON_CUES = [
  /\b(?:my\s+)?(?:partner|husband|wife|spouse|fianc(?:é|e)|boyfriend|girlfriend|ex|ex-husband|ex-wife|date)\b/i,
  /\b(?:my|the)\s+(?:mom|mum|mother|dad|father|stepdad|stepmom|sister|brother|son|daughter|sibling|friend|best\s+friend|boss|coworker|co-worker|colleague|team|neighbor)\b/i,
  /\b(?:between\s+us|us\b.*\bthem)\b/i,
  /\brelationship\b/i,
  /\bmarried\b/i,
  /\bdating\b/i,
  /\b(?:he\s+|she\s+|him\b|her\b|they\b|\btheirs\b|\bwomen\b|\bmen\b)\b/i,
  /\b(?:mom|mother|dad|father|mommy|daddy|papa|mama)\b/i,
  /\bmy\s+kids?\b/i,
  /\bin-?laws\b/i,
  /\bwith\s+people\b/i,
  /\bhelp(?:ing)?\s+(?:him|her|them)\b/i,
];

const SYSTEM_CUES = [
  /\bmy\s+family\b/i,
  /\bmy\s+whole\s+family\b/i,
  /\bthe\s+whole\s+family\b/i,
  /\bmy\s+parents\b/i,
  /\bmy\s+siblings\b/i,
  /\bin-?laws\b/i,
  /\bthe\s+couple\b/i,
  /\bthe\s+group\b/i,
  /\bthe\s+team\b/i,
  /\b(?:everyone|everybody)\b/i,
  /\ball\s+of\s+us\b/i,
  /\bbetween\s+(?:them|each\s+other)\b/i,
  /\bthe\s+family\s+system\b/i,
  /\bsystem\b/i,
  /\bthree\s+of\s+us\b/i,
];

const CHOICE_CUES = [
  /\bshould\s+(?:I|we)\b/i,
  /\bwhat\s+should\b/i,
  /\bdecision\b/i,
  /\bchoose\b/i,
  /\bwhat\s+to\s+do\b/i,
  /\bstay\s+or\s+leave\b/i,
  /\bbreak\s+up\b/i,
  /\bfigure\s+out\s+what\s+I\s+want\b/i,
];

const INNER_WORLD_CUES = [
  /\b(?:why|how)\s+(?:do|does)\s+(?:he|she|they)\b/i,
  /\b(?:does|did)\s+(?:he|she|they)\b/i,
  /\b(?:is|was)\s+(?:he|she|they)\s+(?:really|actually|secretly|in\s+love)\b/i,
  /\b(?:what|how)\s+(?:is|was)\s+(?:he|she|they)\s+(?:feeling|thinking)\b/i,
  /\bthey\s+mean\b/i,
  /\b(?:does|did)\s+he\s+actually\b/i,
  /\bwhat\s+(?:does|did)\s+it\s+say\s+about\s+their\b/i,
];

const FUTURE_CUES = [
  /\bwill\s+I\b/i,
  /\bam\s+I\s+going\s+to\b/i,
  /\bis\s+this\s+going\s+to\b/i,
  /\bwill\s+(?:this|it|they)\b/i,
  /\bis\s+it\s+destin(?:ed|y)\b/i,
  /\bwill\s+it\s+always\b/i,
  /\bare\s+we\s+going\s+to\b/i,
  /\bam\s+I\s+ever\b/i,
];

export function classifyQuestion(latestUserContent: string): ReasoningClassification {
  const domains = new Set<Domain>([]);
  let level: 1 | 2 | 3 | 4 = 1;

  const selfHit = SELF_CUES.some((rx) => rx.test(latestUserContent));
  const meaningHits = findMeaningTriggers(latestUserContent);
  const betweenHit = BETWEEN_PERSON_CUES.some((rx) => rx.test(latestUserContent));
  const systemHit = SYSTEM_CUES.some((rx) => rx.test(latestUserContent));
  const choiceHit = CHOICE_CUES.some((rx) => rx.test(latestUserContent));

  if (selfHit) domains.add("you");
  if (systemHit) domains.add("system");
  if (choiceHit) domains.add("choice");
  if (betweenHit) domains.add("between");
  if (meaningHits.length > 0) domains.add("meaning");

  const meaningRelevant = meaningHits.length > 0;
  const baselineRelevant = domains.has("you");

  if (systemHit) level = 4;
  else if (betweenHit) level = 3;
  else if (meaningRelevant) level = 2;
  else if (selfHit) level = 1;

  return {
    level,
    domains: [...domains],
    meaningRelevant,
    baselineRelevant,
    safetyMode: detectSafetyMode([{ role: "user", content: latestUserContent }]),
  };
}

// ── Corrections ───────────────────────────────────────────────────────

const REJECTION_CUES = [
  /\bno[,.]?\s+that'?s?\b/i,
  /\bthat'?s\s+(?:not|wrong|off|incorrect)\b/i,
  /\bnot\s+really\b/i,
  /\bnot\s+quite\b/i,
  /\bi\s+don'?t\s+(?:think|agree|buy)\b/i,
  /\bi\s+disagree\b/i,
  /\bthat\s+doesn'?t\s+(?:fit|resonate|ring\s+true|sound\s+right)\b/i,
  /\byou'?re\s+wrong\b/i,
  /\byou\s+missed\s+the\s+point\b/i,
  /\bactually[,.]?\s+(?:that'?s\s+(?:not|wrong)|i\s+don'?t)\b/i,
  /\bthat'?s\s+not\s+(?:me|it|what)\b/i,
];

const AFFIRMATION_CUES = [
  /\bexactly\b/i,
  /\bthat'?s\s+(?:right|it)\b/i,
  /\byou'?re\s+right\b/i,
  /\byou\s+nailed\s+it\b/i,
  /\bspot\s+on\b/i,
  /\bprecisely\b/i,
  /\byes[,.]?\s+that'?s\s+it\b/i,
];

const INTERPRETATION_MARKERS = [
  /\bpossibility\b/i,
  /\bworth\s+examining\b/i,
  /\b(?:may|might|could)\s+be\b/i,
  /\bsuggests?\b/i,
  /\bhypothesi(?:s|ze)\b/i,
  /\bperhaps\b/i,
  /\bone\s+reading\b/i,
  /\bindicates?\b/i,
  /\bseems?\s+to\b/i,
  /\bia\s+possibility\b/i,
  /\bcould\s+(?:indicate|mean)\b/i,
];

function sentencesOf(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isInterpretive(sentence: string): boolean {
  return INTERPRETATION_MARKERS.some((rx) => rx.test(sentence));
}

export function scanCorrections(history: ChatMessage[]): CorrectionState {
  const rejectedHypotheses: string[] = [];
  const confirmedInterpretations: string[] = [];
  const recentInterpretive: string[] = [];

  for (const message of history) {
    if (message.role === "assistant") {
      for (const sentence of sentencesOf(message.content)) {
        if (isInterpretive(sentence) && sentence.length < 240) recentInterpretive.push(sentence);
      }
      continue;
    }
    const isRejection = REJECTION_CUES.some((rx) => rx.test(message.content));
    const isAffirmation = AFFIRMATION_CUES.some((rx) => rx.test(message.content));
    if (isRejection && recentInterpretive.length > 0) {
      // Reject the most recent interpretive claim the user is correcting.
      const rejected = recentInterpretive[recentInterpretive.length - 1];
      if (!rejectedHypotheses.includes(rejected)) rejectedHypotheses.push(rejected);
    } else if (isAffirmation && recentInterpretive.length > 0) {
      const confirmed = recentInterpretive[recentInterpretive.length - 1];
      if (!confirmedInterpretations.includes(confirmed)) confirmedInterpretations.push(confirmed);
    }
  }

  return {
    rejectedHypotheses,
    confirmedInterpretations,
    userDefinitions: extractUserDefinitions(history.map((m) => m.content).join("\n")),
  };
}

// ── Patterns, unknowns, expressions/consequences ────────────────────

const REPEATED_CUES = [
  /\balways\b/i,
  /\bnever\b/i,
  /\bevery\s+time\b/i,
  /\beach\s+time\b/i,
  /\brepeatedly\b/i,
  /\bagain\s+and\s+again\b/i,
  /\bkeeps?\s+(?:happening|repeating|pulling|doing|going)\b/i,
  /\bthe\s+same\s+(?:thing|pattern|cycle|story)\b/i,
  /\btime\s+after\s+time\b/i,
  /\bkeeps?\s+going\b/i,
];

const STOPWORDS = new Set([
  "i", "me", "my", "you", "your", "the", "a", "an", "and", "or", "but", "of",
  "to", "for", "with", "in", "on", "at", "it", "this", "that", "what", "why",
  "does", "do", "is", "are", "was", "were", "so", "because", "when", "about",
  "then", "just", "really", "like", "have", "has", "had", "not", "no", "yes",
  "how", "he", "she", "they", "them", "his", "her", "there", "we", "our",
]);

function trigramsOf(content: string): string[] {
  const words = content.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  const grams: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    const gram = words.slice(i, i + 3).join(" ");
    if (!gram.split(" ").every((w) => STOPWORDS.has(w))) grams.push(gram);
  }
  return grams;
}

function conversationSupportedPattern(history: ChatMessage[]): string | null {
  const userCounts = new Map<string, number>();
  for (const m of history) {
    if (m.role !== "user") continue;
    const grams = trigramsOf(m.content);
    const seen = new Set<string>();
    for (const g of grams) {
      if (seen.has(g)) continue;
      seen.add(g);
      userCounts.set(g, (userCounts.get(g) ?? 0) + 1);
    }
  }
  for (const [gram, count] of userCounts) {
    if (count >= 2) return gram;
  }
  return null;
}

export function scanPatternCandidates(history: ChatMessage[]): PatternCandidate[] {
  const quality: PatternCandidate[] = [];

  for (const m of history) {
    if (m.role !== "user") continue;
    const match = REPEATED_CUES.find((rx) => rx.test(m.content));
    if (!match) continue;
    const description = sentencesOf(m.content)[0] || m.content;
    quality.push({
      description,
      evidence: [m.content.slice(0, 240)],
      recurrence: "reported-repeat",
      confidence: "moderate",
      alternatives: [
        "The same facts can be read differently.",
        "This is a reported pattern, not a fixed rule.",
      ],
      unknowns: ["What would the facts look like if the pattern was not present?"],
    });
  }

  const supported = conversationSupportedPattern(history);
  if (supported && quality.length === 0) {
    quality.push({
      description: `A recurring theme appears across messages: "${supported}"`,
      evidence: history.filter((m) => m.role === "user").map((m) => m.content.slice(0, 240)),
      recurrence: "conversation-supported",
      confidence: "low",
      alternatives: ["Different events may still share only a similar wording, not a shared cause."],
      unknowns: ["Whether the repetition reflects a pattern in life or a pattern in telling."],
    });
  }

  if (quality.length === 0) {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (lastUser && !REPEATED_CUES.some((rx) => rx.test(lastUser.content))) {
      quality.push({
        description: "A single event has been described so far.",
        evidence: [lastUser.content.slice(0, 240)],
        recurrence: "single-event",
        confidence: "low",
        alternatives: ["What appears once is not yet a pattern."],
        unknowns: ["Whether this repeats is unknown."],
      });
    }
  }

  return quality.slice(0, 3);
}

export function scanUnknowns(history: ChatMessage[]): Unknown[] {
  const unknowns: Unknown[] = [];
  const lastMessages = history.slice(-2).filter((m) => m.role === "user");
  const latestText = lastMessages.map((m) => m.content).join(" ");

  if (INNER_WORLD_CUES.some((rx) => rx.test(latestText))) {
    unknowns.push({
      question: "Another person's inner motives or feelings",
      reason: "You can't verify another person's inner world from outside. Only behavior is visible.",
      epistemicStatus: "unknown",
    });
  }
  if (FUTURE_CUES.some((rx) => rx.test(latestText))) {
    unknowns.push({
      question: "What happens next",
      reason: "The future cannot be predicted from available information.",
      epistemicStatus: "unknown",
    });
  }
  return unknowns;
}

export function scanExpressions(history: ChatMessage[]): ExpressionCandidate[] {
  const expressions: ExpressionCandidate[] = [];
  const cues = [
    /\bi\s+tend\s+to\b/i,
    /\bi\s+always\s+(?:end\s+up|find\s+myself|respond|react)\b/i,
    /\bi\s+find\s+myself\b/i,
    /\bi\s+catch\s+myself\b/i,
    /\bi\s+(?:react|respond)\s+by\b/i,
    /\bmy\s+way\s+of\b/i,
    /\bwhen\s+[^.]*\bi\s+(?:so\s+)?(?:shut\s+down|overextend|give\s+in|pull\s+back|jump\s+in)\b/i,
  ];
  for (const m of history) {
    if (m.role !== "user") continue;
    if (cues.some((rx) => rx.test(m.content))) {
      expressions.push({
        description: sentencesOf(m.content)[0] || m.content,
        evidence: [m.content.slice(0, 240)],
      });
    }
  }
  return expressions.slice(0, 3);
}

export function scanConsequences(history: ChatMessage[]): ConsequenceCandidate[] {
  const consequences: ConsequenceCandidate[] = [];
  const cues = [
    /\bas\s+a\s+result\b/i,
    /\bwhich\s+(?:led|made|caused|created)\b/i,
    /\bso\s+(?:now|then|collapsed|resigned)\b/i,
    /\bthe\s+consequence\s+is\b/i,
    /\bbecause\s+of\s+that\b/i,
    /\band\s+now\s+I\b/i,
  ];
  for (const m of history) {
    if (m.role !== "user") continue;
    if (cues.some((rx) => rx.test(m.content))) {
      consequences.push({
        description: sentencesOf(m.content)[0] || m.content,
        evidence: [m.content.slice(0, 240)],
      });
    }
  }
  return consequences.slice(0, 3);
}

export function scanObservations(history: ChatMessage[]): Observation[] {
  return history
    .filter((m) => m.role === "user")
    .map((m) => ({
      content: m.content.trim().slice(0, 500),
      source: "user" as const,
      epistemicStatus: "observed" as const,
    }))
    .slice(-12);
}

export function scanUserInterpretations(history: ChatMessage[]): SovereignInterpretation[] {
  const cues = [
    /\bi\s+(?:feel|think|believe|assume|guess|figured|interpret(?:ed)?|read|took)\s+it\s+as\b/i,
    /\bi\s+made\s+it\s+mean\b/i,
    /\bfeels?\s+like\b/i,
    /\bthat\s+means?\b/i,
  ];
  const out: SovereignInterpretation[] = [];
  for (const m of history) {
    if (m.role !== "user") continue;
    if (cues.some((rx) => rx.test(m.content))) {
      out.push({
        content: sentencesOf(m.content)[0] || m.content,
        basedOn: [m.content.slice(0, 240)],
        epistemicStatus: "user-interpretation",
      });
    }
  }
  return out.slice(0, 4);
}

function scanModelHypotheses(history: ChatMessage[]): Hypothesis[] {
  const list: Hypothesis[] = [];
  for (const m of history) {
    if (m.role !== "assistant") continue;
    for (const sentence of sentencesOf(m.content)) {
      if (isInterpretive(sentence) && sentence.length < 240) {
        list.push({ text: sentence, status: "candidate" });
      }
    }
  }
  return list.slice(-6);
}

// ── Context assembly ───────────────────────────────────────────────────

function detectPersons(history: ChatMessage[]): AuthorizationContext["people"] {
  const text = history.filter((m) => m.role === "user").map((m) => m.content).join(" ").toLowerCase();
  const found = new Set<string>();
  const labels: AuthorizationContext["people"] = [
    { id: "self", label: "the user (self)", scope: "profile", consentStatus: "user-described" },
  ];
  const relationWords = [
    "partner", "husband", "wife", "spouse", "boyfriend", "girlfriend", "ex", "mother", "mom",
    "father", "dad", "sister", "brother", "sibling", "son", "daughter", "friend", "boss",
    "coworker", "colleague", "parent", "child", "in-law", "mother-in-law",
  ];
  for (const word of relationWords) {
    if (new RegExp(`\\b${word}`, "i").test(text) && !found.has(word)) {
      found.add(word);
      labels.push({ label: word, scope: "relationship", consentStatus: "user-described" });
    }
  }
  return labels;
}

function determineScope(history: ChatMessage[]): RelationshipScope {
  const text = history.slice(-2).map((m) => m.content).join(" ");
  if (SYSTEM_CUES.some((rx) => rx.test(text))) return "system";
  if (BETWEEN_PERSON_CUES.some((rx) => rx.test(text))) return "dyadic";
  return "self";
}

export function buildReasoningContext(opts: {
  history: ChatMessage[];
  baseline: DerivedBaseline;
}): ReasoningContext {
  const { history, baseline } = opts;
  const latestUser = [...history].reverse().find((m) => m.role === "user");
  const latestText = latestUser?.content ?? "";
  const classification = classifyQuestion(latestText);
  const safetyMode = detectSafetyMode(history);

  const baselineSignals: BaselineSignal[] = buildBaselineSignals(baseline);
  const correlation = scanCorrections(history);

  const rejected = new Set(correlation.rejectedHypotheses);
  const hypotheses: Hypothesis[] = scanModelHypotheses(history).map((h) => ({
    ...h,
    status: rejected.has(h.text) ? "rejected-by-user" : "candidate",
  }));

  const meaningTargets = detectMeaningTargets(
    latestText,
    history.map((m) => m.content).join("\n"),
  );

  const unknowns = scanUnknowns(history);
  const conversations = history.filter((m) => m.role === "user").length;

  const context: ReasoningContext = {
    level: classification.level,
    domains: classification.domains,
    observations: scanObservations(history),
    baselineSignals,
    interpretations: scanUserInterpretations(history),
    meaningTargets,
    patterns: scanPatternCandidates(history),
    expressions: scanExpressions(history),
    consequences: scanConsequences(history),
    unknowns,
    relationshipScope: determineScope(history),
    authorization: {
      self: true,
      people: detectPersons(history),
      systemContext: "user-described",
    },
    safetyMode,
    correctionState: correlation,
    hypotheses,
  };

  // Harden: if no user turns exist, mark authorization accordingly.
  if (conversations === 0) {
    context.authorization.systemContext = "none";
  }

  return context;
}

// ── Prompt rendering ───────────────────────────────────────────────────

function renderReasoningContext(ctx: ReasoningContext, limitations: string[]): string {
  const lines: string[] = [];
  lines.push("## APPLICATION REASONING CONTEXT");
  lines.push(`Question level: ${ctx.level}`);
  if (ctx.domains.length) lines.push(`Domains: ${ctx.domains.join(", ")}`);
  lines.push(`Relationship scope: ${ctx.relationshipScope}`);

  if (ctx.observations.length) {
    lines.push("OBSERVED (user-stated):");
    for (const o of ctx.observations.slice(0, 8)) lines.push(`- ${o.content}`);
  }
  if (ctx.baselineSignals.length) {
    lines.push("BASELINE CONTEXT (derived signals — context, not verdict):");
    for (const s of ctx.baselineSignals.slice(0, 8)) {
      lines.push(`- ${s.source}: ${s.value}${s.interpretation ? ` (${s.interpretation})` : ""}`);
    }
  }
  if (ctx.interpretations.length) {
    lines.push("USER INTERPRETATIONS (their reading, not yours):");
    for (const i of ctx.interpretations) lines.push(`- ${i.content}`);
  }
  if (ctx.meaningTargets.length) {
    lines.push("MEANING TARGETS (loaded concepts — clarify before assuming):");
    for (const t of ctx.meaningTargets) {
      if (t.definitionKnown && t.userDefinition) {
        lines.push(`- "${t.concept}" — user defines as: "${t.userDefinition}". ${t.clarificationQuestion ?? ""}`);
      } else {
        lines.push(`- "${t.concept}" — definition unknown. ${t.clarificationQuestion ?? `Ask what ${t.concept} means to them.`}`);
      }
    }
  }
  if (ctx.patterns.length) {
    lines.push("PATTERN CANDIDATES (hypotheses only, not established facts):");
    for (const p of ctx.patterns.slice(0, 3)) {
      lines.push(`- ${p.description} [recurrence: ${p.recurrence}; alternative readings may fit the same facts]`);
    }
  }
  if (ctx.unknowns.length) {
    lines.push("UNKNOWNS (do not resolve these into facts):");
    for (const u of ctx.unknowns) lines.push(`- ${u.question} — ${u.reason}`);
  }
  const rejected = ctx.correctionState.rejectedHypotheses;
  if (rejected.length) {
    lines.push("REJECTED HYPOTHESES (do NOT re-assert, do NOT defend):");
    for (const r of rejected) lines.push(`- ${r}`);
  }
  if (ctx.correctionState.confirmedInterpretations.length) {
    lines.push("CONFIRMED INTERPRETATIONS (user accepted these):");
    for (const c of ctx.correctionState.confirmedInterpretations) lines.push(`- ${c}`);
  }
  if (limitations.length) {
    lines.push("LIMITATIONS:");
    for (const l of limitations) lines.push(`- ${l}`);
  }
  lines.push("AUTHORIZATION: only what the user described. No consented third-party data exists.");
  return lines.join("\n");
}

export function windowHistoryPreservingCorrections(
  history: ChatMessage[],
  max: number = MAX_CONTEXT_MESSAGES,
): ChatMessage[] {
  const lastIndex = history.length - 1;
  const preserved = new Set<number>([]);
  history.forEach((m, i) => {
    if (m.role === "user" && REJECTION_CUES.some((rx) => rx.test(m.content))) preserved.add(i);
  });
  preserved.add(lastIndex);

  const nonPreserved = history.map((_, i) => i).filter((i) => !preserved.has(i));
  const keep = [...preserved, ...nonPreserved.slice(-(Math.max(0, max - preserved.size)))].sort((a, b) => a - b);
  return keep.map((i) => history[i]);
}

export function buildReasoningPrompt(
  ctx: ReasoningContext,
  history: ChatMessage[],
  baseline: DerivedBaseline,
): ModelInput["messages"] {
  const systemContent = [
    buildSystemPrompt(baseline),
    renderReasoningContext(ctx, buildBaselineLimitations(baseline)),
  ].join("\n\n");
  const windowed = windowHistoryPreservingCorrections(history);
  return [{ role: "system", content: systemContent }, ...windowed];
}

export function buildResponsePlan(ctx: ReasoningContext): SovereignResponsePlan {
  const plan: SovereignResponsePlan = {};
  if (ctx.observations.length) plan.observed = ctx.observations.slice(0, 3).map((o) => o.content);
  if (ctx.baselineSignals.length) plan.baselineSupported = ctx.baselineSignals.slice(0, 2).map((s) => `${s.source}: ${s.value}`);
  if (ctx.interpretations.length) plan.interpretation = ctx.interpretations.slice(0, 2).map((i) => i.content);
  if (ctx.unknowns.length) plan.unknowns = ctx.unknowns.map((u) => u.question);
  if (ctx.meaningTargets.length) plan.meaningQuestion = ctx.meaningTargets[0].clarificationQuestion;
  if (ctx.patterns.length) plan.pattern = ctx.patterns[0].description;
  return plan;
}

// ── Pipeline: generate → validate → (one) repair → validate → fallback ──

export async function generateSovereignResponse(
  ctx: ReasoningContext,
  history: ChatMessage[],
  baseline: DerivedBaseline,
  model: SovereignModel,
): Promise<SovereignGenerationResult> {
  if (ctx.safetyMode === "escalate" || ctx.safetyMode === "grounded") {
    return {
      text: buildSafetyResponse(ctx.safetyMode),
      usedFallback: true,
      repairAttempts: 0,
      validated: true,
    };
  }

  const messages = buildReasoningPrompt(ctx, history, baseline);
  let text = (await model.generate({ messages })).text;

  let validation = validateSovereignText(text, { correctionState: ctx.correctionState });
  if (validation.allowed) {
    return { text, usedFallback: false, repairAttempts: 0, validated: true };
  }

  // One bounded repair. The repair is a fresh generation constrained by the
  // violations found — never an interactive conversation.
  const repairInstruction = buildRepairInstruction(validation.violations);
  const repairMessages: ModelInput["messages"] = [
    ...messages,
    { role: "assistant", content: text },
    { role: "user", content: repairInstruction },
  ];
  text = (await model.generate({ messages: repairMessages })).text;

  validation = validateSovereignText(text, { correctionState: ctx.correctionState });
  if (validation.allowed) {
    return { text, usedFallback: false, repairAttempts: 1, validated: true };
  }

  return { text: buildGroundedFallback(), usedFallback: true, repairAttempts: 1, validated: false };
}

// Epistemic-typed interpretation alias (kept local to avoid contract noise).
type SovereignInterpretation = {
  content: string;
  basedOn: string[];
  epistemicStatus: "user-interpretation" | "model-hypothesis";
};