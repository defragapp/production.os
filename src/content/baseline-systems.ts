/**
 * The reference systems that compose your Baseline — the single source of
 * truth for every public page that names them.
 *
 * The computation in /api/baseline (`storeBaseline`) builds exactly these:
 * astrology from NASA/JPL planetary positions, numerology (life path + birth
 * day), Human Design, and the Gene Keys derived from the same chart. Public
 * copy used to drift from the engine — the FAQ listed "numerology and Human
 * Design", /about disclaimed "not astrology" — so every surface now reads this
 * list instead of hand-writing it. If the engine changes, change this array.
 */
export const BASELINE_SYSTEMS = [
  "Astrology",
  "Numerology",
  "Human Design",
  "Gene Keys",
] as const;

/** The provenance chip shown alongside the systems on the landing trust row. */
export const BASELINE_PROVENANCE = "NASA/JPL planetary data";

// Astrology and numerology are common nouns and lower-case mid-sentence; Human
// Design and Gene Keys are named systems and keep their capitals (AGENTS.md:
// proper nouns keep capitals).
const COMMON_NOUN_SYSTEMS = new Set<string>(["Astrology", "Numerology"]);

/**
 * The systems named in running prose — e.g. "astrology, numerology, Human
 * Design, and Gene Keys" — derived from BASELINE_SYSTEMS so the sentence can
 * never fall out of sync with the array.
 */
export function baselineSystemsPhrase(): string {
  const parts = BASELINE_SYSTEMS.map((s) =>
    COMMON_NOUN_SYSTEMS.has(s) ? s.toLowerCase() : s,
  );
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
