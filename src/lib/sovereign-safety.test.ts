import { describe, it, expect } from "vitest";
import {
  validateSovereignText,
  buildGroundedFallback,
  buildSafetyResponse,
  detectSafetyMode,
} from "./sovereign-safety";
import { extractText, ModelError } from "./sovereign-model";

describe("validateSovereignText (Layer 1 lexicon)", () => {
  it("allows plainly safe sovereign-style language", () => {
    const text =
      "One possibility worth examining is whether helping has become connected to feeling valuable. You can decide that repeatedly changing the story makes the relationship difficult for you, regardless of why they do it.";
    const v = validateSovereignText(text);
    expect(v.allowed).toBe(true);
    expect(v.violations).toEqual([]);
  });

  it("is negation-aware: 'you are not the problem' passes", () => {
    const v = validateSovereignText("You are not the problem. You are not broken.");
    expect(v.allowed).toBe(true);
  });

  it("flags identity verdicts: 'you are a burden'", () => {
    const v = validateSovereignText("You are a burden and you are too much.");
    expect(v.allowed).toBe(false);
    expect(v.violations.some((x) => x.type === "identity-verdict")).toBe(true);
  });

  it("flags diagnosis language", () => {
    const v = validateSovereignText("This sounds like codependency. You should look into therapy.");
    expect(v.violations.some((x) => x.type === "diagnosis")).toBe(true);
  });

  it("flags motive certainty but allows 'I can't determine whether'", () => {
    expect(validateSovereignText("He is trying to hurt you.").allowed).toBe(false);
    const ok = validateSovereignText("I can't determine whether he is trying to hurt you.");
    expect(ok.allowed).toBe(true);
  });

  it("flags claims about hidden emotions even when negated", () => {
    expect(validateSovereignText("She does not care about you.").allowed).toBe(false);
  });

  it("flags relationship verdicts", () => {
    const v = validateSovereignText("He is manipulating you and he deserves to be told off.");
    expect(v.violations.some((x) => x.type === "relationship-verdict")).toBe(true);
  });

  it("flags baseline-as-verdict determinism", () => {
    const v = validateSovereignText("According to your baseline you are controlling.");
    expect(v.violations.some((x) => x.type === "baseline-determinism")).toBe(true);
  });

  it("flags prescriptive authority", () => {
    expect(validateSovereignText("You should leave him.").allowed).toBe(false);
  });

  it("flags unsupported certainty claims", () => {
    expect(validateSovereignText("The truth is that you will never matter to anyone.").allowed).toBe(false);
  });

  it("blocks re-asserting a rejected hypothesis", () => {
    const correctionState = {
      rejectedHypotheses: ["You overextend in order to feel needed."],
      confirmedInterpretations: [] as string[],
      userDefinitions: {} as Record<string, string>,
    };
    const v = validateSovereignText(
      "One possibility worth examining is that you overextend in order to feel needed.",
      { correctionState },
    );
    expect(v.allowed).toBe(false);
    expect(v.violations.some((x) => x.type === "unsupported-claim")).toBe(true);
  });

  it("rejects empty responses", () => {
    expect(validateSovereignText("   ").allowed).toBe(false);
  });

  it("blocks leaking the internal reasoning context", () => {
    const v = validateSovereignText(
      "APPLICATION REASONING CONTEXT\n- QUESTION LEVEL: 3\n- MEANING TARGETS: helping\nHere is my response...",
    );
    expect(v.allowed).toBe(false);
    expect(v.violations.some((x) => x.note.includes("leaks"))).toBe(true);
  });

  it("blocks 'epistemic status' internal jargon", () => {
    const v = validateSovereignText("One possibility worth examining, epistemic status: conceptual.");
    expect(v.allowed).toBe(false);
    expect(v.violations.some((x) => x.note.includes("leaks"))).toBe(true);
  });

  it("does not over-flag ordinary language about reasoning", () => {
    const v = validateSovereignText("Let's reason through what happened together, one step at a time.");
    expect(v.allowed).toBe(true);
  });
});

describe("fallback and safety responses stay safe", () => {
  it("grounded fallback validates clean", () => {
    const v = validateSovereignText(buildGroundedFallback());
    expect(v.allowed).toBe(true);
  });
  it("escalate and grounded responses validate clean", () => {
    for (const t of [buildSafetyResponse("escalate"), buildSafetyResponse("grounded")]) {
      expect(validateSovereignText(t).allowed).toBe(true);
    }
  });
});

describe("detectSafetyMode", () => {
  it("routes self-harm disclosures to escalate", () => {
    expect(detectSafetyMode([{ role: "user", content: "I don't want to live anymore." }])).toBe("escalate");
  });
  it("routes abuse disclosures to grounded", () => {
    expect(detectSafetyMode([{ role: "user", content: "My partner hits me." }])).toBe("grounded");
  });
  it("stays standard otherwise", () => {
    expect(detectSafetyMode([{ role: "user", content: "I helped my friend move." }])).toBe("standard");
  });
});

describe("extractText (adapter normalization)", () => {
  it("handles the llama { response } shape", () => {
    expect(extractText({ response: "  hello  " })).toBe("hello");
  });
  it("handles a plain string", () => {
    expect(extractText("direct")).toBe("direct");
  });
  it("throws ModelError on unrecognizable output", () => {
    expect(() => extractText({ nope: true })).toThrow(ModelError);
  });
});