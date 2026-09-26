/**
 * Sovereign OS brand mark — the ONE canonical glyph, defined once as data so
 * every surface draws the identical silhouette. This is the Ace of Cups
 * ("my cup overflows"): descending dove, cross-and-wafer, ornate chalice with
 * the S detail, stem + knop, flared foot, the four overflow streams, and the
 * scattered droplets.
 *
 * It is deliberately the *same* artwork everywhere — nav, web-tab favicon, iOS
 * home-screen icon, and the social card. Do not fork a simplified variant; if a
 * surface needs a different size, scale this glyph, never redraw it.
 *
 * The React component lives in `components/ui/brand-mark.tsx`. The satori
 * `ImageResponse` surfaces (apple-icon, opengraph-image) and the static
 * `app/icon.svg` render from this array too — satori can't import the component,
 * but it can import this plain data, so the geometry stays single-sourced.
 */

export interface BrandMarkShape {
  tag: "path" | "circle";
  /** Path data (tag === "path"). */
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  /** Filled vs. stroked. */
  mode: "fill" | "stroke";
  /** Stroke width (mode === "stroke"). */
  width?: number;
}

export const BRAND_MARK_SHAPES: BrandMarkShape[] = [
  // Descending dove silhouette (solid fill).
  {
    tag: "path",
    mode: "fill",
    d: "M32 14 C30.5 11.5 25 7 18 3 C22 6 27.5 8 31 7 C31.5 4 32 1 32 1 C32 1 32.5 4 33 7 C36.5 8 42 6 46 3 C39 7 33.5 11.5 32 14 Z",
  },
  // Cross & wafer / disk.
  { tag: "circle", mode: "stroke", width: 2.4, cx: 32, cy: 18, r: 4.2 },
  { tag: "path", mode: "stroke", width: 1.8, d: "M32 15.5 V20.5 M29.5 18 H34.5" },
  // Chalice bowl + rim.
  {
    tag: "path",
    mode: "stroke",
    width: 3,
    d: "M24 22 C23 29 25 35 30 39 Q32 40 34 39 C39 35 41 29 40 22",
  },
  { tag: "path", mode: "stroke", width: 3, d: "M24 22 Q32 23.8 40 22" },
  // S detail inside the bowl.
  {
    tag: "path",
    mode: "stroke",
    width: 2.4,
    d: "M34 26.2 C34 25.3 33.1 24.8 32 24.8 C30.8 24.8 29.8 25.5 29.8 26.8 C29.8 28.8 34.2 29.2 34.2 31.2 C34.2 33 33 33.8 32 33.8 C30.5 33.8 29.8 32.7 29.8 31.5",
  },
  // Stem & knop column.
  { tag: "path", mode: "stroke", width: 2.5, d: "M30 39 V48 M34 39 V48" },
  { tag: "circle", mode: "fill", cx: 32, cy: 48, r: 2.5 },
  // Flared foot / base.
  {
    tag: "path",
    mode: "stroke",
    width: 3,
    d: "M30 48 C28 50 25.5 52.5 24 54 Q32 55.5 40 54 C38.5 52.5 36 50 34 48",
  },
  { tag: "path", mode: "stroke", width: 2.5, d: "M24 54 Q32 55.5 40 54" },
  // Overflow streams (single loop per side).
  {
    tag: "path",
    mode: "stroke",
    width: 2.6,
    d: "M26.5 23 C26.5 15 21 15 21 21 V62",
  },
  {
    tag: "path",
    mode: "stroke",
    width: 2.6,
    d: "M37.5 23 C37.5 15 43 15 43 21 V62",
  },
  // Droplets.
  { tag: "path", mode: "fill", d: "M 15 30 Q 13.5 32.5 15 33.5 Q 16.5 32.5 15 30" },
  { tag: "path", mode: "fill", d: "M 15 46 Q 13.5 48.5 15 49.5 Q 16.5 48.5 15 46" },
  { tag: "path", mode: "fill", d: "M 49 30 Q 47.5 32.5 49 33.5 Q 50.5 32.5 49 30" },
  { tag: "path", mode: "fill", d: "M 49 46 Q 47.5 48.5 49 49.5 Q 50.5 48.5 49 46" },
];
