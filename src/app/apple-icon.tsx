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
            borderRadius: 30,
            backgroundColor: "#f4f4f5",
            color: "#0d0d0d",
            fontSize: 72,
            fontWeight: 700,
          }}
        >
          S
        </div>
      </div>
    ),
    size,
  );
}
