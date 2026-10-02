import { describe, it, expect } from "vitest";
import {
  detectSignificantTransits,
  nudgeText,
  resolveConjunctionOrb,
  type TransitEvent,
  type NatalPositions,
  type CurrentPositions,
} from "./transit-signals";

// Zodiac starts at Aries 0°, each sign a 30° arc. These fixtures use plain
// ecliptic longitudes so a boundary read is obvious by eye:
//   Aries 0-30 · Taurus 30-60 · Gemini 60-90 · Cancer 90-120 · ...
const SKY_EMPTY: CurrentPositions = {};

function sky(body: string, longitude: number, retrograde = false): CurrentPositions {
  return { [body]: { longitude, retrograde } };
}

function merge(...skies: CurrentPositions[]): CurrentPositions {
  return Object.assign({}, ...skies);
}

describe("detectSignificantTransits — ingress", () => {
  it("fires when Saturn crosses a sign boundary", () => {
    const events = detectSignificantTransits(
      {},
      merge(sky("saturn", 31)),
      merge(sky("saturn", 29)),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "transit", body: "saturn", eventType: "ingress", targetSign: "Taurus" });
  });

  it("stays silent when the sign is unchanged", () => {
    const events = detectSignificantTransits(
      {},
      merge(sky("saturn", 25)),
      merge(sky("saturn", 20)),
    );
    expect(events).toEqual([]);
  });

  it("detects a Jupiter ingress independently of Saturn", () => {
    const events = detectSignificantTransits(
      {},
      merge(sky("jupiter", 91)),
      merge(sky("jupiter", 89)),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ body: "jupiter", eventType: "ingress", targetSign: "Cancer" });
  });

  it("emits nothing when a body is missing from either snapshot", () => {
    const events = detectSignificantTransits({}, SKY_EMPTY, merge(sky("saturn", 31)));
    expect(events).toEqual([]);
  });
});

describe("detectSignificantTransits — conjunction", () => {
  const natal: NatalPositions = { sun: { longitude: 100 } }; // 10° Cancer

  it("fires when a slow body brackets the natal Sun within the orb", () => {
    // yesterday 99° (sep -1), today 100.5° (sep +0.5) → crossed 0°, inside 1.5°
    const events = detectSignificantTransits(
      natal,
      merge(sky("saturn", 100.5)),
      merge(sky("saturn", 99)),
      1.5,
    );
    const conj = events.find((e) => e.eventType === "conjunction");
    expect(conj).toMatchObject({ body: "saturn", natalBody: "sun", eventType: "conjunction", targetSign: "Cancer" });
    // Both days sit in Cancer, so no spurious ingress is emitted.
    expect(events.filter((e) => e.eventType === "ingress")).toHaveLength(0);
  });

  it("respects the orb — a crossing outside it is ignored", () => {
    // today 103° → sep +3, beyond a 1.5° orb even though it crossed 0°.
    const events = detectSignificantTransits(
      natal,
      merge(sky("saturn", 103)),
      merge(sky("saturn", 99)),
      1.5,
    );
    expect(events.filter((e) => e.eventType === "conjunction")).toHaveLength(0);
  });

  it("handles the 0°/360° wrap when joining a near-Aries natal point", () => {
    const natal0: NatalPositions = { sun: { longitude: 1 } }; // 1° Aries
    // yesterday 359° (sep -2), today 0.5° (sep -0.5)? recompute: signedDelta(1,0.5) = -0.5 (same side).
    // Use yesterday 359.5 (sep -1.5) → today 2 (sep +1): sign flips, |today|<1.5.
    const events = detectSignificantTransits(
      natal0,
      merge(sky("jupiter", 2)),
      merge(sky("jupiter", 359.5)),
      1.5,
    );
    expect(events.find((e) => e.eventType === "conjunction")).toMatchObject({ body: "jupiter", natalBody: "sun" });
  });

  it("matches the natal Moon too", () => {
    const natalMoon: NatalPositions = { moon: { longitude: 250 } }; // Sagittarius
    const events = detectSignificantTransits(
      natalMoon,
      merge(sky("saturn", 250.4)),
      merge(sky("saturn", 249)),
      1.5,
    );
    expect(events.find((e) => e.eventType === "conjunction")).toMatchObject({ natalBody: "moon", targetSign: "Sagittarius" });
  });
});

