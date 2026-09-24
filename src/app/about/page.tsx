import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PageTexture } from "@/components/page-texture";

export const metadata: Metadata = {
  title: "Our Philosophy — Sovereign OS",
  description:
    "How Sovereign works and what it is for: a private AI platform for understanding yourself, your people, and the systems you live within — not a diagnosis, not astrology, not psychology.",
};

const STEPS = [
  {
    step: "01",
    title: "Your Baseline is the anchor",
    body: "It starts with one fact: when and where you were born. From that, Sovereign builds your Baseline — a plain-language picture of how you tend to communicate, feel, and decide. It's a reference point, not a verdict. Don't know your exact birth time? An estimate works too, and we'll mark it as one.",
  },
  {
    step: "02",
    title: "You explore in your own words",
    body: "Talk about what's actually happening — a fight with your partner, a snag at work, a feeling you can't name. Sovereign works only with what you bring. When it can't tell something apart, it says so instead of making something up.",
  },
  {
    step: "03",
    title: "A relationship gets both perspectives",
    body: "When someone you trust joins a relationship, each of you is read through your own Baseline — side by side. You see where you line up, where you clash, and what each of you brings into the room. They only see what you choose to show them. Nothing is shared without a yes.",
  },
  {
    step: "04",
    title: "The systems you live within",
    body: "You don't deal with one person at a time. Families and groups run on unspoken roles, loyalties, and rules. Sovereign helps you see the ones you're standing inside — and your place in them — without turning the people around you into problems to diagnose.",
  },
];

const BOUNDARIES = [
  {
    title: "No labels, no diagnoses",
    body: "No condition, no category, no verdict. Sovereign is here for reflection and understanding — not clinical assessment, treatment, or advice of any kind.",
  },
  {
    title: "A reference, not a prediction",
    body: "Your Baseline is built from astronomical data — not astrology. Nothing is 'ruled by the stars,' and no outcome is written.",
  },
  {
    title: "A mirror you control",
    body: "Sovereign is not a licensed practice, a substitute for professional care, or an assessment tool. It reflects what you bring, for your own thinking.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageTexture />
      <Nav />
      <main className="relative overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
        <section className="relative overflow-hidden">
          <div className="hero-light" aria-hidden="true" />
          <div className="mx-auto max-w-3xl px-6 pb-16 pt-16 md:pt-24">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Sovereign OS · Our Philosophy
            </p>
            <h1 className="font-display text-4xl font-normal leading-[1.08] tracking-tight text-foreground md:text-[3.25rem]">
              A tool for <span className="italic">understanding</span>, not a verdict.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              Most self-understanding is sold as a verdict — here is who you are, here is your
              future. Sovereign works the way a clear-eyed conversation works: a grounded starting
              point, honest language, both sides of the story, and the deciding left to you.
            </p>
          </div>
        </section>

        <div className="section-rule" aria-hidden="true" />
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                How it works
              </p>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
                Four moves, in order: anchor on your Baseline, explore in your own words, widen to
                the people around you, then widen again to the systems you both stand inside.
              </p>
            </div>

            <ol className="divide-y divide-border/70">
              {STEPS.map((s) => (
                <li key={s.step} className="py-8">
                  <div className="grid gap-3 md:grid-cols-[280px_1fr] md:gap-8">
                    <div>
                      <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground/60">
                        {s.step}
                      </p>
                      <h2 className="font-display text-2xl font-normal leading-snug text-foreground md:text-[1.65rem] md:leading-[1.25]">
                        {s.title}
                      </h2>
                    </div>
                    <p className="max-w-prose text-sm leading-7 text-muted-foreground md:text-[15px]">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="section-rule" aria-hidden="true" />
        <section className="bg-muted/30 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              What it is &mdash; and what it isn&apos;t
            </p>
            <h2 className="mb-10 font-display text-3xl font-normal tracking-tight text-foreground md:text-4xl">
              Honest about what it is.
            </h2>
            <div className="grid gap-4 md:grid-cols-3 md:gap-5">
              {BOUNDARIES.map((b) => (
                <div key={b.title} className="glass-panel p-6">
                  <h3 className="mb-2 text-base font-semibold text-foreground">{b.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{b.body}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-12 max-w-xl text-center text-sm leading-6 text-muted-foreground">
              If you are in crisis or feel you need professional help, please reach out to a
              qualified professional in your region — Sovereign is not a substitute for that care.
            </p>
          </div>
        </section>

        <div className="section-rule" aria-hidden="true" />
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="border-l border-foreground/25 pl-6 md:pl-8">
              <h2 className="mb-4 font-display text-2xl font-normal text-foreground md:text-3xl">
                Private by design.
              </h2>
              <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground">
                Your conversations belong to you. Nothing is shared, sold, or used to train someone
                else&apos;s view of you. A relationship only ever appears when a person on the other side
                accepts your invitation, and data stays scoped to each of you. You can close your account
                and take your data with you — there is always a door.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <Link href="/privacy" className="text-foreground underline-offset-4 hover:underline">
                  How we protect that
                </Link>
                <Link href="/support" className="text-foreground underline-offset-4 hover:underline">
                  Ask us anything
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden px-6 py-20 text-center md:py-24">
          <div className="hero-light" aria-hidden="true" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="font-display text-2xl font-normal tracking-tight text-foreground md:text-3xl">
              The fastest way to understand this is to try it.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Free to start — about a minute to set up.
            </p>
            <Link
              href="/onboard?mode=signup"
              className="btn-aurora mt-7 inline-block px-8 py-3.5 text-base font-medium"
            >
              Start free
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
