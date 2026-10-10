/**
 * Deterministic transit-nudge signals (Turn 10).
 *
 * Pure, clock-free astrology math: given a person's natal longitudes plus the
 * live sky today and yesterday, surface the handful of transits that actually
 * "mean something" — a slow planet crossing a sign boundary, Saturn/Jupiter
 * joining the natal Sun or Moon, or Mercury stationing retrograde/direct — and
 * turn each into a short, epistemically soft line of copy.
 *
 * Deliberately NO environment reads and NO Date.now() inside the detector: the
 * caller (the daily cron) resolves the orb knob once and passes both ephemeris
 * snapshots in, so this stays trivially unit-testable and never surprises. Copy
 * phrasing is kept soft — context, not verdict — consistent with the safety
 * lexicon elsewhere in the reasoning layer.
 */
import { longitudeToSign, SIGN_THEMES } from "./nasa-jpl";

/** Natal chart: body → ecliptic longitude (retrograde carried when known). */
export type NatalPositions = Record<string, { longitude: number; retrograde?: boolean }>;
/** Live sky at a given instant: body → longitude + apparent motion direction. */
export type CurrentPositions = Record<string, { longitude: number; retrograde: boolean }>;

export interface TransitEvent {
  kind: "transit";
  /** The transiting body that triggered the event (saturn | jupiter | mercury). */
  body: string;
  eventType: "ingress" | "conjunction" | "station";
  /** Sign the transiting body currently occupies (ingress target / station sign). */
  targetSign?: string;
  /** For a conjunction: which natal point the transit is joining. */
  natalBody?: "sun" | "moon";
  /** For a station: whether Mercury is going retrograde (true) or direct (false). */
  retrograde?: boolean;
  /** Day-stamp the caller tags the event with ("" for a pure unit call). */
  date: string;
}

const ORB_DEFAULT = 1.5;
const ORB_MAX = 5;
/** The slow movers worth a sign-ingress or a natal conjunction nudge. */
const SLOW_BODIES = ["saturn", "jupiter"] as const;
/** The natal points a slow-body conjunction is meaningful against. */
const NATAL_TARGETS: Array<"sun" | "moon"> = ["sun", "moon"];

/** Signed angular distance b - a, wrapped to (-180, 180]. Local copy of the
 *  private helper in nasa-jpl so transit math stays self-contained. */
function signedDelta(a: number, b: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function signOf(longitude: number): string {
  return longitudeToSign(longitude).sign;
}

/** Body name → display casing ("Saturn"); falls back to the raw key. */
function titleBody(body: string): string {
  return body.charAt(0).toUpperCase() + body.slice(1);
}

/**
 * Resolve the conjunction orb from env, mirroring chat-recall.resolveScoreFloor:
 * the Workers runtime delivers plain-text [vars] as a STRING, so coerce
 * defensively and clamp to a sane orb (0..5 degrees). A malformed or
 * out-of-band value falls back to the module default rather than silently
 * disabling or over-firing nudges. Exported so the cron resolves it once per
 * scan and hands the number to the pure detector.
 */
export function resolveConjunctionOrb(env: { TRANSIT_CONJUNCTION_ORB?: unknown }): number {
  const raw = env.TRANSIT_CONJUNCTION_ORB as unknown;
  const n = typeof raw === "string" ? Number(raw) : (raw as number | undefined);
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= ORB_MAX ? n : ORB_DEFAULT;
}

/**
 * Detect the significant transits that crossed between `yesterday` and `today`
 * against a natal chart. Pure and order-stable (Saturn then Jupiter for each
 * category) so the same inputs always yield the same events.
 *
 *   - Ingress: a slow body's sign differs today vs yesterday.
 *   - Conjunction: a slow body's signed separation from the natal Sun/Moon
 *     changes sign across the two days (it crossed 0°) and now sits within the
 *     orb.
 *   - Mercury station: apparent direction flipped between the two days.
 */
export function detectSignificantTransits(
  natal: NatalPositions,
  today: CurrentPositions,
  yesterday: CurrentPositions,
  orbDeg: number = ORB_DEFAULT,
  date = "",
): TransitEvent[] {
  const events: TransitEvent[] = [];

  for (const body of SLOW_BODIES) {
    const t = today[body];
    const y = yesterday[body];
    if (!t || !y) continue;

    // 1. Sign ingress — the boundary was crossed in the last day.
    const signToday = signOf(t.longitude);
    const signYesterday = signOf(y.longitude);
    if (signToday !== signYesterday) {
      events.push({ kind: "transit", body, eventType: "ingress", targetSign: signToday, date });
    }

    // 2. Conjunction to a natal point — separation bracketed 0° within the orb.
    for (const natalBody of NATAL_TARGETS) {
      const natalPoint = natal[natalBody];
      if (!natalPoint) continue;
      const sepToday = signedDelta(natalPoint.longitude, t.longitude);
      const sepYesterday = signedDelta(natalPoint.longitude, y.longitude);
      const crossed = Math.sign(sepToday) !== Math.sign(sepYesterday) && sepToday !== 0 && sepYesterday !== 0;
      if (crossed && Math.abs(sepToday) < orbDeg) {
        events.push({
          kind: "transit",
          body,
          eventType: "conjunction",
          natalBody,
          targetSign: signToday,
          date,
        });
      }
    }
  }

  // 3. Mercury station — apparent direction flipped (retrograde start or direct).
  const mercToday = today.mercury;
  const mercYesterday = yesterday.mercury;
  if (mercToday && mercYesterday && mercToday.retrograde !== mercYesterday.retrograde) {
    events.push({
      kind: "transit",
      body: "mercury",
      eventType: "station",
      targetSign: signOf(mercToday.longitude),
      retrograde: mercToday.retrograde,
      date,
    });
  }

  return events;
}

/**
 * Deterministic display copy for one transit event, built from JPL's sign
 * themes. Kept soft and invitational — a season/quality framing, never a
 * prediction or verdict — so it can drop straight into the nudge queue. Same
 * input always produces the same string (tests pin this).
 */
export function nudgeText(event: TransitEvent): string {
  const theme = event.targetSign ? SIGN_THEMES[event.targetSign] ?? "" : "";
  const body = titleBody(event.body);

  switch (event.eventType) {
    case "ingress":
      return `${body} enters ${event.targetSign} — a season of ${theme}.`;
    case "conjunction": {
      const point = event.natalBody === "moon" ? "Moon" : "Sun";
      return `${body} joins your natal ${point} — ${theme}.`;
    }
    case "station":
      return `Mercury is ${event.retrograde ? "backward" : "direct"} now — ${theme}.`;
    default:
      return `${body} shifts — ${theme}.`;
  }
}
