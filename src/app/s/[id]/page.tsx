import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Sigil } from "@/components/sigil";
import { decodeSigilToken, sigilSentence } from "@/lib/sigil";

export const dynamic = "force-dynamic";

function viewOr404(token: string) {
  const view = decodeSigilToken(token);
  if (!view) notFound();
  return view;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const view = decodeSigilToken(id);
  if (!view) return { title: "Sovereign OS", robots: { index: false, follow: false } };
  const sentence = sigilSentence(view);
  return {
    title: sentence,
    description: `${sentence} A state you choose, held as a Sigil. Sovereign OS turns conversation into self-knowledge you own.`,
    // A share link is for the people it's sent to, not for search engines.
    robots: { index: false, follow: false },
    openGraph: {
      title: sentence,
      description: `${sentence} — from Sovereign OS.`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: sentence },
  };
}

export default async function SigilSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = viewOr404(id);
  const sentence = sigilSentence(view);

  return (
    <PageShell center>
      <div className="flex flex-col items-center text-center">
        <div className="mb-7 flex h-40 w-40 items-center justify-center text-foreground">
          {/* Fixed square box → zero layout shift while the crest paints. */}
          <Sigil seed={view.seed} intentId={view.intent.id} size={160} title={`Intent Sigil — ${view.intent.label}`} />
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
          Intent Sigil
        </p>
        <h1 className="mt-3 max-w-md font-display text-2xl font-normal leading-[1.2] tracking-tight text-foreground md:text-3xl">
          {sentence}
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          A state you choose to hold. Sovereign OS turns conversation into
          self-knowledge you own.
        </p>

        <Link
          href="/"
          className="btn-focal mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full px-7 text-sm font-medium"
        >
          Discover Sovereign OS
        </Link>
      </div>
    </PageShell>
  );
}
