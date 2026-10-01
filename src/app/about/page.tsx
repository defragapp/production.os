import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PageTexture } from "@/components/page-texture";

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

const INFRASTRUCTURE = [
  {
    label: "Compute",
    body: "Cloudflare Workers — V8 isolates, ~0 cold-start, no container orchestration.",
  },
  {
    label: "Data",
    body: "D1 (SQLite at the edge), KV for sessions and rate limits, Vectorize for semantic recall.",
  },
  {
    label: "AI layer",
    body: "Workers AI for embeddings and safety screening; primary inference via AI Gateway with secondary fallback.",
  },
  {
    label: "Observability",
    body: "Tail Worker streams errors to the support inbox; daily cron sweeps expired tokens and stale rows.",
  },
  {
    label: "Delivery",
    body: "Next.js on OpenNext, single `wrangler deploy`, static assets on the Workers asset router.",
  },
  {
    label: "Transparency",
    body: "Full export and cascade-delete from the Account page — what the server has, you can take or destroy.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageTexture />
      <Nav />
      <main
        id="main"
        className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden bg-background font-sans text-foreground selection:bg-muted"
      >
        <section className="relative w-full px-6 py-14 md:py-20">
          <div className="hero-light" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-3xl">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
              Our Philosophy
            </p>
            <h1 className="font-display text-4xl font-normal leading-[1.08] tracking-tight text-foreground md:text-[3.25rem]">
              A tool for <span className="italic">understanding</span>, not a verdict.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              Most self-understanding is sold as a verdict. Sovereign works like a clear-eyed
              conversation: a grounded starting point, honest language, and the deciding left to you.
            </p>

            <p className="mt-8 text-balance border-l border-foreground/25 pl-5 font-display text-xl italic leading-relaxed tracking-tight text-foreground/90 md:text-2xl md:leading-[1.5]">
              A sovereign human isn&apos;t someone who needs no one — it&apos;s someone who can stay
              connected to themselves while understanding the people and systems around them.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-3">
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
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
                Why now
              </p>
              <h2 className="mb-4 font-display text-2xl font-normal leading-tight tracking-tight text-foreground md:text-3xl">
                Assistant software got <span className="italic">amnesic</span>.
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Large language models made it cheap to build a chat interface for everything, and
                the market answered by shipping assistants that reset the moment you close the tab.
                They remember your questions but not your life. The value you give them — context,
                candour, the actual shape of your relationships — leaks out as training data or ad
                targeting, and comes back as a slightly better autocorrect to a stranger’s phone.
              </p>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The other option — a static personality quiz, a horoscope app — is honest about
                being entertainment but cannot meet you where your life actually is. Neither is what
                most people want when they’re trying to make sense of a hard week. There is a
                middle lane no one has built seriously yet: an assistant that <em className="text-foreground/90 not-italic">remembers only
                you</em>, grounded in a stable reference frame, and doesn’t pretend to be an oracle.
                That is what Sovereign is for.
              </p>
            </div>

            {/* Infrastructure trust signal — real, verifiable, and load-bearing for
                both the privacy claim and the “complete AI platform” narrative. */}
            <div className="mt-14 max-w-2xl">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
                How it’s built
              </p>
              <h2 className="mb-4 font-display text-2xl font-normal leading-tight tracking-tight text-foreground md:text-3xl">
                A single <span className="italic">regionless</span> runtime, on Cloudflare.
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Sovereign runs entirely on Cloudflare Workers: no servers to patch, no container
                orchestrator, no cold region to fall over. Data lives in D1 (SQLite at the edge),
                KV, and Vectorize; model inference is routed through AI Gateway with Workers AI
                handling safety screening natively. Requests are served from the 300-plus edge
                locations closest to you — which means a message written in a taxi in Osaka and one
                written in a park in Lisbon take the same code path, and neither crosses the ocean
                to be processed. There is no US-east-coast origin we could be compelled to hand
                over, and no legacy PHP box under somebody’s desk.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                {INFRASTRUCTURE.map((row) => (
                  <li key={row.label} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                    <span>
                      <span className="text-foreground">{row.label}.</span> {row.body}
                    </span>
                  </li>
                ))}
              </ul>
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
        </section>
      </main>
    </>
  );
}
