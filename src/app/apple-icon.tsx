import { ImageResponse } from "next/og";
import { BRAND_MARK_SHAPES } from "@/lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon: the canonical Ace-of-Cups mark, identical to the tab
// favicon and nav logo. Renders from lib/brand-mark.ts so it can't drift.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d0d0d",
          color: "#f4f4f5",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 64 64" fill="none">
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
      </div>
    ),
    size,
  );
}
