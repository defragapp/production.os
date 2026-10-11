import { describe, it, expect } from "vitest";
import { deriveBaseline, buildSystemPrompt } from "./sovereign-prompt";
import { buildBaselineLimitations } from "./sovereign-baseline";

describe("deriveBaseline", () => {
  it("returns safe defaults for empty data", () => {
    const d = deriveBaseline({});
    expect(d.sunSign).toBe("Unknown");
    expect(d.moonSign).toBe("Unknown");
    expect(d.qualities).toEqual([
      "The birth data available didn't surface a distinct standing quality, so lean on what the person tells you directly.",
    ]);
    expect(d.underusedCapacities).toEqual([
      "The birth data available didn't surface a clear underused capacity yet.",
    ]);
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
    // Qualities are plain-language lines — no internal planet/role tag reaches
    // the model (see the tag-leak regression test below).
    expect(d.qualities.some((q) => q.includes("visible expression, authorship, and creative direction"))).toBe(true);
    expect(d.qualities.some((q) => /\b(?:Sun core expression|Mars initiative)\b/.test(q))).toBe(false);
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

  it("never feeds the model an internal quality tag it could reproduce", () => {
    // Regression: the Baseline used to label each quality with a planet/role tag
    // ("Sun core expression: …", "Jupiter expansion: …"). The 8B model reproduced
    // those tags verbatim ("…a quality that shows up in your Baseline as your Sun
    // core expression"), which is framework name-dropping. No tag reaches the
    // prompt at all now — the theme text survives, expressed in plain language.
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
    expect(prompt).not.toMatch(/\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn)\s+(?:core expression|inner response|processing|relating|initiative|expansion|structure)\b/i);
    // No parenthetical slug of the form "(<planet> — ...)".
    expect(prompt).not.toMatch(/\((?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn)\s+—/);
    // The theme is still present, just in plain language.
    expect(prompt).toContain("meaning, exploration, and wider possibility");
    expect(prompt).toContain("structure, responsibility, and durable progress");
  });

  it("keeps group (Level 4) answers addressed to the person", () => {
    // Level 4 invites a detached essay register ("each member", "the central
    // person"). The prompt must still require second-person address.
    const prompt = buildSystemPrompt(deriveBaseline({}));
    expect(prompt).toMatch(/what happens between you and them/i);
  });

  it("directs the model to prefer one meaningful observation over many generic ones", () => {
    // The brief's north star: perceptiveness, not verbosity. The prompt must
    // explicitly prize one accurate reading over a list of plausible ones.
    const prompt = buildSystemPrompt(deriveBaseline({}));
    expect(prompt).toMatch(/one accurate/i);
    expect(prompt).toMatch(/five generic/i);
  });

  it("directs the model to vary its opening instead of repeating one hedge", () => {
    // Regression: every example answer used the identical "One possibility
    // worth examining…" opener, so the small model turned it into a verbal tic
    // — a "feels like a template" tell. The prompt now forbids repeating the
    // same hedge across consecutive turns and must offer alternatives.
    const prompt = buildSystemPrompt(deriveBaseline({}));
    expect(prompt).toMatch(/begin consecutive answers with the same hedge/i);
    const alternatives = ["It may be that", "This could indicate", "One way to see this is"];
    expect(alternatives.filter((a) => prompt.includes(a)).length).toBeGreaterThanOrEqual(2);
  });

  it("directs the model to name the single useful distinction", () => {
    // The answer-quality north star from the ported strategy: separate the two
    // experiences the person is treating as one instead of listing every
    // plausible interpretation of the moment.
    const prompt = buildSystemPrompt(deriveBaseline({}));
    expect(prompt).toMatch(/useful distinction/i);
    expect(prompt).toMatch(/care versus responsibility/i);
  });

  it("does not teach banned vocabulary in model-facing instructions", () => {
    const prompt = buildSystemPrompt(deriveBaseline({})).toLowerCase();
    // Banned in user-facing copy and AI output: pattern(s) as a noun, friction, reading
    // (engine identifiers elsewhere may use these words, but the prompt must not teach them).
    expect(prompt).not.toMatch(/\bpattern(s)?\b/);
    expect(prompt).not.toContain("friction");
    expect(prompt).not.toMatch(/\breading(s)?\b/);
  });

  it("Level 3 guidance encourages engaging with user-described relational narrative when consented context is absent", () => {
    // Change F: the model must not retreat to generic advice when the user
    // discusses a relationship but no consented peer data exists. The system
    // prompt should explicitly validate the user's own account as sufficient
    // ground for relational reasoning.
    const prompt = buildSystemPrompt(deriveBaseline({}));
    // Must tell the model the user's account IS relational material
    expect(prompt).toMatch(/the user.{0,10}own account.{0,40}relational material/i);
    // Must forbid refusing to engage due to absent third-party data
    expect(prompt).toMatch(/never refuse to engage because third.party data is absent/i);
    // Must frame observations as user experience, not verified fact about other
    expect(prompt).toMatch(/user.{0,10}experience.{0,40}not verified fact|one perspective/i);
  });
});