"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  from = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  from?: "up" | "left";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    el.classList.add("js-ok");
    el.classList.add(from === "left" ? "reveal-from-left" : "reveal-from-up");
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
  }, [from]);

  return (
    <div
      ref={ref}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// Overline and elevated CTAs share the app's semantic tokens. The single
// primary action per screen uses the liquid-cream aurora; secondary actions
// use frosted glass. Both are sharp-radius, never pills.
const OVERLINE =
  "mb-5 block font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground";

const QUESTIONS = [
  "Why do I keep taking responsibility for everyone?",
  "Why does this relationship keep going in circles?",
  "Why does setting one boundary create so much conflict?",
];

function RotatingQuestions() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % QUESTIONS.length);
        setFade(true);
      }, 300);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block transition-all duration-[300ms] ease-spring ${
        fade ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {QUESTIONS[idx]}
    </span>
  );
}

const BASELINE_CONTEXT = ["Sun · Virgo", "Moon · Cancer", "Rising · Capricorn", "Life Path · 7"];

const TRUST_NOTES = ["Private by design", "NASA/JPL baseline", "Stripe-secured"];

const LENSES = [
  { title: "Your own experience", desc: "What you actually notice and feel." },
  { title: "Psychology", desc: "Possible patterns in attention, behavior, or response." },
  { title: "Relationships", desc: "What happens between you and another person." },
  { title: "Family and groups", desc: "Roles, expectations, responsibilities, and feedback loops." },
  { title: "Faith or spirituality", desc: "A framework you choose to use for meaning." },
];

const PROCESS = [
  { step: "01", title: "Tell it", desc: "Start with your experience in your own words." },
  {
    step: "02",
    title: "See the pattern",
    desc: "Sovereign helps separate what happened from what it means.",
  },
  {
    step: "03",
    title: "See what matters",
    desc: "Understand what the pattern may be producing in your life.",
  },
  { step: "04", title: "Choose", desc: "See what is yours to examine, change, or decide." },
];

const HOW_IT_WORKS = [
  {
    title: "Share your baseline once",
    desc: "A few details about your birth — date, time, place. That's all Sovereign needs to personalize everything after.",
  },
  {
    title: "Sovereign builds your context",
    desc: "NASA/JPL planetary data is computed into a personal Baseline that every conversation reads — so the AI knows your context on every turn.",
  },
  {
    title: "Ask anything, choose for yourself",
    desc: "Each answer is grounded in your Baseline and your own words. You remain the authority — Sovereign surfaces patterns, you decide.",
  },
];

/**
 * The product, drawn in CSS: a live chat-thread preview with baseline context.
 * This is the single intentional "surface" on the landing — everything else
 * is editorial, so the hero reads as a working tool, not a mock-up.
 */
