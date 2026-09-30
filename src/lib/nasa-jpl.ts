/**
 * NASA/JPL Horizons API integration — extracted from sovv-web.
 * Fetches planetary positions for natal chart computation.
 */
import type { AppEnv } from "./env";

const DEFAULT_HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";

const PLANET_IDS: Record<string, string> = {
  sun: "10",
  moon: "301",
  mercury: "199",
  venus: "299",
  mars: "499",
  jupiter: "599",
  saturn: "699",
  uranus: "799",
  neptune: "899",
  pluto: "999",
};

const SIGN_THEMES: Record<string, string> = {
  Aries: "direct action and clear initiation",
  Taurus: "stability, pacing, and practical continuity",
  Gemini: "curiosity, comparison, and communication",
  Cancer: "protection, belonging, and emotional context",
  Leo: "visible expression, authorship, and creative direction",
  Virgo: "discernment, usefulness, and careful refinement",
  Libra: "reciprocity, perspective, and relational balance",
  Scorpio: "depth, trust, and consequential change",
  Sagittarius: "meaning, exploration, and wider possibility",
  Capricorn: "structure, responsibility, and durable progress",
  Aquarius: "independence, systems, and unconventional perspective",
  Pisces: "sensitivity, imagination, and porous context",
};

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

interface NatalPosition {
  longitude: number;
  latitude: number;
  retrograde: boolean;
  sign: string;
  degree: number;
}

interface HorizonsRow {
  longitude: number;
  latitude: number;
}

export function longitudeToSign(longitude: number): { sign: string; degree: number } {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degree = normalized % 30;
  return { sign: ZODIAC_SIGNS[signIndex], degree };
}

function signedLongitudeDelta(a: number, b: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function horizonsDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const y = date.getUTCFullYear();
  const m = months[date.getUTCMonth()];
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

/** Parse a Horizons JSON payload into ephemeris rows. Exported for tests. */
export function parseHorizonsJson(payload: {
  error?: string;
  message?: string;
  signature?: { source?: string; version?: string };
  result?: string;
}): HorizonsRow[] {
  if (payload.error || payload.message) {
    throw new Error("Horizons returned an error payload");
  }

  const source = payload.signature?.source ?? "";
  const version = payload.signature?.version ?? "";
  if (!/NASA\/JPL Horizons API/i.test(source) || !/^1\./.test(version)) {
    throw new Error("Unexpected Horizons API signature");
  }

  const result = payload.result ?? "";
  const block = result.match(/\$\$SOE([\s\S]*?)\$\$EOE/)?.[1];
  if (!block) throw new Error("Horizons ephemeris rows were missing");

  const rows: HorizonsRow[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("$$")) continue;
    const fields = line.split(",").map((f) => f.trim());
    // CSV format: "<UT date tag>, <blank>, <blank>, <lon>, <lat>, <trailing>"
    // fields[0] is the date tag; remaining non-empty fields are quantities.
    const values = fields
      .slice(1)
      .filter((f) => f !== "")
      .map((f) => parseFloat(f))
      .filter((n) => !isNaN(n));
    if (values.length < 2) continue;
    rows.push({ longitude: values[0], latitude: values[1] });
  }

  return rows;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Ephemeris cache & retry resilience ────────────────────────────────
// Historical ephemeris rows for a given UTC instant never change, so a
// confirmed response is cached in SESSION_KV for 90 days. Repeat or nearby
// submissions (same birth minute, re-run after a transient NASA failure)
// resolve locally instead of fanning out to ssd.jpl.nasa.gov again.
const EPHEMERIS_CACHE_TTL_S = 90 * 24 * 60 * 60;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 250; // 250ms → 1000ms exponential backoff between attempts
// A hard wall-clock ceiling on one Horizons call (all retries included). It
// also bounds the isolate-level coalescing below: the shared in-flight promise
// is guaranteed to settle, so a stalled socket can never poison a cache key for
// the rest of the isolate's life.
const HORIZONS_TIMEOUT_MS = 15000;

/** KV key at minute precision — the exact granularity of the Horizons
 *  START_TIME parameter, so a hit is always an equivalent query. */
export function ephemerisCacheKey(targetId: string, instant: Date): string {
  return `eph:${targetId}:${instant.toISOString().slice(0, 16)}`;
}

/** Minimal KV shape so pure unit tests can pass a Map-backed fake, and a
 *  KV-less env (legacy callers, tests) simply disables the cache. */
type EphemerisKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<unknown>;
} | null | undefined;

