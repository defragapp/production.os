/**
 * Sovereign reasoning contracts.
 * These are internal reasoning primitives — never exposed directly to the user.
 */

export type Domain = "you" | "meaning" | "between" | "system" | "choice";

export type EpistemicStatus =
  | "observed"
  | "baseline-supported"
  | "user-interpretation"
  | "model-hypothesis"
  | "unknown";

export type RelationshipScope = "self" | "dyadic" | "group" | "system";

export type SafetyMode = "standard" | "grounded" | "escalate";

export type HypothesisStatus = "candidate" | "supported-by-user" | "rejected-by-user" | "unknown";

export interface Observation {
  content: string;
  source: "user";
  epistemicStatus: "observed";
}

export interface BaselineSignal {
  source: string;
  value: string;
  interpretation?: string;
  epistemicStatus: "baseline-supported";
}

export interface Interpretation {
  content: string;
  basedOn: string[];
  epistemicStatus: "user-interpretation" | "model-hypothesis";
}

export interface Unknown {
  question: string;
  reason: string;
  epistemicStatus: "unknown";
}

export interface PatternCandidate {
  description: string;
  evidence: string[];
  recurrence: "single-event" | "reported-repeat" | "conversation-supported";
  confidence: "low" | "moderate";
  alternatives: string[];
  unknowns: string[];
}

export interface MeaningTarget {
  concept: string;
  definitionKnown: boolean;
  materiallyRelevant: boolean;
  userDefinition?: string;
  competingDefinitions?: string[];
  clarificationQuestion?: string;
}

export interface Hypothesis {
  text: string;
  status: HypothesisStatus;
}

export interface AuthorizationContext {
  self: boolean;
  people: Array<{
    id?: string;
    label: string;
    scope: "profile" | "relationship" | "interaction" | "system";
    consentStatus: "not-present" | "user-described" | "consented";
  }>;
  systemContext: "none" | "user-described" | "consented";
}

export interface CorrectionState {
  rejectedHypotheses: string[];
  confirmedInterpretations: string[];
  userDefinitions: Record<string, string>;
  /**
   * Per-correction context captured at extraction time, before the per-turn
   * filtering that narrows the two arrays above. A reframe the user issued
   * about a specific pair ("that's not what my mom and I do") is tagged
   * `relational` with the `peerName`; a solo inquiry must not inherit it.
   * Optional so hand-built CorrectionStates (tests, journey) need not supply it.
   */
  scoped?: {
    rejected: CorrectionEntry[];
    confirmed: CorrectionEntry[];
  };
}

/** The relational context a single correction was made in. */
export type CorrectionScope = "self" | "relational" | "system";

export interface CorrectionEntry {
  text: string;
  scope: CorrectionScope;
  /** Present when `scope` is "relational" and a specific peer was named. */
  peerName?: string;
}

export interface ExpressionCandidate {
  description: string;
  evidence: string[];
}

export interface ConsequenceCandidate {
  description: string;
  evidence: string[];
}

/**
 * A verbatim statement pulled from an earlier conversation by the semantic
 * recall layer (chat-recall). Offered to the model as pattern-visibility only.
 * Never carries another person's data; always the user's own past turns.
 */
export interface PriorSignal {
  snippet: string;
  role: "user" | "assistant";
  score: number;
  /** D1 `threads.updated_at` string, or null when unresolvable. */
  occurredAt: string | null;
  threadId: string;
  turnIndex: number;
}

export interface ReasoningContext {
  level: 1 | 2 | 3 | 4;
  domains: Domain[];
  observations: Observation[];
  baselineSignals: BaselineSignal[];
  interpretations: Interpretation[];
  meaningTargets: MeaningTarget[];
  patterns: PatternCandidate[];
  expressions: ExpressionCandidate[];
  consequences: ConsequenceCandidate[];
  unknowns: Unknown[];
  relationshipScope: RelationshipScope;
  authorization: AuthorizationContext;
  safetyMode: SafetyMode;
  correctionState: CorrectionState;
  hypotheses: Hypothesis[];
  /** Consent-gated context about connected people. Never contains birth data. */
  consented?: ConsentedPeer[];
  /** Deterministic pair-level signals (Level 3). Empty when level < 3 or no peers. */
  relationalSignals?: RelationalSignal[];
  /** Deterministic group-level signals (Level 4). Empty when level < 4 or < 2 peers. */
  systemSignals?: SystemSignal[];
  /** Semantic recall from the user's own earlier conversations. Empty when
   *  memory_mode='local' (never reaches Vectorize) or nothing clears the bar. */
  priorSignals?: PriorSignal[];
}