function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-card/60 p-5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo showWordmark={false} href="#" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Baseline loaded
            </span>
          </div>
          <span className="rounded-md border border-foreground/25 bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
            Free · 0 of 5
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {BASELINE_CONTEXT.map((c) => (
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
            Why does setting one boundary create so much conflict?
          </div>
        </div>

        <div className="mb-4 flex justify-start">
          <div className="max-w-[92%] rounded-lg rounded-bl-sm bg-muted px-3.5 py-2.5">
            <p className="font-display text-[15px] leading-snug text-foreground">
              The friction is the signal.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              A limit you set for the first time isn&apos;t just a new rule — it&apos;s a new role. The
              conflict is the system responding to the change.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
<span className="flex-1 text-[12px] text-muted-foreground">
            Ask what&apos;s really happening…
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
        {/* ── Section 1 · Hero ─────────────────────────────── */}
        <section className="relative overflow-hidden px-6 pb-24 pt-16 md:pb-32 md:pt-24">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,250,240,0.06),transparent_62%)]"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal>
              <div className="text-left">
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Sovereign OS
                </p>
                <h1 className="font-display text-5xl font-normal leading-[1.05] tracking-tight text-foreground md:text-6xl xl:text-7xl">
                  Understand yourself.
                  <br />
                  <span className="text-muted-foreground">Understand your relationships.</span>
                  <br />
                  See what is really happening.
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                  Sovereign helps you make sense of the patterns in your life — starting with you,
                  then looking at what happens between you and other people.
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/onboard?mode=signup" className="btn-aurora px-7 py-3 text-sm font-medium">
                    Get Started
                  </Link>
                  <Link href="/onboard?mode=login" className="btn-glass px-7 py-3 text-sm font-medium text-foreground">
                    Sign In
                  </Link>
                </div>

                <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                  {TRUST_NOTES.map((note, i) => (
                    <li key={note} className="flex items-center gap-5">
                      {i > 0 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
                      {note}
                    </li>
                  ))}
                </ul>

                <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
                    Try asking
                  </span>
                  <RotatingQuestions />
                </div>
              </div>
            </Reveal>

            <Reveal delay={120} from="left" className="w-full justify-self-center lg:justify-self-end">
              <HeroMock />
            </Reveal>
          </div>
        </section>

        {/* ── Section 2 · The Experience ───────────────────── */}
        <section className="border-t border-white/10 px-6 py-24 md:py-36">
          <div className="mx-auto max-w-4xl">
            <Reveal className="mb-16">
              <span className={OVERLINE}>01 · The Experience</span>
              <h2 className="mb-4 font-display text-3xl font-normal text-foreground">
                Start with what&apos;s happening.
              </h2>
              <p className="text-lg text-muted-foreground">
                You don&apos;t need the right words. Just tell Sovereign what&apos;s going on.
              </p>
            </Reveal>

            <div className="border-t border-white/10">
              {QUESTIONS.map((quote, i) => (
                <Reveal key={quote} delay={i * 90}>
                  <blockquote className="border-b border-white/10 py-9">
                    <p className="font-display text-2xl leading-snug tracking-tight text-foreground md:text-3xl">
                      “{quote}”
                    </p>
                  </blockquote>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-16">
              <p className="max-w-2xl text-xl leading-relaxed text-muted-foreground md:text-2xl">
                Sovereign helps you separate{" "}
                <strong className="font-medium text-foreground">what happened</strong> from{" "}
                <strong className="font-medium text-foreground">what you think it means.</strong>{" "}
                Then it helps you look for the pattern.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Section 3 · The Translation ──────────────────── */}
        <section className="border-t border-white/10 bg-muted/30 px-6 py-24 md:py-36">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-16 max-w-2xl">
              <span className={OVERLINE}>02 · The Translation</span>
              <h2 className="mb-4 font-display text-3xl font-normal text-foreground">
                One experience. More than one way to understand it.
              </h2>
              <p className="text-lg text-muted-foreground">
                The same moment can be described through several lenses — and more than one can be
                true at once.
              </p>
            </Reveal>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {LENSES.map((lens, i) => (
                <Reveal key={lens.title} delay={i * 60} from="left">
                  <div className="grid gap-1 py-5 sm:grid-cols-[240px_1fr] sm:items-baseline sm:gap-10">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {`0${i + 1} · ${lens.title}`}
                    </p>
                    <p className="text-muted-foreground">{lens.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-24">
              <Reveal>
                <span className={OVERLINE}>The Process</span>
              </Reveal>
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                {PROCESS.map((item, i) => (
                  <Reveal key={item.step} delay={i * 60}>
                    <div className="border-t border-foreground/20 pt-6 transition-colors duration-[240ms] group-hover:border-foreground/40">
                      <span className="mb-2 block font-mono text-xs tracking-[0.16em] text-muted-foreground">
                        {item.step}
                      </span>
                      <h3 className="mb-2 text-lg font-medium text-foreground">{item.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4 · The Baseline (engine reveal) ─────── */}
        <section className="relative overflow-hidden border-y border-white/10 px-6 py-32 md:py-40">
          <div className="absolute inset-0 z-0 bg-black/40" />
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />

          <div className="relative z-10 mx-auto max-w-4xl space-y-14 text-center">
            <Reveal>
              <span className={OVERLINE}>03 · The Baseline</span>
              <h2 className="mb-4 font-display text-5xl font-normal text-foreground">Your Baseline</h2>
              <p className="text-xl text-muted-foreground">A personal starting point.</p>
            </Reveal>

            <Reveal delay={60} className="mx-auto max-w-2xl">
              <p className="text-lg text-muted-foreground">
                Sovereign creates a personal Baseline from your birth information. It provides
                additional context for exploring your tendencies.
              </p>
            </Reveal>

            <div className="mx-auto max-w-2xl space-y-12 text-left">
              {HOW_IT_WORKS.map((item, i) => (
                <Reveal key={item.title} delay={i * 70}>
                  <div className="relative pl-12">
                    <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/5 font-mono text-[11px] tracking-widest text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-base font-medium text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={80}>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/onboard?mode=signup" className="btn-aurora w-full px-7 py-3 text-sm font-medium sm:w-auto">
                  Create Your Baseline
                </Link>
                <Link href="/onboard?mode=login" className="btn-glass w-full px-7 py-3 text-sm font-medium text-foreground sm:w-auto">
                  Sign In
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Section 5 · The Systems ──────────────────────── */}
        <section className="border-t border-white/10 px-6 py-24 md:py-36">
          <div className="mx-auto max-w-4xl">
            <Reveal className="mb-20">
              <span className={OVERLINE}>04 · The Systems</span>
              <h2 className="mb-6 font-display text-4xl font-normal leading-tight text-foreground">
                You are embedded in systems.
              </h2>
              <p className="mb-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                Families, teams, and groups develop patterns of their own. These patterns form
                around{" "}
                <strong className="font-medium text-foreground">roles</strong>,{" "}
                <strong className="font-medium text-foreground">expectations</strong>,{" "}
                <strong className="font-medium text-foreground">responsibility</strong>, and{" "}
                <strong className="font-medium text-foreground">feedback loops</strong> — and when
                one person changes, the whole system responds.
              </p>
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
                The goal isn&apos;t to find someone to blame. It&apos;s to understand the system you
                are participating in.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <div className="border-t border-white/10 pt-10">
                <p className="font-display text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
                  You remain the authority.
                </p>
                <p className="mt-5 text-xl leading-relaxed text-muted-foreground">
                  Sovereign does not diagnose you. It helps distinguish{" "}
                  <strong className="font-medium text-foreground">what we know</strong>,{" "}
                  <strong className="font-medium text-foreground">what we think</strong>, and{" "}
                  <strong className="font-medium text-foreground">what you can choose</strong>.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Section 6 · FAQ ───────────────────────────────── */}
        <section className="border-t border-white/10 px-6 py-24">
          <Reveal className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center font-display text-3xl font-normal text-foreground md:text-4xl">
              Questions, answered.
            </h2>
            <div className="border-t border-white/10">
              <details className="group border-b border-white/10 py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  Is this therapy or medical advice?
                  <span className="ml-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  No. Sovereign OS is a tool for self-reflection and pattern awareness. It does not
                  diagnose, treat, or replace professional mental health, medical, or financial
                  advice. If you are struggling, please reach out to a qualified professional.
                </p>
              </details>
              <details className="group border-b border-white/10 py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  What do you do with my birth data?
                  <span className="ml-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Your date, time, and place of birth are used for one thing only: computing your
                  baseline from NASA/JPL planetary data. It is never sold or shared, and you can
                  delete your entire account — data included — in one click from your Account page.
                </p>
              </details>
              <details className="group border-b border-white/10 py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  What&apos;s the difference between Free and Sovereign+?
                  <span className="ml-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Free includes your full baseline and 5 AI messages per day. Sovereign+ removes the
                  daily cap, keeps your complete conversation history, and adds advanced pattern
                  analysis — monthly at $20, or annually at $99 (save 59%).
                </p>
              </details>
              <details className="group border-b border-white/10 py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  Can I cancel anytime?
                  <span className="ml-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Yes. Subscriptions are managed through Stripe — cancel in two clicks from your
                  Account page, and your access continues through the end of the paid period.
                </p>
              </details>
            </div>
          </Reveal>
        </section>

        {/* ── Section 7 · Final CTA ────────────────────────── */}
        <section className="border-t border-white/10 px-6 py-32 text-center">
          <Reveal className="mx-auto max-w-2xl">
            <h2 className="mb-4 font-display text-4xl font-normal text-foreground md:text-5xl">
              Start with yourself.
            </h2>
            <p className="mb-12 text-xl text-muted-foreground">
              You don&apos;t need to have it figured out.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/onboard?mode=signup" className="btn-aurora w-full px-7 py-3 text-sm font-medium sm:w-auto">
                Create Your Baseline
              </Link>
              <Link href="/onboard?mode=login" className="btn-glass w-full px-7 py-3 text-sm font-medium text-foreground sm:w-auto">
                Sign In
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-background px-6 py-12 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Private by design</p>
            <p>Your birth data is not sold or shared.</p>
          </div>
          <div className="flex items-center gap-6">
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