function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/** Fetch with bounded exponential backoff on transient 5xx/429/network
 *  errors. Deterministic 4xx responses return immediately — retrying a bad
 *  query would just repeat the same rejection. */
async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, init);
      if (!isTransientStatus(response.status)) return response;
      lastError = new Error(`Horizons unavailable (${response.status})`);
    } catch (err) {
      lastError = err; // network failure / timeout — worth another attempt
    }
    if (attempt < MAX_ATTEMPTS - 1) await delay(RETRY_BASE_MS * 4 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error("Horizons request failed after retries");
}

async function loadHorizonsRows(
  env: AppEnv,
  targetId: string,
  instant: Date,
  cacheKey: string,
  fetchImpl: typeof fetch = fetch,
  trace?: { fetched: boolean },
): Promise<HorizonsRow[]> {
  const kv: EphemerisKv = env?.SESSION_KV ?? null;

  // Cache reads are best-effort: a KV hiccup must never fail the Baseline —
  // we just fall through to the live API like before the cache existed.
  if (kv) {
    try {
      const hit = await kv.get(cacheKey);
      if (hit) return JSON.parse(hit) as HorizonsRow[];
    } catch {}
  }

  const stop = new Date(instant.getTime() + 12 * 60 * 60 * 1000);
  const url = new URL(env.BASELINE_HORIZONS_URL || DEFAULT_HORIZONS_URL);
  const params: Record<string, string> = {
    format: "json",
    COMMAND: `'${targetId}'`,
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: `'500@399'`,
    START_TIME: `'${horizonsDate(instant)}'`,
    STOP_TIME: `'${horizonsDate(stop)}'`,
    STEP_SIZE: `'6 h'`,
    QUANTITIES: `'31'`,
    CSV_FORMAT: "YES",
    CAL_FORMAT: "CAL",
    CAL_TYPE: "GREGORIAN",
    EXTRA_PREC: "YES",
  };

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  if (trace) trace.fetched = true;
  const response = await fetchWithBackoff(url.toString(), {
    headers: { "User-Agent": "Sovereign.OS Baseline Engine/2.0" },
    signal: AbortSignal.timeout(HORIZONS_TIMEOUT_MS),
  }, fetchImpl);

  if (!response.ok) throw new Error(`Horizons unavailable (${response.status})`);
  const rows = parseHorizonsJson(await response.json());

  if (kv && rows.length > 0) {
    try {
      await kv.put(cacheKey, JSON.stringify(rows), { expirationTtl: EPHEMERIS_CACHE_TTL_S });
    } catch {}
  }
  return rows;
}

// Isolate-level request coalescing. Historical ephemeris rows for a given
// target + UTC minute never change, so two onboarding submissions that land in
// the same isolate for the SAME uncached minute should fan out to NASA once, not
// twice. A shared in-flight promise keyed by the cache key collapses the
// concurrent calls; it is cleared the moment the request settles so a later
// (genuinely new) call still reaches the network. The 90-day KV cache above
// handles the cross-isolate / repeat case; this handles the thundering-herd one.
const inFlight = new Map<string, Promise<HorizonsRow[]>>();

/** Internal per-target fetch. Exported only so the isolate-level coalescing
 *  behaviour can be unit-tested directly; production callers go through
 *  computeNatalPositions. */
