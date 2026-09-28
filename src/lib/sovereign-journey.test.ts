import { describe, expect, it } from "vitest";
import { deriveJourneyState } from "./sovereign-journey";
import type { ChatMessage } from "./types";
import type { ReasoningContext } from "./sovereign-types";

function baseCtx(over: Partial<ReasoningContext> = {}): ReasoningContext {
  return {
    level: 1, domains: [], observations: [], baselineSignals: [],
    interpretations: [], meaningTargets: [], patterns: [], expressions: [],
    consequences: [], unknowns: [], relationshipScope: "self",
    authorization: { self: true, people: [], systemContext: "user-described" },
    safetyMode: "standard",
    correctionState: { rejectedHypotheses: [], confirmedInterpretations: [], userDefinitions: {} },
    hypotheses: [], consented: [], ...over,
  };
}
const u = (content: string): ChatMessage => ({ role: "user", content });
const a = (content: string): ChatMessage => ({ role: "assistant", content });

describe("deriveJourneyState", () => {
  it("stays quiet on small talk: no goal, journey barely begun", () => {
    const s = deriveJourneyState(baseCtx(), [u("hi")], null);
    // One user turn surfaces the signal (steps[0] done) and the next step is
    // current — but no goal is inferred yet, so no journey row is created.
    expect(s.current_step).toBe("name-what-landed");
    expect(s.suggested_goal).toBeNull();
    expect(s.visual_progress).toBeGreaterThan(0);
    expect(s.steps[0].status).toBe("done");
    expect(s.steps[1].status).toBe("current");
  });
  it("unlocks meaning-clarified when a definition is known", () => {
    const s = deriveJourneyState(
      baseCtx({ meaningTargets: [{ concept: "respect", definitionKnown: true, materiallyRelevant: true, userDefinition: "being heard" }] }),
      [u("We keep fighting about respect"), a("What does respect mean to you?"), u("Respect means being heard")],
      null,
    );
    expect(s.unlocked_milestones).toContain("meaning-clarified");
    expect(s.current_step).not.toBe("surface-signal");
    expect(s.suggested_goal).not.toBeNull();
  });
  it("unlocks parts-separated on correction, frame-widened on dyadic scope", () => {
    const s = deriveJourneyState(
      baseCtx({ relationshipScope: "dyadic", domains: ["between"], correctionState: { rejectedHypotheses: ["It sounds like distance"], confirmedInterpretations: [], userDefinitions: {} } }),
      [u("My partner shuts down every time"), a("It sounds like distance"), u("No, that's not it — it's more like shutdown")],
      null,
    );
    expect(s.unlocked_milestones).toContain("parts-separated");
    expect(s.unlocked_milestones).toContain("frame-widened");
  });
  it("progress is monotonic: never un-develops", () => {
    const rich = deriveJourneyState(
      baseCtx({ level: 4, domains: ["choice"], relationshipScope: "dyadic", correctionState: { rejectedHypotheses: [], confirmedInterpretations: ["yes that lands"], userDefinitions: {} }, meaningTargets: [{ concept: "trust", definitionKnown: true, materiallyRelevant: true }] }),
      [u("Long thread about trust with my partner and what to do"), a("…"), u("Yes that lands, I see my part and I know what to try")],
      null,
    );
    const thin = deriveJourneyState(baseCtx(), [u("hi")], rich);
    expect(thin.visual_progress).toBe(rich.visual_progress);
    expect(thin.unlocked_milestones).toEqual(rich.unlocked_milestones);
  });
  it("newly_unlocked only contains this turn's unlocks", () => {
    const first = deriveJourneyState(baseCtx(), [u("I'm angry about dinner")], null);
    expect(first.newly_unlocked.length).toBeGreaterThan(0);
    const second = deriveJourneyState(baseCtx(), [u("I'm angry about dinner")], first);
    expect(second.newly_unlocked).toEqual([]);
  });
});
