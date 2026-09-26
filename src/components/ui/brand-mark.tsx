/**
 * Sovereign OS brand mark — the single source of truth for the "overflowing
 * cup" glyph (Ace of Cups: "my cup overflows"). Every surface that shows the
 * mark draws from the geometry defined here so the nav, favicon, iOS home
 * icon, and social card stop drifting apart.
 *
 * Two responsive variants, one silhouette:
 *  - <StrippedIcon />  — a filled goblet + one overflow drop, legible at
 *                        16–32px (nav, favicon, tab bar, chat empty state).
 *  - <Emblem />        — the illustrated line mark for large brand moments
 *                        (landing hero, onboarding, social / OG card, footer),
 *                        shown at >=40px where the overflow streams read.
 *
 * Both render with `currentColor`, so a parent sets the ink. The raw path data
 * is exported too for the static `icon.svg` and the satori `ImageResponse`
 * surfaces, which cannot import a React component and must stay in sync with it.
 */

/** Filled goblet + overflow drop, optimized for tiny sizes. viewBox 0 0 64 64. */
export const STRIPPED_ICON_PATHS = [
  // Overflowing drop above the rim.
  "M32 5c3.5 4.7 3.5 9.4 0 12.7-3.5-3.3-3.5-8 0-12.7Z",
  // Chalice bowl.
  "M12 21h40c-1 12-9 20-20 20s-19-8-20-20Z",
  // Stem.
  "M29.5 41h5v9h-5z",
  // Flared foot.
  "M20 55c4-4 7-5 12-5s8 1 12 5Z",
];

/** Stroke geometry for the illustrated emblem. viewBox 0 0 64 64. */
export const EMBLEM_STROKES = [
  // Rim of the cup.
  "M14 22 Q32 27 50 22",
  // Bowl.
  "M14 22 C16 34 23 41 32 41 C41 41 48 34 50 22",
  // Stem.
  "M32 41 V51",
  // Foot flare + base line.
  "M23 55 Q32 51 41 55",
  "M23 55 H41",
  // Liquid overflowing over the left lip.
  "M14 22 C9 20 8 15 11 12",
  // Liquid overflowing over the right lip.
  "M50 22 C55 20 56 15 53 12",
];

/** Filled elements of the emblem (knop on the stem + overflow drop). */
export const EMBLEM_FILLS = [
  "M32 6c2.7 3.7 2.7 7.4 0 10-2.7-2.6-2.7-6.3 0-10Z",
];

export function StrippedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {STRIPPED_ICON_PATHS.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {EMBLEM_STROKES.map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* Knop on the stem. */}
      <circle cx="32" cy="46" r="2.2" fill="currentColor" />
      {EMBLEM_FILLS.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
