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
}

export interface ExpressionCandidate {
  description: string;
  evidence: string[];
}

export interface ConsequenceCandidate {
  description: string;
  evidence: string[];
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