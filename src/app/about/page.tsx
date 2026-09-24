import type { Metadata } from "next";
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
    body: "Everything starts with a single fact: your date, time, and place of birth. From that, your Baseline becomes a computational picture of how you tend to communicate, feel, and decide — a frame of reference, not a verdict.",
  },
  {
    step: "02",
    title: "You explore in your own words",
    body: "You talk about what is actually happening — a fight with a partner, a question at work, a feeling you can't name. The AI keeps every answer grounded in your reference and never invents a story you didn't bring.",
  },
  {
    step: "03",
    title: "A relationship gets both perspectives",
    body: "When someone you trust joins a relationship in Sovereign, each of you is read through your own reference — side by side. You see where the two of you line up, where you clash, and what each of you walks into the room with.",
  },
  {
    step: "04",
    title: "The systems you live within",
    body: "You don't interact with one person at a time. Families and groups run on unspoken roles, loyalties, and rules. Sovereign helps you map the ones you're standing inside — and see your place in them clearly.",
  },
];

const BOUNDARIES = [
  {
    title: "We do not diagnose",
    body: "No label for what you are going through, no condition, no verdict. Sovereign is here for reflection and understanding — not clinical assessment, treatment, or advice.",
  },
  {
    title: "No astrology",
    body: "Your Baseline is a computational reference built from astronomical data — not a horoscope. There are no planets ruling your week and nothing is 'written in the stars'.",
  },
  {
    title: "No psychology",
    body: "Sovereign is not a licensed practice, a therapist, or an assessment tool. It is a mirror you control, for your own thinking.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className="relative overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
        <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />

        <section className="mx-auto max-w-3xl px-6 pb-16 pt-16 md:pt-24">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Sovereign OS · Our Philosophy
          </p>
          <h1 className="font-display text-4xl font-normal leading-[1.1] tracking-tight text-foreground md:text-5xl">
            A tool for <span className="text-iridescent">understanding</span>, not a label for what&apos;s wrong.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Sovereign helps you understand yourself, your people, and the systems you live within.
            It works the way clear-eyed conversation works: a grounded starting point, honest
            language, both sides of the story — and you keep the deciding.
          </p>
        </section>

        <section className="border-t border-white/10 px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <p className="mb-8 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              How it works
            </p>
            <div className="space-y-5">
              {STEPS.map((s) => (
                <article key={s.step} className="glass-panel p-6 md:p-8">
                  <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {s.step}
                  </p>
                  <h2 className="mb-2 font-display text-2xl font-normal text-foreground">
                    {s.title}
                  </h2>
                  <p className="text-[15px] leading-7 text-muted-foreground">{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-muted/30 px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              What it isn&apos;t
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-normal text-foreground md:text-4xl">
              Honest about its limits.
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {BOUNDARIES.map((b) => (
                <article key={b.title} className="rounded-xl border border-border bg-background/40 p-6">
                  <h3 className="mb-2 text-base font-semibold text-foreground">{b.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{b.body}</p>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-6 text-muted-foreground">
              If you are in crisis or feel you need professional help, please reach out to a qualified
              professional in your region — Sovereign is not a substitute for that care.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <p className="mb-8 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Where it lives
            </p>
            <div className="glass-panel p-6 md:p-8">
              <h2 className="mb-2 font-display text-2xl font-normal text-foreground">
                Private by design.
              </h2>
              <p className="text-[15px] leading-7 text-muted-foreground">
                Your conversations belong to you. Nothing is shared, sold, or used to train someone
                else&apos;s view of you. Relationships only ever appear when a person on the other side
                accepts your invitation, and the data stays scoped to each of you.{" "}
                <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                  How we protect that
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}