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
    desc: "Understand the patterns you repeat — and why your own qualities turn on you under pressure.",
    example: "Why do I freeze the moment I get put on the spot?",
  },
  {
    title: "A relationship",
    desc: "See what's actually happening between two people, beyond each person's version of it.",
    example: "Why do we have the same fight every time money comes up?",
  },
  {
    title: "Your family",
    desc: "See the roles, loyalties, and silent rules everyone is playing out — even when no one named them.",
    example: "Why does my family go quiet the instant someone gets angry?",
  },
];

const DEMO_ANSWER = [
  "You've named the pattern precisely: closeness gets real, and you pull back before it can be depended on. That timing repeats because the retreat is doing a job — it keeps you safe from being relied on.",
  "The cost is real. Pulling away tells the other person, gently and over time, that they aren't allowed in far enough to matter. They stop reaching; you read that as proof you were right to pull back. The distance starts to look necessary.",
  "Your Baseline carries a Moon in Cancer — deep tenderness, and a reflex to guard what it loves. That's a tendency you carry, not a verdict on you. It means your protection comes from the same place your warmth does.",
  "The honest question to sit with: what would change if you let one person see the full weight of what you feel?",
];

/**
 * The product, drawn in CSS: a faithful sketch of the real chat experience —
 * the same bubbles, Baseline chips, thread strip, and usage meter the app
 * renders, with an answer in the authentic voice Sovereign actually produces:
 * observe the pattern, name its cost, read the Baseline as a tendency, then
 * leave one honest question open.
 */
function ProductDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-card/60 p-4 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo showWordmark={false} href="#" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Sovereign OS
            </span>
          </div>
          <span className="rounded-md border border-foreground/25 bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
            Free · 5 a day
          </span>
        </div>

        <div className="mb-4 flex items-end gap-2">
          <span className="mb-[1px] flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New thread
          </span>
          <span className="shrink-0 whitespace-nowrap border-b-2 border-foreground px-2 py-1.5 text-xs text-foreground">
            Pulling away when it gets real
          </span>
        </div>

        <div className="mb-3 flex justify-end">
          <div className="max-w-[88%] rounded-2xl bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">
            Why do I keep pulling away once a relationship gets serious?
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[96%] rounded-2xl bg-muted px-4 py-3 text-left sm:max-w-[92%]">
            <div className="space-y-3 text-[15px] leading-relaxed text-foreground">
              {DEMO_ANSWER.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Your Baseline
              </p>
              <div className="flex flex-wrap gap-2">
                {BASELINE_CHIPS.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{c}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-1 mt-4 flex items-center justify-end gap-2.5">
          <span className="text-xs text-muted-foreground/70">1 of 5 free messages used today</span>
          <div className="h-[3px] w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/50" style={{ width: "20%" }} />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="flex-1 text-[12px] text-muted-foreground">Type your message...</span>
          <span className="flex h-7 items-center justify-center rounded-md bg-foreground px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-background">
            Send
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
              <p className="mt-3 text-muted-foreground">The questions people actually bring look like this.</p>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              {EXPLORE.map((item, i) => (
                <Reveal key={item.title} delay={i * 60}>
                  <div className="flex h-full flex-col border-t border-foreground/20 pt-5">
                    <h3 className="mb-2 font-display text-2xl font-normal text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                    <p className="mt-4 rounded-lg border border-border bg-background/40 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
                      “{item.example}”
                    </p>
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
              Free to start. Keep going when it gets deep.
            </h2>
            <p className="mb-12 text-center text-muted-foreground">
              Every plan includes your full Baseline. Free gives you a real answer — Sovereign+
              keeps the whole conversation working for you.
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
                  <li>Every conversation stays with you — full history and threads</li>
                  <li>The patterns and meanings you&apos;ve worked out stay part of the picture</li>
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