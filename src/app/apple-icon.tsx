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
            <path d="M20 22 H44 L46 28 Q46 40 32 43 Q18 40 18 28 Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
            <path d="M32 43 V52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M32 52 H25 M32 52 H39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M25 15 Q28 26 32 24 Q36 26 39 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M24 20 Q15 26 12 33 M12 33 Q9 35 7 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M40 20 Q49 26 52 33 M52 33 Q55 35 57 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="6" cy="29" r="3.4" fill="currentColor" />
            <circle cx="25" cy="10" r="3.2" fill="currentColor" />
            <circle cx="39" cy="10" r="3.2" fill="currentColor" />
            <circle cx="58" cy="29" r="3.4" fill="currentColor" />
            <path d="M32 10 Q32 15 32 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