describe("detectSignificantTransits — Mercury station", () => {
  it("fires on the retrograde flip and records the current sign", () => {
    const events = detectSignificantTransits(
      {},
      merge(sky("mercury", 50, true)), // 20° Taurus, now retrograde
      merge(sky("mercury", 49, false)), // was direct
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ body: "mercury", eventType: "station", retrograde: true, targetSign: "Taurus" });
  });

  it("fires on the direct station too", () => {
    const events = detectSignificantTransits(
      {},
      merge(sky("mercury", 50, false)), // now direct
      merge(sky("mercury", 51, true)), // was retrograde
    );
    expect(events[0]).toMatchObject({ eventType: "station", retrograde: false });
  });

  it("stays silent when direction is unchanged", () => {
    const events = detectSignificantTransits(
      {},
      merge(sky("mercury", 50, true)),
      merge(sky("mercury", 49, true)),
    );
    expect(events).toEqual([]);
  });
});

describe("detectSignificantTransits — composition & determinism", () => {
  it("carries the caller's date tag onto every event", () => {
    const events = detectSignificantTransits({}, merge(sky("saturn", 31)), merge(sky("saturn", 29)), 1.5, "2026-09-10");
    expect(events.every((e) => e.date === "2026-09-10")).toBe(true);
  });

  it("emits ingress + conjunction + station together when all fire", () => {
    const natal: NatalPositions = { sun: { longitude: 100 } };
    const events = detectSignificantTransits(
      natal,
      merge(sky("saturn", 31), sky("jupiter", 100.5), sky("mercury", 50, true)),
      merge(sky("saturn", 29), sky("jupiter", 99), sky("mercury", 49, false)),
      1.5,
    );
    const kinds = events.map((e) => e.eventType).sort();
    expect(kinds).toEqual(["conjunction", "ingress", "station"]);
  });

  it("is pure — same inputs yield an identical event list", () => {
    const natal: NatalPositions = { sun: { longitude: 100 }, moon: { longitude: 250 } };
    const today = merge(sky("saturn", 31), sky("jupiter", 100.5), sky("mercury", 50, true));
    const yest = merge(sky("saturn", 29), sky("jupiter", 99), sky("mercury", 49, false));
    expect(detectSignificantTransits(natal, today, yest, 1.5, "D")).toEqual(detectSignificantTransits(natal, today, yest, 1.5, "D"));
  });
});

describe("nudgeText", () => {
  it("is deterministic and draws on the sign theme (ingress)", () => {
    const event: TransitEvent = { kind: "transit", body: "saturn", eventType: "ingress", targetSign: "Capricorn", date: "" };
    const text = nudgeText(event);
    expect(text).toBe(nudgeText(event));
    expect(text).toContain("Saturn enters Capricorn");
    expect(text).toContain("structure, responsibility, and durable progress");
  });

  it("names the natal point for a conjunction", () => {
    const event: TransitEvent = { kind: "transit", body: "saturn", eventType: "conjunction", natalBody: "moon", targetSign: "Cancer", date: "" };
    expect(nudgeText(event)).toContain("Saturn joins your natal Moon");
    expect(nudgeText(event)).toContain("protection, belonging, and emotional context");
  });

  it("phrasing flips between backward and direct for a station", () => {
    const back: TransitEvent = { kind: "transit", body: "mercury", eventType: "station", retrograde: true, targetSign: "Gemini", date: "" };
    const fwd: TransitEvent = { kind: "transit", body: "mercury", eventType: "station", retrograde: false, targetSign: "Gemini", date: "" };
    expect(nudgeText(back)).toContain("Mercury is backward now");
    expect(nudgeText(fwd)).toContain("Mercury is direct now");
    expect(nudgeText(back)).toContain("curiosity, comparison, and communication");
  });
});

describe("resolveConjunctionOrb", () => {
  it("honors a valid string var", () => {
    expect(resolveConjunctionOrb({ TRANSIT_CONJUNCTION_ORB: "2.5" })).toBe(2.5);
  });

  it("accepts a native number too", () => {
    expect(resolveConjunctionOrb({ TRANSIT_CONJUNCTION_ORB: 3 })).toBe(3);
  });

  it("clamps out-of-range values back to the default", () => {
    expect(resolveConjunctionOrb({ TRANSIT_CONJUNCTION_ORB: "10" })).toBe(1.5);
    expect(resolveConjunctionOrb({ TRANSIT_CONJUNCTION_ORB: "-1" })).toBe(1.5);
  });

  it("ignores non-numeric and missing values, falling back to 1.5", () => {
    expect(resolveConjunctionOrb({ TRANSIT_CONJUNCTION_ORB: "abc" })).toBe(1.5);
    expect(resolveConjunctionOrb({})).toBe(1.5);
  });

  it("permits the boundary values 0 and 5", () => {
    expect(resolveConjunctionOrb({ TRANSIT_CONJUNCTION_ORB: "0" })).toBe(0);
    expect(resolveConjunctionOrb({ TRANSIT_CONJUNCTION_ORB: "5" })).toBe(5);
  });
});
