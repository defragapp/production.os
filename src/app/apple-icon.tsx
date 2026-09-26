import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon: the same stripped overflowing-cup mark as the tab
// favicon (src/app/icon.svg), so the installed app and the browser tab agree.
// Geometry mirrors src/components/ui/brand-mark.tsx STRIPPED_ICON_PATHS.
const PATHS = [
  "M32 5c3.5 4.7 3.5 9.4 0 12.7-3.5-3.3-3.5-8 0-12.7Z",
  "M12 21h40c-1 12-9 20-20 20s-19-8-20-20Z",
  "M29.5 41h5v9h-5z",
  "M20 55c4-4 7-5 12-5s8 1 12 5Z",
];

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
        <svg width="112" height="112" viewBox="0 0 64 64" fill="none">
          {PATHS.map((d) => (
            <path key={d} d={d} fill="#f4f4f5" />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
