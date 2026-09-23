/**
 * Sovereign Human Design + Gene Keys computation.
 *
 * Computes the 64 gates from natal ecliptic longitudes, maps them onto the
 * nine centers, derives the defined centers / active channels, and produces
 * Type / Strategy / Authority / Profile plus a Gene Keys reading.
 *
 * Conventions used:
 *  - longs are normalized to [0, 360); each gate spans 5.625°; the first gate
 *    (41) begins at 0° Aries. This is the standard fixed gate wheel.
 *  - Gates are derived from the ten natal bodies we fetch from NASA/JPL
 *    (Sun..Pluto); lunar nodes are intentionally excluded from this engine.
 *  - A center is "defined" when at least one of its gates is occupied; a
 *    channel is "active" when BOTH of its gates are occupied.
 *  - Design Sun (Profile) is approximated as the Personality Sun minus 88°.
 *
 * This is a computational derivation for reflective context, not doctrine.
 */

export interface HumanDesignGate {
  gate: number;
  line: number;
  center: string;
  body: string;
  theme: string;
}

export interface DefinedChannel {
  gates: [number, number];
  centers: [string, string];
  name: string;
}

export interface GeneKeyReading {
  gate: number;
  line: number;
  frequency: "Shadow" | "Gift" | "Siddhi";
  body: string;
  theme: string;
}

export interface HumanDesignComputation {
  gates: HumanDesignGate[];
  definedCenters: string[];
  definedChannels: DefinedChannel[];
  type: string;
  strategy: string;
  authority: string;
  profile: string;
  sunGate: number;
  sunLine: number;
  designSunGate: number;
  designSunLine: number;
  geneKeys: GeneKeyReading[];
}

// The 64 gates in wheel order, starting at 0° Aries (Gate 41).
export const GATE_WHEEL: number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
];

const GATE_SPAN = 360 / 64; // 5.625°
const LINE_SPAN = GATE_SPAN / 6; // 0.9375°

/** Gate → center. The nine centers use the standard IHDS gate assignment. */
export const GATE_TO_CENTER: Record<number, string> = {
  // Head
  61: "Head", 63: "Head", 64: "Head",
  // Ajna
  11: "Ajna", 17: "Ajna", 43: "Ajna", 4: "Ajna", 24: "Ajna", 47: "Ajna",
  // Throat
  8: "Throat", 16: "Throat", 20: "Throat", 23: "Throat", 31: "Throat",
  33: "Throat", 12: "Throat", 35: "Throat", 45: "Throat", 56: "Throat", 62: "Throat",
  // G
  1: "G", 2: "G", 7: "G", 10: "G", 13: "G", 14: "G", 15: "G", 25: "G", 46: "G",
  // Ego / Heart
  21: "Ego", 26: "Ego", 40: "Ego", 51: "Ego",
  // Solar Plexus
  6: "Solar Plexus", 22: "Solar Plexus", 30: "Solar Plexus",
  36: "Solar Plexus", 37: "Solar Plexus", 49: "Solar Plexus", 55: "Solar Plexus",
  // Sacral
  3: "Sacral", 5: "Sacral", 9: "Sacral", 27: "Sacral",
  29: "Sacral", 34: "Sacral", 42: "Sacral", 59: "Sacral",
  // Spleen
  18: "Spleen", 28: "Spleen", 32: "Spleen", 44: "Spleen",
  48: "Spleen", 50: "Spleen", 57: "Spleen",
  // Root
  19: "Root", 38: "Root", 39: "Root", 41: "Root", 52: "Root",
  53: "Root", 54: "Root", 58: "Root", 60: "Root",
};

/** Active gate-pair channels between centers (each latched gate pair). */
export const CHANNEL_GATE_PAIRS: Array<[number, number, string]> = [
  [1, 8, "Creativity"], [2, 14, "The Beat"], [3, 60, "Mutation"],
  [4, 63, "Logic"], [5, 15, "Rhythm"], [6, 59, "Mating"],
  [7, 31, "The Alpha"], [9, 52, "Concentration"], [10, 20, "Awakening"],
  [10, 34, "Exploration"], [11, 56, "Curiosity"], [12, 22, "Openness"],
  [13, 33, "The Witness"], [16, 48, "Talent"], [17, 62, "Acceptance"],
  [18, 58, "Judgment"], [19, 49, "Synthesis"], [20, 57, "The Brainwave"],
  [21, 45, "Money"], [23, 43, "Structuring"], [24, 61, "Awareness"],
  [25, 51, "Initiation"], [26, 44, "The Transmitter"], [27, 50, "Preservation"],
  [28, 38, "Struggle"], [29, 46, "Discovery"], [30, 41, "Recognition"],
  [32, 54, "Transformation"], [34, 57, "Power"], [35, 36, "Transitoriness"],
  [37, 40, "Community"], [39, 55, "Emoting"], [42, 53, "Maturation"],
  [47, 64, "Abstraction"],
];

