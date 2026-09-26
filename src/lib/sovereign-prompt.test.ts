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
  });
});