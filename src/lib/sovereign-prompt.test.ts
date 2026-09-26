import { describe, it, expect } from "vitest";
import { deriveBaseline, buildSystemPrompt } from "./sovereign-prompt";
import { buildBaselineLimitations } from "./sovereign-baseline";

describe("deriveBaseline", () => {
  it("returns safe defaults for empty data", () => {
    const d = deriveBaseline({});
    expect(d.sunSign).toBe("Unknown");
    expect(d.moonSign).toBe("Unknown");
    expect(d.qualities).toEqual(["Insufficient data for quality derivation"]);
    expect(d.underusedCapacities).toEqual(["Insufficient data"]);
    expect(d.pressureResponse).toContain("Insufficient data");
  });

  it("derives qualities and pressure response from provided data", () => {
    const d = deriveBaseline({
      astrology: {
        sunSign: "Leo",
        moonSign: "Cancer",
        planets: {
          sun: { theme: "visible expression, authorship, and creative direction" },
          moon: { theme: "protection, belonging, and emotional context" },
          mars: { theme: "direct action and clear initiation" },
        },
      },
      numerology: { lifePath: 7 },
      humanDesign: { type: "Generator", strategy: "To Respond", authority: "Sacral" },
    });
    expect(d.sunSign).toBe("Leo");
    expect(d.numerologyLifePath).toBe(7);
    expect(d.qualities.some((q) => q.includes("Sun"))).toBe(true);
    expect(d.pressureResponse).toContain("Outwardly");
  });

  it("defaults birth time to exact and reads approximate precision from meta", () => {
    expect(deriveBaseline({}).birthTimePrecision).toBe("exact");
    const approx = deriveBaseline({ meta: { timePrecision: "approximate", tobAccuracy: "morning" } });
    expect(approx.birthTimePrecision).toBe("approximate");
    expect(buildBaselineLimitations(approx).some((l) => l.includes("approximate"))).toBe(true);
    expect(buildBaselineLimitations(deriveBaseline({})).some((l) => l.includes("approximate"))).toBe(false);
  });

  it("warns the model about approximate birth time in the system prompt", () => {
    const exact = buildSystemPrompt(deriveBaseline({}));
    expect(exact).not.toContain("birth time is approximate");
    const approxPrompt = buildSystemPrompt(deriveBaseline({ meta: { timePrecision: "approximate" } }));
    expect(approxPrompt).toContain("the user's birth time is approximate");
  });

  it("never feeds the placeholder rising sign to the model", () => {
    // nasa-jpl stores risingSign: "Unknown" until the ascendant is computed.
    // Nothing derived or prompted may present that placeholder as a fact.
    const raw = { astrology: { risingSign: "Unknown", sunSign: "Leo" } };
    const prompt = buildSystemPrompt(deriveBaseline(raw));
    expect(prompt.toLowerCase()).not.toContain("rising");
  });
});

describe("buildSystemPrompt", () => {
  it("embeds baseline values and the evidence states", () => {
    const prompt = buildSystemPrompt(deriveBaseline({
      astrology: { sunSign: "Leo", moonSign: "Cancer", planets: { sun: { theme: "visible expression, authorship, and creative direction" } } },
    }));
    expect(prompt).toContain("Sun sign: Leo");
    expect(prompt).toContain("Observed");
    expect(prompt).toContain("Baseline-supported");
    expect(prompt).toContain("Interpretive");
    expect(prompt).toContain("Unknown");
    // The evidence states must stay internal — the model is told not to print
    // them as headings/labels, so the answer reads as prose, not a filled form.
    expect(prompt).toContain("not headings or tags to print");
  });

  it("never feeds the model a leakable '(<planet> — <word>)' quality slug", () => {
    // Regression pin: the old quality format embedded "(Jupiter — expansion)" /
    // "(Saturn — structure)" directly in the Baseline text the model reads, and
    // it reproduced those tags verbatim. The label is now folded into prose
    // ("Jupiter expansion: ..."), and the directive forbids printing the tag.
    const prompt = buildSystemPrompt(deriveBaseline({
      astrology: {
        sunSign: "Leo",
        moonSign: "Cancer",
        planets: {
          sun: { theme: "visible expression, authorship, and creative direction" },
          jupiter: { theme: "meaning, exploration, and wider possibility" },
          saturn: { theme: "structure, responsibility, and durable progress" },
        },
      },
    }));
    // No parenthetical slug of the form "(<planet> — ...)" or "— <role>)".
    expect(prompt).not.toMatch(/\((?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn)\s+—/);
    expect(prompt).not.toMatch(/— (?:expansion|structure|core expression|inner response|processing|relating|initiative)\)/);
    // The planet grounding is still present, just expressed as a prose label.
    expect(prompt).toContain("Jupiter expansion:");
    expect(prompt).toContain("Saturn structure:");
  });
});