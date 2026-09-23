import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
        }}
      >
        <div
          style={{
            width: 130,
            height: 130,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0d0d0d",
          }}
        >
          <svg width="100" height="100" viewBox="0 0 64 64" fill="none">
            <path d="M20 16 H44 L46 24 Q32 52 28 40 Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M32 41 V49" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M32 49 H27 M32 49 H37" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M23 12 Q32 18 41 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="46" cy="8" r="3.4" fill="currentColor" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
