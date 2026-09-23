import { describe, it, expect } from "vitest";
import {
  computeHumanDesign,
  compareDesigns,
  longitudeToGate,
  GATE_TO_CENTER,
  GATE_WHEEL,
  GATE_THEMES,
} from "./sovereign-humandesign";

describe("longitudeToGate", () => {
  it("maps 0° to Gate 41 line 1 (wheel order, 0° Aries)", () => {
    const { gate, line } = longitudeToGate(0);
    expect(gate).toBe(41);
    expect(line).toBe(1);
  });

  it("maps one gate-span (5.625°) to the next gate", () => {
    expect(longitudeToGate(5.625).gate).toBe(19);
    expect(longitudeToGate(5.625).line).toBe(1);
  });

  it("wraps cleanly around 360°", () => {
    const { gate, line } = longitudeToGate(359.5);
    expect(gate).toBe(60);
    expect(line).toBe(6);
  });

  it("normalizes negative longitudes", () => {
    expect(longitudeToGate(-5.625).gate).toBe(60);
  });
});

describe("GATE_WHEEL / GATE_TO_CENTER integrity", () => {
  it("covers all 64 gates exactly once", () => {
    expect(GATE_WHEEL).toHaveLength(64);
    expect(new Set(GATE_WHEEL).size).toBe(64);
    for (let g = 1; g <= 64; g++) expect(GATE_WHEEL).toContain(g);
  });

  it("maps every gate to one of the nine centers", () => {
    const centers = new Set(Object.values(GATE_TO_CENTER));
    expect(centers).toHaveLength(9);
    for (const gate of GATE_WHEEL) expect(GATE_TO_CENTER[gate]).toBeDefined();
  });

  it("provides a theme for every gate", () => {
    for (let g = 1; g <= 64; g++) expect(GATE_THEMES[g]).toBeTruthy();
  });
});

describe("computeHumanDesign", () => {
  it("returns a Reflector for no occupied gates", () => {
    const r = computeHumanDesign({});
    expect(r.type).toBe("Reflector");
    expect(r.strategy).toContain("Lunar");
    expect(r.gates).toHaveLength(0);
    expect(r.geneKeys).toHaveLength(0);
  });

  it("computes gates, centers, type, authority and gene keys for a full chart", () => {
    const positions: Record<string, { longitude: number }> = {
      sun: { longitude: 150 },     // Gate 15 (G, fixed rhythm)
      moon: { longitude: 20 },     // Gate 49 (Solar Plexus, principles)
      mercury: { longitude: 80 },  // Gate 12 (Throat, restraint)
      venus: { longitude: 95 },    // Gate 35 (Throat, change)
      mars: { longitude: 210 },    // Gate 29 (Sacral, perseverance)
      jupiter: { longitude: 300 }, // Gate 1 (G, creative self-expression)
      saturn: { longitude: 45 },   // Gate 2 (G, direction)
      uranus: { longitude: 62 },   // Gate 8 (Throat, speaking contribution)
      neptune: { longitude: 240 }, // Gate 46 (G, drive toward success)
      pluto: { longitude: 325 },   // Gate 14 (G, power skills)
    };
    const r = computeHumanDesign(positions);
    expect(r.gates).toHaveLength(10);
    expect(r.definedCenters).toContain("G");
    expect(r.definedCenters).toContain("Sacral");
    expect(r.geneKeys).toHaveLength(10);
    expect(r.geneKeys.every((g) => ["Shadow", "Gift", "Siddhi"].includes(g.frequency))).toBe(true);
    // G + Sacral defined, no Throat → Generator.
    expect(r.type).toBe("Generator");
    expect(r.strategy).toBe("To Respond");
    expect(r.authority).toBe("Emotional (solar plexus)");
    expect(r.profile).toMatch(/^\d\/\d$/);
  });

  it("flags an active channel when both gates are occupied", () => {
    // Gate 10 (G) at ~330° and Gate 20 (Throat) at ~101.25° → 10–20 Awakening.
    const r = computeHumanDesign({
      sun: { longitude: 330 },       // Gate 10
      moon: { longitude: 118.125 },  // Gate 20
    });
    expect(r.definedChannels.some((c) => c.name === "Awakening")).toBe(true);
  });
});

describe("compareDesigns", () => {
  it("finds shared gates and joint channels without exposing coordinates", () => {
    const a = computeHumanDesign({ sun: { longitude: 330 }, moon: { longitude: 20 } });
    const b = computeHumanDesign({ sun: { longitude: 330 }, mars: { longitude: 50 } });
    const between = compareDesigns(a, b);
    expect(between.sharedGates.some((s) => s.gate === 10)).toBe(true);
    expect(between.summary.length).toBeGreaterThan(0);
  });
});