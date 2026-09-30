import { describe, expect, it } from "vitest";
import {
  SIGIL_INTENTS,
  getSigilIntent,
  deriveSigilSeed,
  sigilSeedFromId,
  sigilGeometry,
  renderSigilSvg,
  sigilSvgDataUri,
  encodeSigilToken,
  decodeSigilToken,
  sigilSentence,
} from "./sigil";

describe("sigil intents", () => {
  it("exposes a fixed, validated launch set with unique ids", () => {
    const ids = SIGIL_INTENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of SIGIL_INTENTS) {
      expect(i.label).toBeTruthy();
      expect(i.phrase).toMatch(/^[a-z]/); // sentence-friendly lowercase phrase
      expect(i.spokes).toBeGreaterThanOrEqual(3);
      expect(i.rings).toBeGreaterThanOrEqual(1);
      expect(getSigilIntent(i.id)).toBe(i);
    }
  });

  it("rejects an unknown intent id", () => {
    expect(getSigilIntent("nope")).toBeUndefined();
    expect(getSigilIntent(undefined)).toBeUndefined();
  });
});

describe("deriveSigilSeed", () => {
  const baseline = {
    astrology: { sunSign: "Gemini", moonSign: "Cancer" },
    humanDesign: { type: "Generator", authority: "Solar" },
    numerology: { lifePath: 7 },
  };

  it("is deterministic for the same Baseline", () => {
    expect(deriveSigilSeed(baseline)).toBe(deriveSigilSeed(baseline));
  });

  it("changes when the Baseline identity changes", () => {
    expect(deriveSigilSeed(baseline)).not.toBe(
      deriveSigilSeed({ ...baseline, astrology: { ...baseline.astrology, sunSign: "Libra" } }),
    );
  });

  it("tolerates a missing Baseline without collapsing to zero", () => {
    expect(deriveSigilSeed(null)).toBeGreaterThan(0);
    expect(deriveSigilSeed(undefined)).toBeGreaterThan(0);
  });

  it("a salt keeps two empty (or JPL-degraded) Baselines from sharing one crest", () => {
    expect(deriveSigilSeed(null, "user-a")).not.toBe(deriveSigilSeed(null, "user-b"));
    expect(deriveSigilSeed(baseline, "u")).toBe(deriveSigilSeed(baseline, "u"));
    expect(deriveSigilSeed(baseline, "u")).not.toBe(deriveSigilSeed(baseline, "v"));
  });

  it("sigilSeedFromId is stable and non-zero", () => {
    expect(sigilSeedFromId("rel-123")).toBe(sigilSeedFromId("rel-123"));
    expect(sigilSeedFromId("rel-123")).not.toBe(sigilSeedFromId("rel-124"));
    expect(sigilSeedFromId("")).toBeGreaterThan(0);
  });
});

describe("sigilGeometry + renderSigilSvg", () => {
  it("produces identical markup for the same seed+intent (byte parity across surfaces)", () => {
    const a = renderSigilSvg(sigilGeometry(12345, "grounded"));
    const b = renderSigilSvg(sigilGeometry(12345, "grounded"));
    expect(a).toBe(b);
  });

  it("differs for a different seed or intent", () => {
    expect(renderSigilSvg(sigilGeometry(1, "open"))).not.toBe(renderSigilSvg(sigilGeometry(2, "open")));
    expect(renderSigilSvg(sigilGeometry(1, "open"))).not.toBe(renderSigilSvg(sigilGeometry(1, "clear")));
  });

  it("falls back to a real intent for an unknown id", () => {
    expect(sigilGeometry(1, "bogus").intent.id).toBe(SIGIL_INTENTS[0].id);
  });

  it("emits a self-contained, hairline, currentColor SVG (no colour drift)", () => {
    const svg = renderSigilSvg(sigilGeometry(99, "empathizing"));
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("currentColor");
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}/i); // no hardcoded fills — host sets the colour
    expect(svg).toContain('aria-hidden="true"');
  });

  it("data URI is URL-encoded and pinned to a light tone for Satori (never currentColor)", () => {
    const uri = sigilSvgDataUri(sigilGeometry(99, "empathizing"), 200);
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(uri).not.toContain("<svg"); // raw angle brackets must be encoded
    expect(uri).toContain("%23fafafa"); // explicit light stroke — currentColor vanishes in the OG rasteriser
    expect(uri).not.toContain("currentColor");
  });
});

describe("sigil token encode/decode", () => {
  const intent = getSigilIntent("empathizing")!;

  it("round-trips a named Sigil", () => {
    const token = encodeSigilToken({ intent, seed: 987654, name: "Chad" });
    const view = decodeSigilToken(token);
    expect(view).toEqual({ intent, seed: 987654, name: "Chad" });
  });

  it("round-trips an anonymous Sigil with no name key", () => {
    const token = encodeSigilToken({ intent, seed: 42 });
    const view = decodeSigilToken(token);
    expect(view).not.toBeNull();
    expect(view!.name).toBeUndefined();
    expect(sigilSentence(view!)).toMatch(/^Someone is holding a state of empathy\.$/);
  });

  it("trims and caps the embedded name", () => {
    const token = encodeSigilToken({ intent, seed: 1, name: "  Ada   Lovelace  " });
    expect(decodeSigilToken(token)!.name).toBe("Ada Lovelace");
  });

  it("token is URL-path-safe (no reserved characters)", () => {
    const token = encodeSigilToken({ intent, seed: 123456789, name: "Ángel" });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects forged or malformed tokens", () => {
    expect(decodeSigilToken("not-base64!!!")).toBeNull();
    expect(decodeSigilToken("")).toBeNull();
    // Valid base64url but not a Sigil payload.
    const junk = btoa(JSON.stringify({ hello: "world" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeSigilToken(junk)).toBeNull();
    // Unknown intent is refused even with the right shape.
    const badIntent = btoa(JSON.stringify({ v: 1, i: "not-real", s: 5 })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeSigilToken(badIntent)).toBeNull();
  });
});

describe("sigilSentence", () => {
  it("reads as the brand's share line", () => {
    const intent = getSigilIntent("grounded")!;
    expect(sigilSentence({ intent, seed: 1, name: "Chad" })).toBe(
      "Chad is holding a steady, grounded state.",
    );
  });
});
