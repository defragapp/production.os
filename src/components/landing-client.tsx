"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";
import { BaselineDrawer } from "@/components/baseline-drawer";
import type { BaselineData } from "@/lib/types";

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
    <div ref={ref} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

const DEMO_BASELINE: BaselineData = {
  astrology: {
    sunSign: "Cancer",
    moonSign: "Cancer",
    risingSign: "Pisces",
    planets: {
      sun: { sign: "Cancer", theme: "Holding and protecting what matters" },
      moon: { sign: "Cancer", theme: "Sensitivity, and the reflex to guard what it loves" },
      venus: { sign: "Gemini", theme: "Restlessness in closeness — words over weight" },
      mars: { sign: "Libra", theme: "Deciding through other people's angles" },
      mercury: { sign: "Cancer", theme: "Reasoning through feeling" },
      jupiter: { sign: "Pisces", theme: "Generosity without doors" },
      saturn: { sign: "Aries", theme: "Discipline that starts itself" },
      neptune: { sign: "Sagittarius", theme: "Idealism dressed as certainty" },
      pluto: { sign: "Scorpio", theme: "Depth as power" },
    },
  },
  humanDesign: {
    type: "Projector",
    strategy: "Wait for the Invitation",
    authority: "Splenic",
    profile: "4/6",
    definedCenters: ["Head", "Spleen"],
    definedChannels: [
      { gates: [63, 4], name: "Logic" },
      { gates: [18, 58], name: "Judgment" },
    ],
  },
  geneKeys: {
    keys: [
      { gate: 51, line: 1, frequency: "Shadow", theme: "Shock taken inside" },
      { gate: 3, line: 4, frequency: "Gift", theme: "Renewal through disorder" },
    ],
  },
};

const TRUST_NOTES = ["Private by design", "NASA/JPL data", "Free to start"];

const EXPLORE = [
  {
    title: "Yourself",
    desc: "What drives you — and why your own qualities can turn on you under pressure.",
    question: "Why do I freeze the moment I get put on the spot?",
  },
  {
    title: "A relationship",
    desc: "What's actually happening between two people, beyond each person's version.",
    question: "Why do we have the same fight every time money comes up?",
  },
  {
    title: "Your family",
    desc: "The roles, loyalties, and silent rules everyone is playing out.",
    question: "Why does my family go quiet the instant someone gets angry?",
  },
];

// The anatomy of a Sovereign read — shown once, as a diagram, instead of
// three times as full prose columns.
const READ_FLOW = ["Your question", "The pattern", "Your Baseline", "A question back"];

const DEMO_ANSWER = [
  "You've named the pattern: closeness gets real, and you pull back before it can be depended on.",
  "Your Baseline carries a Moon in Cancer — tenderness, and a reflex to guard what it loves. A tendency, not a verdict.",
];

const DEMO_REFLECTION = "What would change if you let one person see the full weight of what you feel?";

/**
 * The product, drawn in CSS: the same chat surfaces the app renders, with an
 * answer in the authentic voice Sovereign actually produces: observe the
 * pattern, name its cost, read the Baseline as a tendency, then leave one
 * honest question open.
 */
