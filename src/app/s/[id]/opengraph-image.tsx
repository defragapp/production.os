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
 * Caching note: the token is content-addressed (same token -> byte-identical
 * PNG forever), so this image is perfectly cacheable. But the OpenNext Cloudflare
 * adapter force-stamps "Cache-Control: public, max-age=0, must-revalidate" on
 * every dynamic response, overriding any header set here, in a route handler, or
 * in middleware. Edge caching -- essential so a crawler fan-out does not re-run
 * Satori past the Free tier's 10ms CPU (error 1102) -- is therefore enforced by a
 * Cloudflare zone Cache Rule for the /s/<id>/opengraph-image path, not in this file.
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
    size,
  );
}
