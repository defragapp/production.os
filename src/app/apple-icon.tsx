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
            <path d="M32 8 L52 48 H12 Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M32 56 L12 16 H52 Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