function ProductDemo() {
  return (
    <div className="demo-float relative mx-auto w-full max-w-md">
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
            Preview
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
          <div className="max-w-[88%] rounded-2xl bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground sm:px-4 sm:py-3 sm:text-[15px]">
            Why do I keep pulling away once a relationship gets serious?
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[96%] rounded-2xl bg-muted px-3.5 py-2.5 text-left sm:max-w-[92%] sm:px-4 sm:py-3">
            <div className="space-y-2 text-[13px] leading-relaxed text-foreground sm:space-y-2.5 sm:text-[14px]">
              {DEMO_ANSWER.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <p className="border-t border-border/70 pt-2 text-foreground/90 italic">
                {DEMO_REFLECTION}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <BaselineDrawer data={DEMO_BASELINE} overlay />
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="flex-1 text-[12px] text-muted-foreground">Type your message...</span>
          <span className="flex h-7 items-center justify-center rounded-md bg-foreground px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-background">
            Send
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The product flow as a visual workflow: three nodes connected by arrows.
 * Horizontal on desktop, vertical on mobile. Copy is deliberately minimal —
 * the diagram carries the explanation, not paragraphs.
 */
const WORKFLOW = [
  {
    title: "Set your Baseline",
    desc: "Birth data, computed from NASA/JPL planetary positions.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Talk it through",
    desc: "A relationship, your family, or you — in your own words.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.2L8 19.2V15.5h-1.5a2 2 0 0 1-2-2v-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.5 8.5h7M8.5 11.5h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Get a grounded read",
    desc: "The pattern, named. The deciding left to you.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="m15.5 8.5-2.2 5-4.8 2 2.2-5 4.8-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function WorkflowArrow({ vertical }: { vertical?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center text-muted-foreground/50 ${
        vertical ? "h-8 py-1" : "h-6 w-6 pt-0 md:h-auto"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${vertical ? "rotate-90 md:rotate-0" : "rotate-90 md:rotate-0"}`}
        fill="none"
      >
        <path d="M4 12h14m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Workflow() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-stretch md:flex-row md:items-center md:gap-2">
      {WORKFLOW.map((step, i) => (
        <div key={step.title} className="contents">
          <Reveal delay={i * 90}>
            <div className="glass-panel flex h-full flex-col items-start gap-3 p-5 md:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-foreground/15 bg-foreground/[0.06] text-foreground">
                  {step.icon}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground md:text-lg">{step.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground md:text-sm">{step.desc}</p>
              </div>
            </div>
          </Reveal>
          {i < WORKFLOW.length - 1 && <WorkflowArrow vertical />}
        </div>
      ))}
    </div>
  );
}

export function LandingClient() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-muted">
      <Nav />

      <main className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <Reveal>
              <div className="text-left">
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Sovereign OS
                </p>
                <h1 className="font-display text-[1.875rem] font-normal leading-[1.15] tracking-tight text-foreground sm:text-4xl md:text-[2.875rem] md:leading-[1.1]">
                  Understand yourself, <span className="text-iridescent">your people</span>, and the systems you live within.
                </h1>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                  Sovereign is an AI that talks through what&apos;s happening in your life —
                  personal, private, and grounded in a Baseline built from your birth data.
                </p>

                <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <Link href="/onboard?mode=signup" className="btn-aurora px-7 py-3 text-sm font-semibold">
                    Start free
                  </Link>
                  <Link href="/about" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground">
                    Read the philosophy →
                  </Link>
                </div>

                <ul className="mt-7 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[13px] text-muted-foreground">
                  {TRUST_NOTES.map((note, i) => (
                    <li key={note} className="flex items-center gap-3.5">
                      {i > 0 && <span className="h-1 w-1 rounded-full bg-muted-foreground/50" aria-hidden="true" />}
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
<section className="relative overflow-hidden border-t border-white/10 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="mb-8 text-center font-display text-2xl font-normal text-foreground md:text-3xl">
                From your Baseline to a grounded read.
              </h2>
            </Reveal>
            <Workflow />
          </div>
        </section>

        {/* ── What you can explore ─────────────────────────── */}
        <section className="border-t border-white/10 bg-muted/30 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-10 text-center">
              <h2 className="font-display text-2xl font-normal text-foreground md:text-3xl">
                Ask about any part of your life.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground md:text-base">The questions people actually bring look like this.</p>
            </Reveal>

            <div className="grid gap-4 md:grid-cols-3">
              {EXPLORE.map((item, i) => (
                <Reveal key={item.title} delay={i * 90}>
                  <div className="flex h-full flex-col p-5 md:p-6 rounded-xl border border-white/10 bg-card/60">
                    <h3 className="font-display text-xl font-normal text-foreground">{item.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground md:text-sm">{item.desc}</p>
                    <p className="mt-4 break-words rounded-lg border border-border bg-background/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground/90">
                      “{item.question}”
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Anatomy of a read — one diagram instead of three prose columns. */}
            <Reveal delay={120} className="mt-10">
              <div className="flex flex-col items-center justify-center gap-3 md:flex-row md:gap-2">
                {READ_FLOW.map((node, i) => (
                  <div key={node} className="flex flex-col items-center gap-3 md:flex-row md:gap-2">
                    <span className="rounded-full border border-foreground/15 bg-foreground/[0.04] px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {node}
                    </span>
                    {i < READ_FLOW.length - 1 && <WorkflowArrow vertical />}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground/70">
                Every read returns to your Baseline — and leaves the deciding to you.
              </p>
            </Reveal>
          </div>
        </section>

{/* ── Plans ────────────────────────────────────────── */}
<section className="relative overflow-hidden border-t border-white/10 px-6 py-16 md:py-20">
          <Reveal className="mx-auto max-w-4xl">
            <h2 className="mb-3 text-center font-display text-2xl font-normal text-foreground md:text-3xl">
              Free to start. Keep going when it gets deep.
            </h2>
            <p className="mb-10 text-center text-sm text-muted-foreground md:text-base">
              Every plan includes your full Baseline and saves your conversations.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-panel flex flex-col p-7">
                <p className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Free
                </p>
                <p className="mb-5 font-display text-3xl font-normal">$0</p>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <li>Your full Baseline</li>
                  <li>5 AI messages a day</li>
                  <li>Your conversations stay with you</li>
                </ul>
                <Link
                  href="/onboard?mode=signup"
                  className="btn-aurora mt-7 px-7 py-3 text-center text-sm font-medium"
                >
                  Start free
                </Link>
              </div>

              <div className="glass-panel relative flex flex-col p-7">
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
                  <li>Unlimited AI messages — no daily cap</li>
                  <li>Invite people into your relationships</li>
                  <li>Your full Baseline, same private engine</li>
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
<section className="relative overflow-hidden border-t border-white/10 px-6 py-16 text-center md:py-20">
          <Reveal className="mx-auto max-w-2xl">
            <h2 className="mb-4 font-display text-2xl font-normal text-foreground sm:text-3xl md:text-4xl">
              Start with one honest question.
            </h2>
            <p className="mb-7 text-muted-foreground">
              It&apos;s free — you don&apos;t need to have anything figured out.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/onboard?mode=signup" className="btn-aurora w-full px-7 py-3 text-sm font-medium sm:w-auto">
                Start free
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-background px-6 py-12 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-medium text-foreground">Sovereign OS</p>
            <p className="mt-0.5">Private by design. Grounded in data. Yours to decide.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/about" className="transition-colors duration-[240ms] hover:text-foreground">
              Philosophy
            </Link>
            <Link href="/faq" className="transition-colors duration-[240ms] hover:text-foreground">
              FAQ
            </Link>
            <Link href="/terms" className="transition-colors duration-[240ms] hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors duration-[240ms] hover:text-foreground">
              Privacy
            </Link>
            <Link href="/support" className="transition-colors duration-[240ms] hover:text-foreground">
              Support
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-1 border-t border-white/10 pt-6 text-xs text-muted-foreground/70">
          <p>Sovereign OS™ — © 2026 Sovereign OS. All rights reserved.</p>
          <p>Sovereign OS is a trademark used as a common-law mark. The Service and its AI outputs are protected under the Terms of Service.</p>
        </div>
      </footer>
    </div>
  );
}