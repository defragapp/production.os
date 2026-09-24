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
            color: "#f4f4f5",
          }}
        >
          <svg width="140" height="140" viewBox="0 0 64 64" fill="none">
            <path d="M19 22 H45 L47 28 Q47 40 32 43.5 Q17 40 17 28 Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
            <path d="M24 21 Q26 15 32 14 Q38 15 40 21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M32 43.5 V51" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M32 51 H24 M32 51 H40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="15" r="3" fill="currentColor" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}