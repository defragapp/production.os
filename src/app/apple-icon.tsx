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
            width: 180,
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0d0d0d",
          }}
        >
          <svg width="130" height="130" viewBox="0 0 64 64" fill="none">
            <path d="M18.5 26 H45.5 L47.5 31 Q48.5 37 32 40 Q15.5 37 16.5 31 Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
            <path d="M32 42 V52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M32 52 H24 M32 52 H40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M24 12 Q32 19 40 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M23.5 16 Q18 21 15 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M40.5 16 Q46 21 49 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M33 13 Q39 38 44 47 Q34 54 30 45" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="46" cy="8" r="3.4" fill="currentColor" />
            <circle cx="33" cy="55" r="2.4" fill="currentColor" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
