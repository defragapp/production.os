import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";

const DISCIPLINES = ["Astrology", "Human Design", "Gene Keys", "Numerology"];

const STEPS = [
  {
    step: "01",
    title: "Set your baseline",
    body: "Enter the date, time, and place of your birth. Your chart is computed from NASA/JPL Horizons planetary data at that exact moment.",
  },
  {
    step: "02",
    title: "See the pattern",
    body: "Your emotional expression is synthesized across astrology, Human Design, gene keys, and numerology into one coherent map of how you tend to operate.",
  },
  {
    step: "03",
    title: "Interrupt it",
    body: "Name the recurring loop and get a specific, actionable interruption — not another diagnosis, but a move you can make today.",
  },
];

const FEATURES = [
  {
    title: "Baseline",
    body: "Computed from NASA/JPL planetary data at your exact birth time.",
  },
  {
    title: "Pattern Interruption",
    body: "Name the recurring pattern. Get a specific, actionable interruption.",
  },
  {
    title: "Private",
    body: "Your birth data is used only to compute your baseline. Never shared.",
  },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center px-6 pb-16 pt-24 text-center">
          <div className="mx-auto w-full max-w-3xl">
            <span className="mb-6 inline-block rounded-full border bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Sovereign OS
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
              Read your baseline.
              <br />
              See the loop.
              <br />
              <span className="text-muted-foreground">Interrupt it.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Sovereign OS computes your natal baseline from NASA/JPL planetary data — astrology,
              Human Design, Gene Keys, and numerology — to synthesize your emotional expression
              and surface the patterns that quietly run you.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/onboard?mode=signup">
                <Button className="w-full sm:w-auto" size="lg">
                  Get Started
                </Button>
              </Link>
              <Link href="/onboard?mode=login">
                <Button className="w-full sm:w-auto" variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              Free to start. 5 AI interruptions per day on the free tier.
            </p>
          </div>
        </section>

        {/* ── Discipline strip ─────────────────────────────────── */}
        <section className="border-y bg-secondary/50 px-6 py-10">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              One baseline, four lenses
            </p>
            {DISCIPLINES.map((d) => (
              <span key={d} className="text-sm font-semibold text-foreground/70">
                {d}
              </span>
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
              How it works
            </p>
            <h2 className="mb-10 text-3xl font-bold tracking-tight sm:text-4xl">
              From baseline to break
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ step, title, body }) => (
                <Card key={step} className="relative border-0 bg-secondary/30 shadow-none">
                  <CardHeader>
                    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {step}
                    </span>
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">{body}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="border-t px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Why it matters
            </p>
            <h2 className="mb-10 text-3xl font-bold tracking-tight sm:text-4xl">
              Undiagnosed cycles keep you stuck
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {FEATURES.map(({ title, body }) => (
                <Card key={title}>
                  <CardHeader>
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{body}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Privacy ──────────────────────────────────────────── */}
        <section className="border-t px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your birth data stays yours
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Your baseline is computed from NASA/JPL planetary data and used only to power your
              sessions. It is never sold and never shared with third parties.
            </p>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="border-t bg-secondary/40 px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stop looping. Start acting.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Get your baseline in minutes and your first interruption in the same session.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/onboard?mode=signup">
                <Button className="w-full sm:w-auto" size="lg">
                  Create Your Baseline
                </Button>
              </Link>
              <Link href="/onboard?mode=login">
                <Button className="w-full sm:w-auto" variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer className="border-t px-6 py-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
            <p>
              By signing up, you agree to our{" "}
              <a href="/terms" className="underline hover:text-foreground">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </a>
              .
            </p>
            <a href="mailto:info@sovereign.os" className="hover:text-foreground">
              info@sovereign.os
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}