/** Short reflexive theme labels for 64-gate storytelling (context, not verdict). */
export const GATE_THEMES: Record<number, string> = {
  1: "creative self-expression", 2: "direction and coherence", 3: "ordering chaos",
  4: "formulating answers", 5: "fixed rhythm and flow", 6: "emotional intimacy",
  7: "leading the flow", 8: "speaking contribution", 9: "focus and persistence",
  10: "self-validating behavior", 11: "ideas and imagery", 12: "restraint in speech",
  13: "listening and witness", 14: "power skills", 15: "extreme order or rhythm",
  16: "skills and enthusiasm", 17: "opinions and perspectives", 18: "correction",
  19: "need and sensitivity to others", 20: "present moment seeing", 21: "hunter control",
  22: "gracious open-heartedness", 23: "assimilating vast knowledge", 24: "rationalizing",
  25: "spirit and innocence", 26: "the egoist transmitting", 27: "selfless caring",
  28: "struggle against meaninglessness", 29: "perseverance", 30: "clinging to feelings",
  31: "influencing with words", 32: "continuity and duration", 33: "privacy and retreat",
  34: "power and pure force", 35: "change and progress", 36: "crisis and shadow",
  37: "friendship and community", 38: "the fighter resisting", 39: "provoking and spirit",
  40: "solitude and leadership", 41: "fantasy and imagination", 42: "growing and finishing",
  43: "insight and breakthrough", 44: "alertness to patterns", 45: "gathering and leadership",
  46: "the drive toward success", 47: "solving the abstract", 48: "depth of perception",
  49: "principles and responses", 50: "values and worth", 51: "initiation and shock",
  52: "stillness and pressure", 53: "beginnings and cycles", 54: "ambition and drive",
  55: "spirit and abundance", 56: "the storyteller", 57: "intuitive clarity",
  58: "vitality and improvement", 59: "intimacy and mating", 60: "acceptance of limits",
  61: "mystery and inspiration", 62: "detail and precision", 63: "doubt and questioning",
  64: "confusion and imagination",
};

/** Gene Keys frequencies by line (1/2 Shadow; 3/4 Gift; 5/6 Siddhi). */
function geneKeyFrequency(line: number): GeneKeyReading["frequency"] {
  if (line === 1 || line === 2) return "Shadow";
  if (line === 3 || line === 4) return "Gift";
  return "Siddhi";
}

