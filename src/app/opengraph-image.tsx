import { ImageResponse } from "next/og";

export const alt = "Sovereign OS — Understand the patterns in your life";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        <div
          style={{
            display: "flex",
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
