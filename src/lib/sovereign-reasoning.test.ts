import { describe, it, expect } from "vitest";
import {
  classifyQuestion,
  detectMeaningTargets,
  findMeaningTriggers,
  scanCorrections,
  windowHistoryPreservingCorrections,
  buildReasoningContext,
} from "./sovereign-reasoning";
import { deriveBaseline } from "./sovereign-prompt";
import type { ChatMessage } from "./types";

const BASELINE = deriveBaseline({
  astrology: {
    sunSign: "Leo",
    moonSign: "Cancer",
    planets: {
      sun: { theme: "visible expression, authorship, and creative direction" },
      moon: { theme: "protection, belonging, and emotional context" },
    },
  },
});

describe("classifyQuestion (conservative classification)", () => {
  it("classifies how-I-operate questions as Level 1 reflection", () => {
    const c = classifyQuestion("Why do I always get anxious before work meetings?");
    expect(c.level).toBe(1);
    expect(c.domains).toContain("you");
    expect(c.baselineRelevant).toBe(true);
    expect(c.meaningRelevant).toBe(false);
  });

  it("classifies loaded-concept questions as Level 2 meaning", () => {
    const c = classifyQuestion("What does success mean to me?");
    expect(c.level).toBe(2);
    expect(c.meaningRelevant).toBe(true);
    expect(c.domains).toContain("meaning");
  });

  it("classifies partner behavior questions as Level 3", () => {
    const c = classifyQuestion("She ignored my text again last night.");
    expect(c.level).toBe(3);
    expect(c.domains).toContain("between");
  });

  it("classifies family system questions as Level 4", () => {
    const c = classifyQuestion("My whole family fights at every dinner.");
    expect(c.level).toBe(4);
    expect(c.domains).toContain("system");
  });
});

describe("meaning triggers", () => {
  it("detects trigger words including the helping stem", () => {
    expect(findMeaningTriggers("I helped my friend move")).toContain("helping");
    expect(findMeaningTriggers("What does success mean?")).toContain("success");
    expect(findMeaningTriggers("am I ever good enough?").sort()).toContain("enough");
  });

  it("builds meaning targets with clarification questions", () => {
    const targets = detectMeaningTargets(
      "What does respect mean?",
      "I don't even know what respect means to me anymore.",
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].concept).toBe("respect");
  });

  it("records a user definition once given", () => {
    const targets = detectMeaningTargets(
      "Did it count as a success?",
      "Success means to me proving I am reliable.",
    );
    const success = targets.find((t) => t.concept === "success");
    expect(success?.definitionKnown).toBe(true);
    expect(success?.userDefinition).toContain("proving I am reliable");
  });
});

describe("scanCorrections", () => {
  const history: ChatMessage[] = [
    { role: "user", content: "I keep taking on everyone's problems." },
    { role: "assistant", content: "One possibility worth examining is that you overextend in order to feel needed." },
    { role: "user", content: "No, that's not it. I just worry a lot." },
  ];
  const state = scanCorrections(history);

  it("marks the rejected hypothesis", () => {
    expect(state.rejectedHypotheses).toContain("One possibility worth examining is that you overextend in order to feel needed.");
  });
  it("captures confirmed interpretations separately", () => {
    const confirmed = scanCorrections([
      { role: "assistant", content: "One possibility worth examining is that you pull back to stay safe." },
      { role: "user", content: "Exactly, that's it." },
    ]);
    expect(confirmed.confirmedInterpretations).toHaveLength(1);
  });
});

describe("windowHistoryPreservingCorrections", () => {
  const history: ChatMessage[] = [];
  for (let i = 0; i < 15; i++) {
    history.push({ role: "user", content: `message number ${i}` });
    if (i === 2) {
      history.push({ role: "assistant", content: "One possibility worth examining is that you freeze under pressure." });
      history.push({ role: "user", content: "No, that's not it." });
    } else {
      history.push({ role: "assistant", content: `Response to ${i}.` });
    }
  }
  history.push({ role: "user", content: "message number 14" });
  const windowed = windowHistoryPreservingCorrections(history, 20);

  it("keeps the early correction even inside a window", () => {
    const texts = windowed.map((m) => m.content);
    expect(texts).toContain("No, that's not it.");
    expect(windowed.length).toBeLessThanOrEqual(20);
  });
  it("always keeps the latest message", () => {
    expect(windowed[windowed.length - 1].content).toBe("message number 14");
  });
});

describe("buildReasoningContext", () => {
  const history: ChatMessage[] = [
    { role: "user", content: "I helped my friend move, and now I feel off." },
    { role: "assistant", content: "One possibility worth examining is whether helping is tied to feeling valuable." },
    { role: "user", content: "Maybe. What does being good mean to me?" },
  ];
  const ctx = buildReasoningContext({ history, baseline: BASELINE });

  it("assembles observations, baseline signals, and meaning targets", () => {
    expect(ctx.observations.length).toBeGreaterThanOrEqual(2);
    expect(ctx.baselineSignals.length).toBeGreaterThan(0);
    expect(ctx.meaningTargets.length).toBeGreaterThan(0);
  });
  it("carries the classification level", () => {
    expect(ctx.level).toBeGreaterThanOrEqual(2);
  });
  it("stays standard-mode for normal disclosure", () => {
    expect(ctx.safetyMode).toBe("standard");
  });
  it("exposes the rejected-hypothesis state when corrected", () => {
    const corrected = buildReasoningContext({
      history: [
        { role: "assistant", content: "One possibility worth examining is that you overextend to feel needed." },
        { role: "user", content: "No, that's not it." },
      ],
      baseline: BASELINE,
    });
    expect(corrected.correctionState.rejectedHypotheses.length).toBeGreaterThan(0);
  });
});