export function normalizeLongitude(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

export function longitudeToGate(longitude: number): { gate: number; line: number } {
  const norm = normalizeLongitude(longitude);
  const idx = Math.floor(norm / GATE_SPAN);
  const gate = GATE_WHEEL[idx % 64];
  const line = Math.min(6, Math.floor((norm % GATE_SPAN) / LINE_SPAN) + 1);
  return { gate, line };
}

export function gateToLineString(longitude: number): { gate: number; line: number } {
  return longitudeToGate(longitude);
}

const DESIGN_SUN_OFFSET = 88;

/** Derive Design Sun position by rotating the Personality Sun ~88° backwards. */
export function designSunLongitude(longitude: number): number {
  return normalizeLongitude(longitude - DESIGN_SUN_OFFSET);
}

/** Centers that count as "motor" for Type derivation. */
const MOTOR_CENTERS = new Set(["Ego", "Solar Plexus", "Sacral", "Root"]);

function resolveType(definedCenters: string[], activeChannels: DefinedChannel[]): {
  type: string;
  strategy: string;
} {
  const centers = new Set(definedCenters);
  if (centers.size === 0) return { type: "Reflector", strategy: "Wait for the Lunar Cycle" };
  const sacral = centers.has("Sacral");
  const throat = centers.has("Throat");
  const channelConnectsToThroat = activeChannels.some((c) => c.centers.includes("Throat"));
  const motorConnectsToThroat = activeChannels.some(
    (c) => c.centers.includes("Throat") && MOTOR_CENTERS.has(c.centers[0] === "Throat" ? c.centers[1] : c.centers[0]),
  );
  if (sacral && throat && motorConnectsToThroat) return { type: "Manifesting Generator", strategy: "To Respond" };
  if (sacral) return { type: "Generator", strategy: "To Respond" };
  if (throat) {
    const hasDefinedMotor = ["Ego", "Solar Plexus", "Root"].some((c) => centers.has(c));
    if ((hasDefinedMotor && (channelConnectsToThroat || motorConnectsToThroat)) || (hasDefinedMotor && !centers.has("Spleen"))) {
      return { type: "Manifestor", strategy: "To Inform" };
    }
    return { type: "Projector", strategy: "Wait for the Invitation" };
  }
  return { type: "Projector", strategy: "Wait for the Invitation" };
}

function resolveAuthority(definedCenters: string[], type: string): string {
  const centers = new Set(definedCenters);
  if (type === "Reflector") return "Lunar (surrounding the moon's cycle)";
  if (centers.has("Solar Plexus")) return "Emotional (solar plexus)";
  if (centers.has("Sacral")) return "Sacral";
  if (centers.has("Spleen")) return "Splenic (the spleen)";
  if (centers.has("Ego")) return "Ego (heart)";
  if (centers.has("G")) return "Self-Projected (G center)";
  return "External (no single defined authority above the mind)";
}

/**
 * Compute the full Human Design + Gene Keys derivation from natal positions.
 * `positions` maps body name → ecliptic longitude in degrees.
 */
export function computeHumanDesign(
  positions: Record<string, { longitude: number }>,
): HumanDesignComputation {
  const gates: HumanDesignGate[] = [];
  const occupied = new Set<number>();

  for (const [body, pos] of Object.entries(positions)) {
    const { gate, line } = longitudeToGate(pos.longitude);
    const center = GATE_TO_CENTER[gate];
    if (!center) continue;
    occupied.add(gate);
    gates.push({
      gate,
      line,
      center,
      body,
      theme: GATE_THEMES[gate] ?? "unnamed quality",
    });
  }
  gates.sort((a, b) => b.gate - a.gate);

  const definedCenters = [...new Set(gates.map((g) => g.center))].sort();
  const definedChannels: DefinedChannel[] = CHANNEL_GATE_PAIRS
    .filter(([a, b]) => occupied.has(a) && occupied.has(b))
    .map(([a, b, name]) => ({
      gates: [a, b],
      centers: [GATE_TO_CENTER[a], GATE_TO_CENTER[b]],
      name,
    }));

  const { type, strategy } = resolveType(definedCenters, definedChannels);
  const authority = resolveAuthority(definedCenters, type);

  const sun = positions.sun ? longitudeToGate(positions.sun.longitude) : { gate: 0, line: 0 };
  const designSunPos = positions.sun ? designSunLongitude(positions.sun.longitude) : 0;
  const designSun = longitudeToGate(designSunPos);
  const profile = sun.gate ? `${sun.line}/${designSun.line}` : "0/0";

  const geneKeys: GeneKeyReading[] = gates.map((g) => ({
    gate: g.gate,
    line: g.line,
    frequency: geneKeyFrequency(g.line),
    body: g.body,
    theme: GATE_THEMES[g.gate] ?? "unnamed quality",
  }));

  return {
    gates,
    definedCenters,
    definedChannels,
    type,
    strategy,
    authority,
    profile,
    sunGate: sun.gate,
    sunLine: sun.line,
    designSunGate: designSun.gate,
    designSunLine: designSun.line,
    geneKeys,
  };
}

/** A shared gate between two designs — used for between-person context. */
export interface SharedGate {
  gate: number;
  bodyA: string;
  bodyB: string | null;
  theme: string;
}

export interface BetweenDesigns {
  sharedGates: SharedGate[];
  unionDefinedCenters: string[];
  jointChannels: DefinedChannel[];
  summary: string[];
}

/**
 * Compare two computed designs. Only meaningful IDs/qualities — never raw
 * coordinates — are extracted, so this is safe to place in a consented prompt.
 */
export function compareDesigns(a: HumanDesignComputation, b: HumanDesignComputation): BetweenDesigns {
  const gatesA = new Map(a.gates.map((g) => [g.gate, g]));
  const gatesB = new Map(b.gates.map((g) => [g.gate, g]));

  const sharedGates: SharedGate[] = [...gatesA.entries()]
    .filter(([gate]) => gatesB.has(gate))
    .map(([gate, ga]) => ({
      gate,
      bodyA: ga.body,
      bodyB: gatesB.get(gate)?.body ?? null,
      theme: GATE_THEMES[gate] ?? "unnamed quality",
    }))
    .sort((ga, gb) => ga.gate - gb.gate);

  const occupied = new Set<number>([...gatesA.keys(), ...gatesB.keys()]);
  const jointChannels: DefinedChannel[] = CHANNEL_GATE_PAIRS
    .filter(([ga, gb]) => occupied.has(ga) && occupied.has(gb))
    .map(([ga, gb, name]) => ({
      gates: [ga, gb],
      centers: [GATE_TO_CENTER[ga], GATE_TO_CENTER[gb]],
      name,
    }));

  const unionDefinedCenters = [...new Set([...a.definedCenters, ...b.definedCenters])].sort();

  const summary: string[] = [];
  for (const ch of jointChannels) {
    const [ga] = ch.gates;
    const g = gatesA.get(ga) ?? gatesB.get(ga);
    if (g) {
      summary.push(`The ${ch.gates.join("–")} ("${ch.name}") channel draws ${GATE_THEMES[ga] ?? "a shared quality"} together in the pair — activation between these two designs, not a verdict on either person.`);
    }
  }
  if (sharedGates.length) {
    summary.push(`Their designs both carry gate ${sharedGates.map((s) => s.gate).slice(0, 6).join(", ")} — overlapping qualities worth watching as a shared tendency.`);
  }
  if (summary.length === 0) {
    summary.push("Their computed designs show no shared activated gates from these ten bodies — the connecting work happens where their qualities do not overlap, not where they do.");
  }

  return { sharedGates, unionDefinedCenters, jointChannels, summary };
}