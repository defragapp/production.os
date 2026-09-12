import { describe, expect, it } from "vitest";
import { parseHorizonsJson, longitudeToSign } from "./nasa-jpl";

// Faithful excerpt of a real Horizons QUANTITIES=31 CSV response
// (Sun, geocentric, June 1990) — date tag + blank cols + ObsEcLon/ObsEcLat.
const REAL_PAYLOAD = {
  signature: { source: "NASA/JPL Horizons API", version: "1.1" },
  result: `Table format    : Comma Separated Values (spreadsheet)
*******************************************************************************
 Date__(UT)__HR:MN, , ,    ObsEcLon,   ObsEcLat,
************************************************
$$SOE
 1990-Jun-15 19:30, , ,  84.4280072,  0.0001185,
 1990-Jun-16 01:30, , ,  84.6667725,  0.0001249,
 1990-Jun-16 07:30, , ,  84.9055324,  0.0001309,
$$EOE
*******************************************************************************
Column meaning: ...`,
};

describe("parseHorizonsJson", () => {
  it("parses real CSV rows: date tag is not treated as a quantity", () => {
    const rows = parseHorizonsJson(REAL_PAYLOAD);
    expect(rows).toHaveLength(3);
    expect(rows[0].longitude).toBeCloseTo(84.4280072, 6);
    expect(rows[0].latitude).toBeCloseTo(0.0001185, 8);
    expect(rows[2].longitude).toBeCloseTo(84.9055324, 6);
  });

  it("keeps rows even when blank columns are absent", () => {
    const rows = parseHorizonsJson({
      signature: { source: "NASA/JPL Horizons API", version: "1.1" },
      result: "$$SOE\n 1990-Jun-15 19:30, 84.4280072, 0.0001185,\n$$EOE",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].longitude).toBeCloseTo(84.4280072, 6);
  });

  it("throws when the SOE/EOE block is missing", () => {
    expect(() =>
      parseHorizonsJson({
        signature: { source: "NASA/JPL Horizons API", version: "1.1" },
        result: "no ephemeris here",
      }),
    ).toThrow(/missing/);
  });

  it("throws on an error payload", () => {
    expect(() =>
      parseHorizonsJson({
        error: "bad",
        signature: { source: "NASA/JPL Horizons API", version: "1.1" },
      }),
    ).toThrow(/error payload/);
  });
});

describe("longitudeToSign", () => {
  it("maps 84.428° to Gemini at ~24.43°", () => {
    const r = longitudeToSign(84.4280072);
    expect(r.sign).toBe("Gemini");
    expect(r.degree).toBeCloseTo(24.428, 3);
  });
  it("wraps 0° to Aries", () => {
    expect(longitudeToSign(0).sign).toBe("Aries");
  });
  it("wraps 359.5° to Pisces", () => {
    expect(longitudeToSign(359.5).sign).toBe("Pisces");
  });
});
