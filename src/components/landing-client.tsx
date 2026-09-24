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
    desc: "Understand what drives you — and why your own qualities can turn on you under pressure.",
    question: "Why do I freeze the moment I get put on the spot — and what kind of work actually fits how I'm built?",
    mapping: "Built to process deeply before speaking, not to improvise on command · Current cycle favors steady depth over proving yourself fast",
    response: "Freezing isn't a lack of capability — it's what happens when you're pushed to perform before you've had a second to take the room in. You do your best work where you can read the situation first and move deliberately, not where you have to sell an answer on the spot.",
    reflection: "What changes if you stop treating your need for preparation like a flaw, and start building your career around roles that value depth over speed?",
  },
  {
    title: "A relationship",
    desc: "See what's actually happening between two people, beyond each person's version of it.",
    question: "Why do we have the same fight every time money comes up?",
    mapping: "Two different reactions to pressure · One reaches for immediate certainty to feel safe; the other pulls back when urgency feels like control",
    response: "Money is rarely what the fight is actually about. When stress rises, one of you tries to lock down a plan right away to calm the tension, and the other reads that urgency as pressure and shuts down. Neither of you is trying to leave the other alone — your ways of getting safe just collide at the exact wrong moment.",
    reflection: "What happens next time if you name the stress in the room before you open the numbers?",
  },
  {
    title: "Your family",
    desc: "See the roles, loyalties, and silent rules everyone is playing out — even when no one named them.",
    question: "Why does my family go quiet the instant someone gets angry?",
    mapping: "Shared pattern where keeping the peace comes before honesty · Direct tension registers across the group as a threat to staying connected",
    response: "In your family, silence isn't indifference — it's an old agreement that harmony is what keeps everyone safe. When someone shows real frustration, everyone pulls back to keep the room from fracturing. You don't have to force a confrontation to change your part in it.",
    reflection: "What would it look like to state where you stand calmly once, and let their silence be theirs instead of rushing to fix it?",
  },
];

const DEMO_ANSWER = [
  "You've named the pattern precisely: closeness gets real, and you pull back before it can be depended on. That timing repeats because the retreat is doing a job — it keeps you safe from being relied on.",
  "The cost is real. Pulling away tells the other person, gently and over time, that they aren't allowed in far enough to matter. They stop reaching; you read that as proof you were right to pull back. The distance starts to look necessary.",
  "Your Baseline carries a Moon in Cancer — deep tenderness, and a reflex to guard what it loves. That's a tendency you carry, not a verdict on you. It means your protection comes from the same place your warmth does.",
  "The honest question to sit with: what would change if you let one person see the full weight of what you feel?",
];

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
            <div className="space-y-2 text-[13px] leading-relaxed text-foreground sm:space-y-3 sm:text-[15px]">
              {DEMO_ANSWER.map((p) => (
                <p key={p}>{p}</p>
              ))}
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
 * How-it-works as a vertical timeline: the accent line fills as you scroll.
 * Base markup is a static, fully-visible list (plain SSR HTML). Only after JS
 * runs is the fill driven by scroll position; each row still fades in via the
 * guarded <Reveal>. Reduced-motion users see the static rail with no fill.
 */
