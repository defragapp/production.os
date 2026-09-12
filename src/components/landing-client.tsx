"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Nav } from "@/components/nav";

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

function BgBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      el.style.transform = `translate3d(0, ${window.scrollY * 0.2}px, 0)`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0 opacity-30 mix-blend-screen"
      style={{
        background: "radial-gradient(circle at 50% 0%, rgba(26,26,30,1) 0%, rgba(7,7,9,1) 70%)",
      }}
    />
  );
}

// Buttons and overlines share the app's semantic tokens (primary = white,
// primary-foreground = near-black) so the landing matches the rest of Sovereign.
const BTN_PRIMARY =
  "bg-primary text-primary-foreground rounded-md px-8 py-3 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_20px_rgba(255,255,255,0.10)] hover:-translate-y-[2px] hover:bg-neutral-200 transition-all duration-[240ms] ease-spring";
const BTN_GHOST =
  "bg-white/10 border border-white/10 border-t-white/20 text-foreground rounded-md px-8 py-3 font-medium backdrop-blur-md hover:bg-white/20 transition-all duration-[240ms] ease-spring";

const OVERLINE =
  "mb-6 block font-mono text-xs uppercase tracking-widest text-muted-foreground";

const QUESTIONS = [
  "Why do I keep taking responsibility for everyone?",
  "Why does this relationship keep going in circles?",
  "Why does setting one boundary create so much conflict?",
];

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