export async function fetchHorizonsRows(
  env: AppEnv,
  targetId: string,
  instant: Date,
  fetchImpl: typeof fetch = fetch,
  trace?: { fetched: boolean },
): Promise<HorizonsRow[]> {
  const cacheKey = ephemerisCacheKey(targetId, instant);
  const shared = inFlight.get(cacheKey);
  if (shared) {
    // Joining a call this isolate did not start: it never touched the network
    // on this caller's behalf, so leave its courtesy-delay trace unset.
    return shared;
  }
  const p = loadHorizonsRows(env, targetId, instant, cacheKey, fetchImpl, trace).finally(() => {
    inFlight.delete(cacheKey);
  });
  inFlight.set(cacheKey, p);
  return p;
}

/** Compute natal planetary positions for a given instant.
 *
 *  All ten bodies fan out concurrently in one batch. The batch size is
 *  deliberately equal to `PLANET_IDS` length so the inter-batch courtesy
 *  delay below never fires — one wave, one wall-clock, ~1.2–2.5 s.
 *  Workers Free permits 50 subrequests per invocation and Workers Paid
 *  permits 10,000, so ten concurrent Horizons calls are safe on either
 *  plan. `fetchWithBackoff` (3 attempts, 250 ms → 1 s → 4 s) is the
 *  sole protection against transient 5xx/429 from NASA/JPL; the
 *  isolate-level `inFlight` coalescer above prevents two onboarding
 *  submissions in the same isolate from doubling the outbound fan-out
 *  on cold minute buckets. */
export async function computeNatalPositions(
  env: AppEnv,
  instant: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, NatalPosition>> {
  const positions: Record<string, NatalPosition> = {};
  const entries = Object.entries(PLANET_IDS);
  const batchSize = 10;

  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);
    // The inter-batch pause exists to be courteous to NASA. With
    // batchSize === entries.length there is only one wave and the guard
    // below short-circuits to false; the delay is retained so a future
    // narrowing of batchSize keeps its safety semantics.
    const trace = { fetched: false };
    const resolved = await Promise.all(
      batch.map(async ([body, targetId]) => {
        const rows = await fetchHorizonsRows(env, targetId, instant, fetchImpl, trace);
        if (!rows.length) return null;
        const first = rows[0];
        const second = rows[1];
        const sign = longitudeToSign(first.longitude);
        return [
          body,
          {
            longitude: first.longitude,
            latitude: first.latitude,
            retrograde: Boolean(second && signedLongitudeDelta(first.longitude, second.longitude) < 0),
            sign: sign.sign,
            degree: sign.degree,
          },
        ] as [string, NatalPosition];
      }),
    );

    for (const result of resolved) {
      if (result) positions[result[0]] = result[1];
    }

    if (trace.fetched && offset + batchSize < entries.length) await delay(150);
  }

  return positions;
}

/** Build the astrology portion of the baseline from natal positions. */
export function buildAstrologyBaseline(positions: Record<string, NatalPosition>): Record<string, unknown> {
  const planets: Record<string, unknown> = {};
  for (const [body, pos] of Object.entries(positions)) {
    planets[body] = {
      sign: pos.sign,
      degree: Math.round(pos.degree * 100) / 100,
      retrograde: pos.retrograde,
      longitude: Math.round(pos.longitude * 10000) / 10000,
      theme: SIGN_THEMES[pos.sign] ?? "unknown",
    };
  }

  return {
    planets,
    sunSign: positions.sun?.sign ?? "Unknown",
    moonSign: positions.moon?.sign ?? "Unknown",
    risingSign: "Unknown",
    source: "NASA/JPL Horizons API",
    observerCenter: "Earth geocenter 500@399",
  };
}

export { PLANET_IDS, SIGN_THEMES, ZODIAC_SIGNS, DEFAULT_HORIZONS_URL };