/**
 * A person the user is connected to, whose consent-gated derivation is present
 * in this reasoning turn. Deliberately a summary — no raw chart, no coordinates.
 */
export interface ConsentedPeer {
  id: string;
  name: string;
  role: string;
  derived: {
    sunSign: string;
    moonSign: string;
    qualities: string[];
    humanDesignType: string;
    humanDesignStrategy: string;
    humanDesignAuthority: string;
    humanDesignCenters: string[];
    humanDesignChannels: string[];
    geneKeysLabels: string[];
  };
  /** Between-design notes derived from comparing both users' computations. */
  betweenDesign: string[];
  /**
   * The peer's OWN earlier verbatim statements, surfaced only when history
   * sharing is consented (peer's a_/b_share_history flag), the requesting user
   * is Sovereign+, the inquiry scope is relational, and memory_mode is server.
   * Absent (undefined) for a baseline-only peer. Never another third party.
   */
  recollections?: string[];
  /**
   * Optional HD computation data for deterministic signal extraction.
   * Internal only — never rendered verbatim to the prompt. The signal engine
   * uses this alongside the self's HD to compute structured RelationalSignals.
   */
  _hd?: import("./sovereign-humandesign").HumanDesignComputation;
  /** Pre-computed BetweenDesigns for this pair (from compareDesigns). */
  _between?: import("./sovereign-humandesign").BetweenDesigns;
}

export interface ReasoningClassification {
  level: 1 | 2 | 3 | 4;
  domains: Domain[];
  meaningRelevant: boolean;
  baselineRelevant: boolean;
  safetyMode: SafetyMode;
}

export type SafetyViolationType =
  | "diagnosis"
  | "identity-verdict"
  | "motive-certainty"
  | "hidden-emotion-certainty"
  | "relationship-verdict"
  | "system-blame"
  | "baseline-determinism"
  | "destiny"
  | "overvalidation"
  | "prescriptive-authority"
  | "unsupported-claim";

export interface SafetyViolation {
  type: SafetyViolationType;
  severity: "high" | "medium" | "low";
  matchedText: string;
  note: string;
}

export interface SafetyValidation {
  allowed: boolean;
  violations: SafetyViolation[];
}

export interface ModelInput {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /**
   * Generation output budget. When omitted the model adapter applies
   * DEFAULT_MAX_TOKENS — the previous reliance on the provider's small implicit
   * default truncated answers mid-sentence, so the budget is now explicit.
   */
  maxTokens?: number;
}

export interface ModelOutput {
  text: string;
  usedGateway: boolean;
}

/** Every substantive reasoning turn is planned around these primitives. */
export interface SovereignResponsePlan {
  directReflection?: string;
  observed?: string[];
  baselineSupported?: string[];
  interpretation?: string[];
  unknowns?: string[];
  meaningQuestion?: string;
  pattern?: string;
  consequence?: string;
  choice?: string[];
  nextQuestion?: string;
}

export interface SovereignGenerationResult {
  text: string;
  usedFallback: boolean;
  repairAttempts: 0 | 1;
  validated: boolean;
}

// ── Relational & System Signal types (Level 3/4 deterministic layer) ───

export type SignalCategory =
  | "shared-bridge"
  | "pace-difference"
  | "authority-gap"
  | "channel-activation"
  | "center-complement"
  | "center-gap"
  | "friction-point"
  | "ease-point";

export interface RelationalSignal {
  /** Structured category for the model to understand signal type. */
  category: SignalCategory;
  /** Which peer(s) this signal involves. */
  peers: string[];
  /** Concrete non-jargon description of the relational mechanic. */
  description: string;
  /** Epistemic tag: always 'baseline-supported' — deterministic, not speculative. */
  epistemicStatus: "baseline-supported";
}

export interface SystemSignal {
  /** Group-level category. */
  category: "center-balance" | "role-distribution" | "shared-pressure" | "unheld-center" | "group-bridge";
  /** All peer names involved. */
  peers: string[];
  /** Concrete description of the group mechanic. */
  description: string;
  epistemicStatus: "baseline-supported";
}