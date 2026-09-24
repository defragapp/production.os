import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Our Philosophy — Sovereign OS",
  description:
    "How Sovereign works and what it is for: a private AI platform for understanding yourself, your people, and the systems you live within — not a diagnosis, not astrology, not psychology.",
};

const STEPS = [
  {
    step: "01",
    title: "Your Baseline is the anchor",
    body: "Everything starts with a single fact: your date, time, and place of birth. From that, your Baseline becomes a computational picture of how you tend to communicate, feel, and decide. It is a frame of reference, not a verdict — and if you don't know your birth time exactly, an approximation still gives a workable frame, plainly labeled as such.",
  },
  {
    step: "02",
    title: "You explore in your own words",
    body: "You talk about what is actually happening — a fight with a partner, a question at work, a feeling you can't name. Every answer stays grounded in your reference. Sovereign never supplies a story you didn't bring, and it will tell you plainly when it cannot determine something rather than paper over it.",
  },
  {
    step: "03",
    title: "A relationship gets both perspectives",
    body: "When someone you trust joins a relationship in Sovereign, each of you is read through your own reference — side by side. You see where the two of you line up, where you clash, and what each of you walks into the room with. Nothing of yours is visible to them except what they are shown; connection stays consensual.",
  },
  {
    step: "04",
    title: "The systems you live within",
    body: "You don't interact with one person at a time. Families and groups run on unspoken roles, loyalties, and rules. Sovereign helps you map the ones you're standing inside — and see your place in them clearly, without turning the people around you into diagnoses of what's wrong.",
  },
];

const BOUNDARIES = [
  {
    title: "No labels, no diagnoses",
    body: "No condition, no category, no verdict. Sovereign is here for reflection and understanding — not clinical assessment, treatment, or advice of any kind.",
  },
  {
    title: "A reference, not a prediction",
    body: "Your Baseline is a computational reference built from astronomical data — not astrology. Nothing is 'ruled by the stars,' and no outcome is written.",
  },
  {
    title: "A mirror you control",
    body: "Sovereign is not a licensed practice, a substitute for professional care, or an assessment tool. It reflects what you bring, for your own thinking.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className="relative overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />

        <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 md:pt-28">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Sovereign OS · Our Philosophy
          </p>
          <h1 className="font-display text-4xl font-normal leading-[1.08] tracking-tight text-foreground md:text-6xl">
            A tool for <span className="text-iridescent">understanding</span>, not a verdict.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            Most self-understanding is sold as a verdict — here is who you are, here is your future.
            Sovereign works the way clear-eyed conversation works: a grounded starting point, honest
            language, both sides of the story, and the deciding left to you. It reflects what is
            already there; it never pronounces on you.
          </p>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 grid gap-4 md:grid-cols-[160px_1fr] md:items-end">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                How it works
              </p>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Four moves, in order: anchor on your Baseline, explore in your own words, widen to the
                people around you, then widen again to the systems both of you stand inside.
              </p>
            </div>

            <ol className="divide-y divide-border">
              {STEPS.map((s) => (
                <li key={s.step} className="py-8 md:py-10">
                  <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {s.step}
                  </p>
                  <div className="grid gap-3 md:grid-cols-[200px_1fr]">
                    <h2 className="font-display text-2xl font-normal leading-snug text-foreground md:text-3xl">
                      {s.title}
                    </h2>
                    <p className="max-w-prose text-sm leading-6 text-muted-foreground md:text-[15px] md:leading-7">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-white/10 bg-muted/30 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-4xl">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              What it is &mdash; and what it isn&apos;t
            </p>
            <h2 className="mb-12 font-display text-3xl font-normal text-foreground md:text-4xl">
              Honest about what it is.
            </h2>
            <div className="grid gap-10 md:grid-cols-3 md:gap-8">
              {BOUNDARIES.map((b) => (
                <div key={b.title} className="border-t border-foreground/15 pt-6">
                  <h3 className="mb-2 text-base font-semibold text-foreground">{b.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{b.body}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-14 max-w-xl text-center text-sm leading-6 text-muted-foreground">
              If you are in crisis or feel you need professional help, please reach out to a qualified
              professional in your region — Sovereign is not a substitute for that care.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16 md:py-24">
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
      </main>
    </>
  );
}