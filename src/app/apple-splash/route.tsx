import { ImageResponse } from "next/og";

// The iOS standalone launch screen. Safari requests one apple-touch-startup-image
// per matching device and, if it can't fetch it, flashes a white screen while the
// app boots. Serving a dark (#0d0d0d) canvas with the mark centres the eye on the
// brand and removes that flash. We render one route parametrically by size so the
// ~6 common iPhone/iPad viewports stay cheap to add to (see layout.tsx).
// Note: no `runtime = "edge"` export — under @opennextjs/cloudflare the default
// function already runs on the Workers runtime, which supports ImageResponse,
// and OpenNext refuses to bundle an inline edge route handler.

const LOGO_PATHS = [
  // Descending dove
  { d: "M32 14 C30.5 11.5 25 7 18 3 C22 6 27.5 8 31 7 C31.5 4 32 1 32 1 C32 1 32.5 4 33 7 C36.5 8 42 6 46 3 C39 7 33.5 11.5 32 14 Z", fill: true },
  // Chalice rim
  { d: "M24 22 Q32 23.8 40 22", stroke: true, w: 3 },
  // Chalice bowl
  { d: "M24 22 C23 29 25 35 30 39 Q32 40 34 39 C39 35 41 29 40 22", stroke: true, w: 3 },
  // Bold S
  { d: "M34 26.2 C34 25.3 33.1 24.8 32 24.8 C30.8 24.8 29.8 25.5 29.8 26.8 C29.8 28.5 34.2 29 34.2 31 C34.2 33 33 33.8 32 33.8 C30.5 33.8 29.8 32.7 29.8 31.5", stroke: true, w: 2.4 },
  // Stem
  { d: "M30 39 V48 M34 39 V48", stroke: true, w: 2.5 },
  // Flared base
  { d: "M30 48 C28 50 25.5 52.5 24 54 Q32 55.5 40 54 C38.5 52.5 36 50 34 48", stroke: true, w: 3 },
  { d: "M24 54 Q32 55.5 40 54", stroke: true, w: 2.5 },
  // Flow loops
  { d: "M26.5 23 C26.5 15 21 15 21 21 V62", stroke: true, w: 2.6 },
  { d: "M37.5 23 C37.5 15 43 15 43 21 V62", stroke: true, w: 2.6 },
];

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const width = Math.min(3000, Math.max(320, Number(searchParams.get("w")) || 1290));
  const height = Math.min(3000, Math.max(480, Number(searchParams.get("h")) || 2796));
  const mark = Math.round(Math.min(width, height) * 0.18);

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
        <svg width={mark} height={mark} viewBox="0 0 64 64" fill="none">
          {LOGO_PATHS.map((p, i) =>
            p.fill ? (
              <path key={i} d={p.d} fill="#f4f4f5" />
            ) : (
              <path key={i} d={p.d} stroke="#f4f4f5" strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" />
            )
          )}
          <circle cx="32" cy="18" r="4.2" stroke="#f4f4f5" strokeWidth="2.4" />
          <path d="M32 15.5 V20.5 M29.5 18 H34.5" stroke="#f4f4f5" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="48" r="2.5" fill="#f4f4f5" />
        </svg>
      </div>
    ),
    { width, height },
  );
}
