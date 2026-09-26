import { ImageResponse } from "next/og";

export const alt = "Sovereign OS — Understand the patterns in your life";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Illustrated emblem geometry (mirror of src/components/ui/brand-mark.tsx
// EMBLEM_STROKES / EMBLEM_FILLS) — satori can't import the React component, so
// the social card carries the same paths inline to stay in sync.
const STROKES = [
  "M14 22 Q32 27 50 22",
  "M14 22 C16 34 23 41 32 41 C41 41 48 34 50 22",
  "M32 41 V51",
  "M23 55 Q32 51 41 55",
  "M23 55 H41",
  "M14 22 C9 20 8 15 11 12",
  "M50 22 C55 20 56 15 53 12",
];
const FILLS = ["M32 6c2.7 3.7 2.7 7.4 0 10-2.7-2.6-2.7-6.3 0-10Z"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d0d0d",
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(38,38,44,0.9), rgba(13,13,13,1))",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 64 64" fill="none">
          {STROKES.map((d) => (
            <path
              key={d}
              d={d}
              stroke="#fafafa"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <circle cx="32" cy="46" r="2.2" fill="#fafafa" />
          {FILLS.map((d) => (
            <path key={d} d={d} fill="#fafafa" />
          ))}
        </svg>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 96,
            letterSpacing: "0.3em",
            color: "#fafafa",
            fontWeight: 700,
          }}
        >
          SOVEREIGN.OS
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 34,
            color: "#a1a1aa",
          }}
        >
          Your personal intelligence layer
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            padding: "14px 36px",
            borderRadius: 10,
            border: "1px solid #3f3f46",
            fontSize: 26,
            color: "#fafafa",
          }}
        >
          Set your baseline → Talk to your AI
        </div>
      </div>
    ),
    size,
  );
}
