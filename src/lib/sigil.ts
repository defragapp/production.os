/**
 * Intent Sigil — a deterministic, shareable crest that lets a person hold an
 * emotional state and show it. Pure module (no React, no browser APIs) so the
 * exact same geometry renders in three places: the interactive component, the
 * public share page, and the OpenGraph card. Keeping one source of truth means
 * the Sigil a user sees in-app is byte-identical to the one their friend sees
 * in iMessage.
 *
 * The crest is derived from the signer's Baseline (a one-way seed) plus the
 * chosen Intent (which fixes the shape family). No birth data, no coordinates,
 * nothing sensitive ever leaves the seed — the geometry is the only output.
 */
import { bufToB64url, b64urlToBuf } from "./base64url";

export type SigilIntentId =
  | "grounded"
  | "open"
  | "empathizing"
  | "clear"
  | "at-peace"
  | "curious";

export interface SigilIntent {
  id: SigilIntentId;
  /** Sentence-case label shown in the composer and on the share page. */
  label: string;
  /** Fills the OpenGraph sentence: "{name} is holding {phrase}." */
  phrase: string;
  /** Shape family — the spoke count that gives each intent its silhouette. */
  spokes: number;
  /** Concentric hairline rings behind the figure. */
  rings: number;
}

// Brand voice (BRAND.md): aspirational, quiet, human. No pathology or machine
// vocabulary. These six states are the launch set.
export const SIGIL_INTENTS: readonly SigilIntent[] = [
  { id: "grounded", label: "Grounded", phrase: "a steady, grounded state", spokes: 6, rings: 2 },
  { id: "open", label: "Open", phrase: "an open state", spokes: 8, rings: 3 },
  { id: "empathizing", label: "Empathizing", phrase: "a state of empathy", spokes: 5, rings: 3 },
  { id: "clear", label: "Clear", phrase: "a clear-headed state", spokes: 4, rings: 2 },
  { id: "at-peace", label: "At peace", phrase: "a state of ease", spokes: 12, rings: 3 },
  { id: "curious", label: "Curious", phrase: "a curious, searching state", spokes: 7, rings: 2 },
] as const;

export function getSigilIntent(id: string | undefined): SigilIntent | undefined {
  return SIGIL_INTENTS.find((i) => i.id === id);
}

/** localStorage key for the state you are currently holding. Device-only by
 *  design — an active Sigil is a personal, on-device choice, never a server row
 *  (no schema change), and it never leaves this browser. */
export const ACTIVE_SIGIL_KEY = "sovereign:activeSigil";

export interface ActiveSigil {
  intentId: SigilIntentId;
  seed: number;
  label: string;
}

/** Seed a connection crest from a relationship id — a stable, personal glyph for
 *  a shared thread that reveals nothing about either person's Baseline. */
export function sigilSeedFromId(id: string): number {
  const h = fnv1a(id);
  return h === 0 ? 0x811c9dc5 : h;
}

/** FNV-1a over a stable identity string — one-way, so a shared Sigil never
 *  reveals the Baseline fields it was seeded from. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32) so the same seed always draws the
 *  same crest, on the server, the client, and inside Satori. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fold a parsed Baseline into a stable integer seed. We hash only coarse,
 * already-public-facing sign labels (never degrees, times, or places). An
 * optional `salt` (the account id at mint time) keeps two people with an empty
 * or JPL-degraded Baseline from collapsing onto the same crest, and makes the
 * seed a one-way pre-image of `(salt ‖ coarse labels)` rather than of the
 * handful of sign labels alone.
 */
export function deriveSigilSeed(baseline: unknown, salt = ""): number {
  const b = (baseline ?? {}) as {
    astrology?: Record<string, unknown>;
    humanDesign?: Record<string, unknown>;
    numerology?: Record<string, unknown>;
  };
  const parts: string[] = [
    String(salt),
    String(b.astrology?.sunSign ?? ""),
    String(b.astrology?.moonSign ?? ""),
    String(b.humanDesign?.type ?? ""),
    String(b.humanDesign?.authority ?? ""),
    String(b.numerology?.lifePath ?? ""),
  ];
  const joined = parts.join("|").replace(/\s+/g, "");
  // A person with no Baseline yet still gets a stable, distinct crest from the
  // salted seed rather than a degenerate zero.
  const h = fnv1a(joined);
  return h === 0 ? 0x9e3779b9 : h;
}

export interface SigilGeometry {
  intent: SigilIntent;
  seed: number;
  rotation: number;
  outerR: number;
  petalR: number;
  innerR: number;
  /** Per-spoke length factors (0.82–1.0) — the "hand-drawn" variance. */
  spokes: number[];
  /** Star-polygon step that connects alternating spoke tips. */
  starStep: number;
}

export function sigilGeometry(seed: number, intentId: string): SigilGeometry {
  const intent = getSigilIntent(intentId) ?? SIGIL_INTENTS[0];
  const rand = mulberry32((seed ^ fnv1a(intent.id)) >>> 0);
  const n = intent.spokes;
  const spokes: number[] = [];
  for (let i = 0; i < n; i++) spokes.push(0.82 + rand() * 0.18);
  const starStep = n >= 5 ? 2 : 1;
  return {
    intent,
    seed,
    rotation: Math.floor(rand() * 360),
    outerR: 46,
    petalR: 24 + Math.floor(rand() * 10),
    innerR: 9 + Math.floor(rand() * 7),
    spokes,
    starStep,
  };
}

