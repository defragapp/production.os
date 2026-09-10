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

function longitudeToSign(longitude: number): { sign: string; degree: number } {
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

function parseCsvLine(line: string): string[] {
  return line.split(",").map((f) => f.trim());
}

function parseHorizonsJson(payload: {
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
    if (!line) continue;
    const fields = parseCsvLine(line);
    const numeric = fields.map((f) => f.trim()).filter((f) => f !== "");
    if (numeric.length < 4) continue;

    const longitude = parseFloat(numeric[2]);
    const latitude = parseFloat(numeric[3]);
    if (!isNaN(longitude) && !isNaN(latitude)) {
      rows.push({ longitude, latitude });
    }
  }

  return rows;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHorizonsRows(
  env: AppEnv,
  targetId: string,
  instant: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<HorizonsRow[]> {
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

  const response = await fetchImpl(url.toString(), {
    headers: { "User-Agent": "Sovereign.OS Baseline Engine/2.0" },
  });

  if (!response.ok) throw new Error(`Horizons unavailable (${response.status})`);
  return parseHorizonsJson(await response.json());
}

/** Compute natal planetary positions for a given instant. */
export async function computeNatalPositions(
  env: AppEnv,
  instant: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, NatalPosition>> {
  const positions: Record<string, NatalPosition> = {};
  const entries = Object.entries(PLANET_IDS);
  const batchSize = 2;

  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);
    const resolved = await Promise.all(
      batch.map(async ([body, targetId]) => {
        const rows = await fetchHorizonsRows(env, targetId, instant, fetchImpl);
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

    if (offset + batchSize < entries.length) await delay(150);
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