export function LandingClient() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
      <BgBackdrop />
      <Nav />

      <main className="relative z-10">
        {/* ── Section 1 · Hero ─────────────────────────────── */}
        <section className="flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
          <div className="max-w-4xl space-y-8">
            <Reveal>
              <h1 className="text-5xl font-medium leading-tight tracking-tight text-foreground md:text-7xl">
                Understand yourself.
                <br />
                <span className="text-muted-foreground">Understand your relationships.</span>
                <br />
                See what is really happening.
              </h1>
            </Reveal>
            <Reveal delay={60}>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Sovereign helps you make sense of the patterns in your life — starting with you,
                then looking at what happens between you and other people.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="flex flex-col items-center gap-3 pt-8">
                <Link href="/onboard?mode=signup" className={`${BTN_PRIMARY} px-6 py-2.5`}>
                  Get Started
                </Link>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Free to start.
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Section 2 · The Experience ───────────────────── */}
        <section className="border-t border-white/10 px-6 py-32">
          <div className="mx-auto max-w-4xl">
            <Reveal className="mb-16">
              <span className={OVERLINE}>01 · The Experience</span>
              <h2 className="mb-4 text-3xl font-medium text-foreground">Start with what&apos;s happening.</h2>
              <p className="text-lg text-muted-foreground">
                You don&apos;t need the right words. Just tell Sovereign what&apos;s going on.
              </p>
            </Reveal>

            <div className="mb-16 space-y-4">
              {QUESTIONS.map((quote, i) => (
                <Reveal key={quote} delay={i * 70}>
                  <div className="rounded-2xl border border-white/10 border-t-white/15 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                    <p className="text-lg font-medium leading-snug text-foreground">“{quote}”</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <p className="max-w-2xl text-xl leading-relaxed text-muted-foreground md:text-2xl">
                Sovereign helps you separate{" "}
                <strong className="font-medium text-foreground">what happened</strong> from{" "}
                <strong className="font-medium text-foreground">what you think it means.</strong> Then it
                helps you look for the pattern.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Section 3 · The Translation ──────────────────── */}
        <section className="border-t border-white/10 bg-muted/30 px-6 py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-16 max-w-2xl">
              <span className={OVERLINE}>02 · The Translation</span>
              <h2 className="mb-4 text-3xl font-medium text-foreground">
                One experience. More than one way to understand it.
              </h2>
              <p className="text-lg text-muted-foreground">
                The same moment can be described through several lenses — and more than one can be
                true at once.
              </p>
            </Reveal>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {LENSES.map((lens, i) => (
                <Reveal
                  key={lens.title}
                  delay={i * 60}
                  className={i === 0 ? "lg:col-span-2" : undefined}
                >
                  <div className="h-full rounded-2xl border border-white/10 border-t-white/15 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                    <h3 className="mb-2 font-medium text-foreground">{lens.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{lens.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-24">
              <Reveal>
                <span className={OVERLINE}>The Process</span>
              </Reveal>
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {PROCESS.map((item, i) => (
                  <Reveal key={item.step} delay={i * 60} className="relative group">
                    <div className="absolute -left-4 top-0 hidden h-full w-px bg-white/10 transition-colors duration-[240ms] group-hover:bg-white/30 sm:block" />
                    <span className="mb-3 block font-mono text-xs tracking-widest text-muted-foreground">
                      {item.step}
                    </span>
                    <h3 className="mb-2 text-lg font-medium text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4 · The Baseline (engine reveal) ─────── */}
        <section className="relative overflow-hidden border-y border-white/10 px-6 py-40">
          <div className="absolute inset-0 z-0 bg-black/40" />
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />

          <div className="relative z-10 mx-auto max-w-4xl space-y-12 text-center">
            <Reveal>
              <span className={OVERLINE}>03 · The Baseline</span>
              <h2 className="mb-4 text-5xl font-medium text-foreground">Your Baseline</h2>
              <p className="text-xl text-muted-foreground">A personal starting point.</p>
            </Reveal>

            <Reveal delay={60} className="mx-auto max-w-2xl">
              <p className="text-lg text-muted-foreground">
                Sovereign creates a personal Baseline from your birth information. It provides
                additional context for exploring your tendencies.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/onboard?mode=signup" className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                  Create Your Baseline
                </Link>
                <Link href="/onboard?mode=login" className={`${BTN_GHOST} w-full sm:w-auto`}>
                  Sign In
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Section 5 · The Systems ──────────────────────── */}
        <section className="border-t border-white/10 px-6 py-32">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <Reveal className="flex flex-col justify-center">
              <span className={OVERLINE}>04 · The Systems</span>
              <h2 className="mb-6 text-4xl font-medium leading-tight text-foreground">
                You are embedded in systems.
              </h2>
              <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
                Families, teams, and groups develop patterns of their own. These patterns form
                around{" "}
                <strong className="font-medium text-foreground">roles</strong>,{" "}
                <strong className="font-medium text-foreground">expectations</strong>,{" "}
                <strong className="font-medium text-foreground">responsibility</strong>, and{" "}
                <strong className="font-medium text-foreground">feedback loops</strong> — and when one
                person changes, the whole system responds.
              </p>
              <p className="text-lg leading-relaxed text-muted-foreground">
                The goal isn&apos;t to find someone to blame. It&apos;s to understand the system you
                are participating in.
              </p>
            </Reveal>

            <Reveal delay={80} className="flex flex-col justify-center">
              <div className="rounded-2xl border border-white/10 border-t-white/15 bg-white/[0.03] p-10 backdrop-blur-md">
                <p className="mb-4 text-3xl font-medium text-foreground">You remain the authority.</p>
                <p className="text-xl leading-relaxed text-muted-foreground">
                  Sovereign does not diagnose you. It helps distinguish{" "}
                  <strong className="font-medium text-foreground">what we know</strong>,{" "}
                  <strong className="font-medium text-foreground">what we think</strong>, and{" "}
                  <strong className="font-medium text-foreground">what you can choose</strong>.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Section 6 · Final CTA ────────────────────────── */}
        <section className="border-t border-white/10 px-6 py-32 text-center">
          <Reveal className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-4xl font-medium text-foreground md:text-5xl">
              Start with yourself.
            </h2>
            <p className="mb-12 text-xl text-muted-foreground">
              You don&apos;t need to have it figured out.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/onboard?mode=signup" className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                Create Your Baseline
              </Link>
              <Link href="/onboard?mode=login" className={`${BTN_GHOST} w-full sm:w-auto`}>
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