function StepsTimeline() {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const fill = fillRef.current;
    if (!track || !fill) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (vh * 0.55 - rect.top) / rect.height));
      fill.style.height = `${Math.round(progress * 100)}%`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div ref={trackRef} className="relative">
        <div aria-hidden="true" className="absolute bottom-3 left-[3px] top-3 w-px bg-white/10" />
        <div ref={fillRef} aria-hidden="true" className="absolute left-[3px] top-3 w-px bg-foreground/45" style={{ height: 0 }} />
        <div className="space-y-10">
          {HOW_IT_WORKS.map((step, i) => (
            <Reveal key={step.title} from="left">
              <div className="relative flex gap-5">
                <span className="relative z-10 mt-1 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border border-foreground/50 bg-background" />
                <div className="min-w-0">
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Step 0{i + 1}
                  </p>
                  <h3 className="mb-1.5 text-lg font-medium text-foreground">{step.title}</h3>
                  <p className="max-w-md text-base leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
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
        <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <Reveal>
              <div className="text-left">
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Sovereign OS
                </p>
                <h1 className="font-display text-[2rem] font-normal leading-[1.12] tracking-tight text-foreground sm:text-5xl md:text-[3.5rem] md:leading-[1.05]">
                  Understand yourself, <span className="text-iridescent">your people</span>, and the systems you live within.
                </h1>
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base md:text-lg">
                  Sovereign is an AI that talks through what&apos;s happening in your life —
                  personal, private, and grounded in a Baseline built from your birth data.
                </p>

                <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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
<section className="relative overflow-hidden border-t border-white/10 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="mb-10 text-center font-display text-3xl font-normal text-foreground md:text-4xl">
                From your Baseline to a grounded read.
              </h2>
            </Reveal>
            <StepsTimeline />
          </div>
        </section>

        {/* ── What you can explore ─────────────────────────── */}
        <section className="border-t border-white/10 bg-muted/30 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-12 text-center">
              <h2 className="font-display text-3xl font-normal text-foreground md:text-4xl">
                Ask about any part of your life.
              </h2>
              <p className="mt-3 text-muted-foreground">The questions people actually bring look like this.</p>
            </Reveal>
            <div className="grid gap-x-6 gap-y-14 md:grid-cols-3 md:gap-y-0">
              {EXPLORE.map((item) => (
                <div
                  key={item.title}
                  className="flex min-w-0 flex-col border-t border-foreground/20 pt-5 md:grid md:row-span-6 md:grid-rows-subgrid"
                >
                  {/* Row 1 — title + description, aligned across the row. */}
                  <div>
                    <h3 className="mb-2 font-display text-2xl font-normal text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>

                  {/* The question — a readable quote, raised in contrast. */}
                  <Reveal className="reveal mt-4">
                    <p className="break-words rounded-lg border border-border bg-background/40 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-foreground/90">
                      “{item.question}”
                    </p>
                  </Reveal>

                  <Reveal className="reveal hidden justify-center md:flex">
                    <span aria-hidden="true" className="my-1 h-7 w-px bg-white/10" />
                  </Reveal>

                  {/* The quiet read — desktop only; on mobile it collapses to keep
                      the column to a scannable question → answer. */}
                  <Reveal className="reveal hidden md:block">
                    <p className="break-words rounded-md border border-dashed border-border/70 bg-background/20 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                      {item.mapping}
                    </p>
                  </Reveal>

                  <Reveal className="reveal hidden justify-center md:flex">
                    <span aria-hidden="true" className="my-1 h-7 w-px bg-white/10" />
                  </Reveal>

                  {/* The answer — same editorial surface as the hero preview card. */}
                  <Reveal className="reveal mt-5 md:mt-0">
                    <div className="break-words rounded-xl border border-white/10 bg-card/60 p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.7)] backdrop-blur-sm">
                      <p className="text-sm leading-relaxed text-foreground/80">{item.response}</p>
                      <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-foreground">
                        {item.reflection}
                      </p>
                    </div>
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

{/* ── Plans ────────────────────────────────────────── */}
<section className="relative overflow-hidden border-t border-white/10 px-6 py-16 md:py-24">
          <Reveal className="mx-auto max-w-4xl">
            <h2 className="mb-3 text-center font-display text-3xl font-normal text-foreground md:text-4xl">
              Free to start. Keep going when it gets deep.
            </h2>
            <p className="mb-12 text-center text-muted-foreground">
              Every plan includes your full Baseline and saves your conversations. Free gives you
              five good answers a day — Sovereign+ removes the cap entirely.
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
<section className="relative overflow-hidden border-t border-white/10 px-6 py-20 text-center md:py-24">
          <Reveal className="mx-auto max-w-2xl">
            <h2 className="mb-4 font-display text-3xl font-normal text-foreground sm:text-4xl md:text-5xl">
              Start with one honest question.
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
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