import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageCrown } from "@/components/page-crown";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Our Philosophy",
  description:
    "Sovereign is a private AI mirror for understanding yourself, your people, and the systems you live within — not a diagnosis, not astrology, not a verdict.",
};

// The three things a first-time visitor actually needs to trust: what it is,
// what it isn't, and what stays theirs.
const PRINCIPLES = [
  {
    title: "A mirror, not an oracle",
    body: "It reflects what you bring and separates what happened from what it started to mean. It never tells you who you are.",
  },
  {
    title: "Grounded, not fortune-telling",
    body: "Your Baseline is computed from NASA/JPL planetary data — a plain-language reference, not stars ruling your future.",
  },
  {
    title: "Yours, privately",
    body: "Your birth data is used only to build your Baseline, never sold or shared. The deciding always stays with you.",
  },
];

export default function AboutPage() {
  return (
    <>
    <PageShell center={false} wide="wide">
        {/* Hero wash lives inside the shell now — absolute against the shell's
            main, fading toward the viewport top edge like the app glow. */}
        <div className="hero-light" aria-hidden="true" />
        <div className="relative">
            <PageCrown
              align="left"
              eyebrow="Our Philosophy"
              title={<>A tool for <span className="italic">understanding</span>, not a verdict.</>}
              deck="Most self-understanding is sold as a verdict. Sovereign works like a clear-eyed conversation: a grounded starting point, honest language, and the deciding left to you."
            />

            <p className="mt-8 text-balance border-l border-foreground/25 pl-5 font-display text-xl italic leading-relaxed tracking-tight text-foreground/90 md:text-2xl md:leading-[1.5]">
              A sovereign human isn&apos;t someone who needs no one — it&apos;s someone who can stay
              connected to themselves while understanding the people and systems around them.
            </p>

            <div className="mt-14 grid gap-6 sm:grid-cols-3">
              {PRINCIPLES.map((p) => (
                <div key={p.title}>
                  <h2 className="mb-1.5 font-display text-base font-normal tracking-tight text-foreground">{p.title}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{p.body}</p>
                </div>
              ))}
            </div>

            {/* Why now — the moment that made Sovereign worth building. Factual
                editorial, not a founder bio: the operator’s personal background
                belongs on a real /team page once one is authored; this section
                answers the investor question “why this, why now” without
                inventing a résumé. */}
            <div className="mt-14 max-w-2xl">
              <Eyebrow className="mb-3">Why now</Eyebrow>
              <h2 className="mb-4 font-display text-2xl font-normal leading-tight tracking-tight text-foreground md:text-3xl">
                Assistant software got <span className="italic">amnesic</span>.
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Large language models made it cheap to build a chat interface for everything, and
                the market answered by shipping assistants that reset the moment you close the tab.
                They remember your questions but not your life. The value you give them — context,
                candor, the actual shape of your relationships — leaks out as training data or ad
                targeting, and comes back as a slightly better autocorrect to a stranger&apos;s phone.
              </p>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The other option — a static personality quiz, a horoscope app — is honest about
                being entertainment but cannot meet you where your life actually is. Neither is what
                most people want when they&apos;re trying to make sense of a hard week. There is a
                middle lane no one has built seriously yet: an assistant that <em className="text-foreground/90 not-italic">remembers only
                you</em>, grounded in a stable reference frame, and doesn&apos;t pretend to be an oracle.
                That is what Sovereign is for.
              </p>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-5">
              <Link href="/onboard?mode=signup" className="btn-focal px-7 py-3 text-sm font-semibold">
                Start free
              </Link>
              <Link
                href="/faq"
                className="tap-line text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground"
              >
                Read the FAQ →
              </Link>
            </div>
        </div>
    </PageShell>
    <SiteFooter />
    </>
  );
}
