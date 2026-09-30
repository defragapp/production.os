import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { decodeSigilToken, sigilGeometry, sigilSvgDataUri, sigilSentence } from "@/lib/sigil";

export const alt = "Intent Sigil — Sovereign OS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The OpenGraph preview for a shared Sigil — what a recipient sees in iMessage
 * or email before they tap. It renders the same crest the signer saw (via the
 * shared sigil.ts geometry) on the brand's warm-graphite ground.
 *
 * The token is content-addressed: the same `/s/<token>` draws a byte-identical
 * PNG forever. So we mark the response `immutable` — Cloudflare runs Satori once
 * and serves the stored image from the edge thereafter. On the Free tier's 10ms
 * CPU budget this is essential: a launch-spike of social crawlers hitting one
 * shared link would otherwise re-render (and re-bill CPU) on every request and
 * trip error 1102. After the first hit, each view costs 0ms of Worker CPU.
 */
export default async function SigilOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = decodeSigilToken(id);
  if (!view) notFound();

  const sigil = sigilSvgDataUri(sigilGeometry(view.seed, view.intent.id), 300);
  const sentence = sigilSentence(view);

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
            "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(38,38,44,0.9), rgba(13,13,13,1))",
          color: "#fafafa",
        }}
      >
        <img src={sigil} alt="" width={300} height={300} style={{ width: 300, height: 300 }} />
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 52,
            color: "#fafafa",
            fontWeight: 400,
            maxWidth: 900,
            textAlign: "center",
            letterSpacing: "-0.01em",
          }}
        >
          {sentence}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            color: "#a1a1aa",
            letterSpacing: "0.24em",
          }}
        >
          INTENT SIGIL · SOVEREIGN.OS
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // Content-addressed by token → safe (and necessary) to cache immutably at the edge.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
