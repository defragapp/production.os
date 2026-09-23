"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";

/**
 * Scroll reveal that can NEVER blank the page:
 * - Base state is fully visible (plain SSR HTML).
 * - Only after JS runs AND IntersectionObserver exists do we enable the
 *   hidden pre-state; elements fade in as they enter the viewport.
 * - Reduced-motion users always see content.
 * Guardrails: strict 240ms tween easeOut, 6px shift (no springs).
 */
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    el.classList.add("js-ok");
    el.classList.add("reveal-from-up");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

const BASELINE_CHIPS = ["Sun · Virgo", "Moon · Cancer", "Life Path · 7"];

const TRUST_NOTES = ["Private by design", "NASA/JPL data", "Free to start"];

const HOW_IT_WORKS = [
  {
    title: "Set your Baseline",
    desc: "Date, time, and place of birth. About a minute — computed from NASA/JPL planetary data.",
  },
  {
    title: "Talk about what's happening",
    desc: "About you, a relationship, or your family. In your own words.",
  },
  {
    title: "Get a grounded read",
    desc: "Sovereign separates what happened from what it might mean — and leaves the deciding to you.",
  },
];

const EXPLORE = [
  {
    title: "Yourself",
    desc: "Why you keep doing the same thing, and how your qualities change under pressure.",
  },
  {
    title: "A relationship",
    desc: "What's actually happening between two people, beyond each person's story about it.",
  },
  {
    title: "Your family",
    desc: "The roles and loops everyone is playing out — even when nobody named them.",
  },
];

/**
 * The product, drawn in CSS: a conversation pulled from the real chat
 * experience. The answer uses the same structure Sovereign actually produces —
 * what you said, a possibility worth examining, what your Baseline suggests,
 * and a question left for you to answer.
 */
function ProductDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-card/60 p-5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo showWordmark={false} href="#" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Your Baseline
            </span>
          </div>
          <span className="rounded-md border border-foreground/25 bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
            Free · 5 a day
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {BASELINE_CHIPS.map((c) => (
            <span
              key={c}
              className="rounded-md border border-border bg-background/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="mb-3 flex justify-end">
          <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed text-primary-foreground">
            My mom always takes over, and then I go quiet. Why do I keep shutting down?
          </div>
        </div>

        <div className="mb-4 flex justify-start">
          <div className="max-w-[96%] rounded-lg rounded-bl-sm bg-muted px-3.5 py-3">
            <div className="space-y-2.5 text-[12px] leading-relaxed text-muted-foreground">
              <p>
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                  Said
                </span>
                This shows up in your family: she takes over, and you go quiet.
              </p>
              <p>
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                  Possibly
                </span>
                Going quiet may be how you stay safe in the conversation — not agreement, but
                withdrawing so there&apos;s nothing to push against.
              </p>
              <p>
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                  From your Baseline
                </span>
                Your moon in Cancer is quietly tender under pressure and can tip into retreat. A
                tendency — not a verdict.
              </p>
              <p>
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                  You decide
                </span>
                What would change if going quiet meant choosing — not conceding?
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="flex-1 text-[12px] text-muted-foreground">
            Ask about yourself, a relationship, or your family…
          </span>
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/10 text-foreground">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export function LandingClient() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
      <Nav />

      <main className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-6 pb-20 pt-16 md:pb-28 md:pt-24">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,250,240,0.06),transparent_62%)]"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1fr]">
            <Reveal>
              <div className="text-left">
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Sovereign OS
                </p>
                <h1 className="font-display text-5xl font-normal leading-[1.08] tracking-tight text-foreground md:text-6xl">
                  A clearer read on yourself, your relationships, and your family.
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                  Sovereign is an AI that talks through what&apos;s happening in your life —
                  personal, private, and grounded in a Baseline built from your birth data.
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/onboard?mode=signup" className="btn-aurora px-7 py-3 text-sm font-medium">
                    Start free
                  </Link>
                  <Link href="/onboard?mode=login" className="btn-glass px-7 py-3 text-sm font-medium text-foreground">
                    Sign in
                  </Link>
                </div>

                <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                  {TRUST_NOTES.map((note, i) => (
                    <li key={note} className="flex items-center gap-5">
                      {i > 0 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={120} className="w-full justify-self-center lg:justify-self-end">
              <ProductDemo />
            </Reveal>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="border-t border-white/10 px-6 py-20 md:py-28">
          <Reveal className="mx-auto max-w-3xl">
            <h2 className="mb-12 text-center font-display text-3xl font-normal text-foreground md:text-4xl">
              Three steps to a clearer view.
            </h2>
            <div className="border-t border-white/10">
              {HOW_IT_WORKS.map((step, i) => (
                <Reveal key={step.title} delay={i * 60}>
                  <div className="grid gap-1 border-b border-white/10 py-6 sm:grid-cols-[64px_180px_1fr] sm:items-baseline sm:gap-6">
                    <p className="font-mono text-xs text-muted-foreground">0{i + 1}</p>
                    <h3 className="text-base font-medium text-foreground">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── What you can explore ─────────────────────────── */}
        <section className="border-t border-white/10 bg-muted/30 px-6 py-20 md:py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-12 text-center">
              <h2 className="font-display text-3xl font-normal text-foreground md:text-4xl">
                Ask about any part of your life.
              </h2>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              {EXPLORE.map((item, i) => (
                <Reveal key={item.title} delay={i * 60}>
                  <div className="h-full border-t border-foreground/20 pt-5">
                    <h3 className="mb-2 font-display text-2xl font-normal text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Plans ────────────────────────────────────────── */}
        <section className="border-t border-white/10 px-6 py-20 md:py-28">
          <Reveal className="mx-auto max-w-4xl">
            <h2 className="mb-3 text-center font-display text-3xl font-normal text-foreground md:text-4xl">
              Free to start. Upgrade when it gets deep.
            </h2>
            <p className="mb-12 text-center text-muted-foreground">
              Every plan includes your full Baseline. Sovereign+ removes the limits.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col rounded-xl border border-border bg-background/40 p-7">
                <p className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Free
                </p>
                <p className="mb-5 font-display text-3xl font-normal">$0</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>Your full Baseline</li>
                  <li>5 AI messages a day</li>
                  <li>Start a conversation right now</li>
                </ul>
                <Link
                  href="/onboard?mode=signup"
                  className="btn-aurora mt-7 px-7 py-3 text-center text-sm font-medium"
                >
                  Start free
                </Link>
              </div>

              <div className="relative flex flex-col rounded-xl border border-foreground/25 bg-card/40 p-7">
                <p className="mb-1 flex items-center justify-between gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Sovereign+
                  <span className="rounded-md border border-foreground/20 bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium normal-case tracking-[0.14em] text-foreground">
                    Save 59%
                  </span>
                </p>
                <p className="mb-5 flex items-baseline gap-2 font-display text-3xl font-normal">
                  $20
                  <span className="font-sans text-sm text-muted-foreground">/mo · or $99/yr</span>
                </p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited AI messages</li>
                  <li>Full chat history &amp; threads</li>
                  <li>Advanced pattern analysis</li>
                </ul>
                <Link
                  href="/upgrade"
                  className="btn-glass mt-7 px-7 py-3 text-center text-sm font-medium text-foreground"
                >
                  Explore Sovereign+
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Final CTA ────────────────────────────────────── */}
        <section className="border-t border-white/10 px-6 py-28 text-center">
          <Reveal className="mx-auto max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-normal text-foreground md:text-5xl">
              Start with one honest question.
            </h2>
            <p className="mb-12 text-lg text-muted-foreground">
              It&apos;s free — you don&apos;t need to have anything figured out.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/onboard?mode=signup" className="btn-aurora w-full px-7 py-3 text-sm font-medium sm:w-auto">
                Start free
              </Link>
              <Link href="/onboard?mode=login" className="btn-glass w-full px-7 py-3 text-sm font-medium text-foreground sm:w-auto">
                Sign in
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-background px-6 py-12 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-medium text-foreground">Sovereign OS</p>
            <p className="mt-0.5">A clearer read on the life you&apos;re actually living.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/faq" className="transition-colors duration-[240ms] hover:text-foreground">
              FAQ
            </Link>
            <Link href="/terms" className="transition-colors duration-[240ms] hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors duration-[240ms] hover:text-foreground">
              Privacy
            </Link>
            <a
              href="mailto:sovereign@defrag.app"
              className="transition-colors duration-[240ms] hover:text-foreground"
            >
              sovereign@defrag.app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}