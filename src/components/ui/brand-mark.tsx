import { BRAND_MARK_SHAPES } from "@/lib/brand-mark";

/**
 * Sovereign OS brand mark — the canonical overflowing-cup glyph (Ace of Cups).
 * Renders from the single source of truth in `lib/brand-mark.ts` so the nav,
 * favicon, iOS icon, and social card can never drift into separate logos.
 *
 * Uses `currentColor`, so a parent sets the ink.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {BRAND_MARK_SHAPES.map((shape, i) =>
        shape.tag === "circle" ? (
          <circle
            key={i}
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            {...(shape.mode === "fill"
              ? { fill: "currentColor" }
              : { stroke: "currentColor", strokeWidth: shape.width })}
          />
        ) : (
          <path
            key={i}
            d={shape.d}
            {...(shape.mode === "fill"
              ? { fill: "currentColor" }
              : {
                  stroke: "currentColor",
                  strokeWidth: shape.width,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                })}
          />
        ),
      )}
    </svg>
  );
}
