import { ImageResponse } from "next/og";
import { EMBLEM_DATA_URI } from "@/lib/brand-emblem-data";

/**
 * The link-preview card for shared invite URLs. Deliberately generic: the
 * token in the URL is a private capability, so nothing about the inviter or
 * invitee may leak into an image that CDN-crawling bots can fetch.
 */
export const alt = "You're invited to connect on Sovereign OS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function InviteOpengraphImage() {
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
          backgroundColor: "#0c0b09",
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(38,38,44,0.9), rgba(12,11,9,1))",
          color: "#faf5ec",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: "0.28em", color: "#8a857b" }}>
          SOVEREIGN OS
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 130,
            height: 130,
            marginTop: 36,
            borderRadius: 65,
            border: "1px solid rgba(250,245,236,0.14)",
            backgroundColor: "rgba(250,245,236,0.04)",
          }}
        >
          <img src={EMBLEM_DATA_URI} alt="" width={72} height={102} style={{ width: 72, height: 102, objectFit: "contain" }} />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 68,
            letterSpacing: "-0.01em",
            color: "#faf5ec",
            fontWeight: 700,
          }}
        >
          You&apos;re invited to connect
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 30,
            color: "#c2bcb0",
          }}
        >
          See what happens between you — with AI built for understanding, not verdicts.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 46,
            padding: "14px 36px",
            borderRadius: 999,
            border: "1px solid rgba(250,245,236,0.18)",
            fontSize: 24,
            color: "#faf5ec",
          }}
        >
          sovereign.defrag.app
        </div>
      </div>
    ),
    size,
  );
}