function fmt(n: number): string {
  // Two decimals keeps the markup compact without visible precision loss.
  return (Math.round(n * 100) / 100).toString();
}

/**
 * The single renderer: a standalone, self-contained SVG string. Both the React
 * component and the OpenGraph <img> embed this exact output, so the crest never
 * drifts between surfaces. On the DOM the stroke stays `currentColor` so the host
 * sets colour (cream hairlines on the #0d0d0d ground — zero visual drift from the
 * system). The Satori/OG path must pass an explicit light `color`, because a
 * `currentColor` inside an SVG loaded through a `data:image/svg+xml` <img>
 * resolves to black and vanishes against the dark card.
 */
export function renderSigilSvg(g: SigilGeometry, size = 100, color = "currentColor"): string {
  const cx = 50;
  const cy = 50;
  const n = g.spokes.length;
  const rot = (g.rotation * Math.PI) / 180;
  const angleAt = (i: number) => rot + (i * 2 * Math.PI) / n;

  const tip = (i: number): [number, number] => {
    const a = angleAt(i);
    const r = g.petalR * g.spokes[i];
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const rings = Array.from({ length: g.intent.rings }, (_, k) => {
    const r = g.outerR - k * ((g.outerR - g.innerR) / g.intent.rings);
    const o = (0.5 - k * 0.12).toFixed(2);
    return `<circle cx="50" cy="50" r="${fmt(r)}" fill="none" stroke="${color}" stroke-opacity="${o}" stroke-width="1.1"/>`;
  }).join("");

  const spokesMarkup = Array.from({ length: n }, (_, i) => {
    const a = angleAt(i);
    const inner = [cx + g.innerR * Math.cos(a), cy + g.innerR * Math.sin(a)];
    const [tx, ty] = tip(i);
    return `<line x1="${fmt(inner[0])}" y1="${fmt(inner[1])}" x2="${fmt(tx)}" y2="${fmt(ty)}" stroke="${color}" stroke-width="1.1" stroke-linecap="round"/>` +
      `<circle cx="${fmt(tx)}" cy="${fmt(ty)}" r="1.7" fill="${color}"/>`;
  }).join("");

  // Star polygon connecting spoke tips by `starStep` — the crest's signature.
  const starPts: string[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = tip((i * g.starStep) % n);
    starPts.push(`${fmt(x)},${fmt(y)}`);
  }
  const star = `<polygon points="${starPts.join(" ")}" fill="none" stroke="${color}" stroke-opacity="0.65" stroke-width="1" stroke-linejoin="round"/>`;

  const core = `<circle cx="50" cy="50" r="2.6" fill="${color}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-hidden="true" focusable="false" style="display:block">${rings}${star}${spokesMarkup}${core}</svg>`;
}

/** URL-safe data URI of the Sigil, ready to drop into an Satori <img>. The OG
 *  rasteriser cannot resolve `currentColor`, so the crest is drawn in the brand's
 *  foreground tone (#fafafa) explicitly here — invisible-on-black is the bug. */
export function sigilSvgDataUri(g: SigilGeometry, size = 200): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSigilSvg(g, size, "#fafafa"))}`;
}

// ── Stateless shareable token ─────────────────────────────────────────
// The share link carries everything needed to redraw the crest — no DB row, no
// new table (schema is off-limits). `{ v, i, s, n? }` is base64url-encoded JSON.

interface SigilPayload {
  v: 1;
  i: SigilIntentId;
  s: number;
  n?: string;
}

export interface SigilView {
  intent: SigilIntent;
  seed: number;
  /** The sharer's chosen first name, when they opted to include it. */
  name?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeSigilToken(view: SigilView): string {
  const payload: SigilPayload = {
    v: 1,
    i: view.intent.id,
    s: view.seed >>> 0,
  };
  const trimmed = (view.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (trimmed) payload.n = trimmed;
  const bytes = enc.encode(JSON.stringify(payload));
  return bufToB64url(bytes);
}

/** Decode + validate a token. Returns null for anything malformed or forged —
 *  the share page then shows the branded not-found, never a broken crest. */
export function decodeSigilToken(token: string): SigilView | null {
  try {
    const bytes = b64urlToBuf(token);
    const parsed = JSON.parse(dec.decode(bytes)) as Partial<SigilPayload>;
    if (parsed.v !== 1 || typeof parsed.i !== "string" || typeof parsed.s !== "number") return null;
    const intent = getSigilIntent(parsed.i);
    if (!intent) return null;
    const view: SigilView = { intent, seed: parsed.s >>> 0 };
    if (typeof parsed.n === "string") {
      const name = parsed.n.trim().replace(/\s+/g, " ").slice(0, 40);
      if (name) view.name = name;
    }
    return view;
  } catch {
    return null;
  }
}

/** The OpenGraph / share-page sentence. Brand voice: honest, human, sentence case. */
export function sigilSentence(view: SigilView): string {
  const who = view.name ? view.name : "Someone";
  return `${who} is holding ${view.intent.phrase}.`;
}
