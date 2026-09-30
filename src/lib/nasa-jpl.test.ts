import { describe, expect, it } from "vitest";
import { parseHorizonsJson, longitudeToSign, computeNatalPositions, ephemerisCacheKey, fetchHorizonsRows } from "./nasa-jpl";
import type { AppEnv } from "./env";

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

// ── Ephemeris KV cache & retry backoff ────────────────────────────────

function fakeResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

function fakeKv() {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    store,
    get: async (key: string) => store.get(key)?.value ?? null,
    put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, ttl: opts?.expirationTtl });
    },
  };
}

const INSTANT = new Date("1990-06-15T19:30:00Z");

function envWithKv(kv: ReturnType<typeof fakeKv> | null): AppEnv {
  return { SESSION_KV: kv, BASELINE_HORIZONS_URL: "" } as unknown as AppEnv;
}

describe("computeNatalPositions ephemeris cache", () => {
  it("without KV stays backward-compatible and hits the network for every body", async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls++; return fakeResponse(200, REAL_PAYLOAD); }) as typeof fetch;
    const positions = await computeNatalPositions(envWithKv(null), INSTANT, fetchImpl);
    expect(calls).toBe(10);
    expect(Object.keys(positions)).toHaveLength(10);
  });

  it("stores parsed rows on first fetch and skips outbound fetch on re-run", async () => {
    const kv = fakeKv();
    let calls = 0;
    const fetchImpl = (async () => { calls++; return fakeResponse(200, REAL_PAYLOAD); }) as typeof fetch;

    const first = await computeNatalPositions(envWithKv(kv), INSTANT, fetchImpl);
    expect(calls).toBe(10);
    expect(kv.store.size).toBe(10);
    // Historical ephemeris never changes — a 90-day TTL is safe.
    for (const entry of kv.store.values()) expect(entry.ttl).toBe(90 * 24 * 60 * 60);

    const second = await computeNatalPositions(envWithKv(kv), INSTANT, fetchImpl);
    expect(calls).toBe(10); // no additional outbound calls
    expect(JSON.stringify(second)).toBe(JSON.stringify(first)); // byte-identical
  });

  it("cache-hit results are byte-identical to the no-cache results", async () => {
    const fetchImpl = (async () => fakeResponse(200, REAL_PAYLOAD)) as typeof fetch;
    const uncached = await computeNatalPositions(envWithKv(null), INSTANT, fetchImpl);

    const kv = fakeKv();
    await computeNatalPositions(envWithKv(kv), INSTANT, fetchImpl); // warm
    const cached = await computeNatalPositions(envWithKv(kv), INSTANT, fetchImpl);
    expect(JSON.stringify(cached)).toBe(JSON.stringify(uncached));
  });

  it("ephemerisCacheKey is minute-precise and target-scoped", () => {
    const key = ephemerisCacheKey("10", INSTANT);
    expect(key).toBe("eph:10:1990-06-15T19:30");
    // Same minute → same key (cache hit); different minute or body → different key.
    expect(ephemerisCacheKey("10", new Date("1990-06-15T19:30:59Z"))).toBe(key);
    expect(ephemerisCacheKey("301", INSTANT)).not.toBe(key);
  });

  it("retries transient 503 with backoff and succeeds", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      // First Sun request fails transiently; everything after succeeds.
      if (calls === 1) return fakeResponse(503, { error: "busy" });
      return fakeResponse(200, REAL_PAYLOAD);
    }) as unknown as typeof fetch;

    const kv = fakeKv();
    const positions = await computeNatalPositions(envWithKv(kv), INSTANT, fetchImpl);
    expect(positions.sun.sign).toBe("Gemini");
    expect(calls).toBe(11); // 10 bodies + 1 retry
  });

  it("does not retry deterministic 4xx rejections", async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls++; return fakeResponse(400, { error: "bad query" }); }) as typeof fetch;
    await expect(
      computeNatalPositions(envWithKv(null), INSTANT, fetchImpl),
    ).rejects.toThrow(/Horizons unavailable \(400\)/);
    // All 10 bodies fire in one wave (batchSize === PLANET_IDS count); each
    // is tried exactly once by fetchWithBackoff (deterministic 4xx is never
    // retried). Promise.all rejects after every started fetch settles its
    // first attempt — the assertion here is "no retry storm", not "batch = 2".
    expect(calls).toBe(10);
  });
});

// ── Isolate-level in-flight coalescing ────────────────────────────────

describe("fetchHorizonsRows request coalescing", () => {
  it("collapses concurrent calls for the same target+minute into one outbound fetch", async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls++; return fakeResponse(200, REAL_PAYLOAD); }) as typeof fetch;
    // Null KV so the cache can't be what dedupes — only the in-flight map.
    const env = envWithKv(null);
    const targetId = "10";
    const [a, b, c] = await Promise.all([
      fetchHorizonsRows(env, targetId, INSTANT, fetchImpl),
      fetchHorizonsRows(env, targetId, INSTANT, fetchImpl),
      fetchHorizonsRows(env, targetId, INSTANT, fetchImpl),
    ]);
    expect(calls).toBe(1);
    // Every concurrent caller resolves from the single shared promise.
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("does not coalesce across different targets or minutes", async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls++; return fakeResponse(200, REAL_PAYLOAD); }) as typeof fetch;
    const env = envWithKv(null);
    await Promise.all([
      fetchHorizonsRows(env, "299", INSTANT, fetchImpl),
      fetchHorizonsRows(env, "499", INSTANT, fetchImpl),
      fetchHorizonsRows(env, "599", new Date("1990-06-15T19:31:00Z"), fetchImpl),
    ]);
    expect(calls).toBe(3);
  });

  it("clears the in-flight entry so a later call reaches the network again", async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls++; return fakeResponse(200, REAL_PAYLOAD); }) as typeof fetch;
    const env = envWithKv(null);
    await fetchHorizonsRows(env, "699", INSTANT, fetchImpl);
    await fetchHorizonsRows(env, "699", INSTANT, fetchImpl);
    expect(calls).toBe(2);
  });
});
