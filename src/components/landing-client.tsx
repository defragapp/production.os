"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUp, Check, Plus } from "lucide-react";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";
import { PageTexture } from "@/components/page-texture";
import { BaselineDrawer } from "@/components/baseline-drawer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PricingTable } from "@/components/pricing-table";
import { cn } from "@/lib/utils";
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
  children: ReactNode;
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

const TRUST_NOTES = ["Private by design", "Built from your Baseline", "Free to start"];

const EXPLORE = [
  {
    title: "You",
    lead: "Who you are when the pressure is off — and who takes over when it's on.",
    desc: "See your strengths clearly, understand why you react the way you do when you're overwhelmed, and find your way back to yourself.",
    question: "Who am I, underneath all this?",
  },
  {
    title: "Relationships",
    lead: "See both sides of the conversation without losing your own.",
    desc: "Step out of the cycle where one person presses and the other withdraws. Understand what each of you is really protecting, so you can respond with a clear head.",
    question: "Why does that one conversation always go sideways?",
  },
  {
    title: "Family & groups",
    lead: "Stop carrying roles in the room that were never yours to hold.",
    desc: "Unpack the unwritten rules, the roles you inherited, and the quiet expectations in your family or team — without blame, and without turning anyone into the villain.",
    question: "What role did I inherit that I'm tired of playing?",
  },
];

const HOW_IT_WORKS = [
  {
    title: "Map your Baseline",
    desc: "Enter your birth details once. Sovereign builds an enduring reference for how you naturally process, communicate, and react under pressure.",
  },
  {
    title: "Bring a real situation",
    desc: "A tense conversation, an unspoken family dynamic, a decision you keep turning over. Start wherever it's actually live for you.",
  },
  {
    title: "Get clear perspective",
    desc: "See what's really going on beneath the surface, what each side is protecting, and the one question that helps you choose your next move.",
  },
];

// The anatomy of a Sovereign answer is stated once, in a line — not a process diagram.

const DEMO_ANSWER = [
  "Here's what keeps happening: closeness gets real, and you pull back before it can be depended on.",
  "Your Baseline carries a Moon in Cancer — tenderness, and a reflex to guard what it loves. A tendency, not a verdict.",
];

const DEMO_REFLECTION = "What would change if you let one person see the full weight of what you feel?";

/**
 * The proof, not the promise: a representative Sovereign answer broken into
 * the three things it always keeps apart — plus the question it hands back.
 * Relationship framing, because that's the part no solo journaling app does.
 * Labelled illustrative: it is an example, never a fabricated testimonial.
 */
const ANSWER_ANATOMY = [
  {
    label: "What you brought",
    body: "You both say the fight is about the number. The useful signal isn't the amount — it's that it keeps returning to the same trigger.",
  },
  {
    label: "What your Baseline suggests · a tendency, not a verdict",
    body: "Your chart leans toward deciding through other people's angles — you feel what a choice costs someone before you feel what it costs you. Over time that can turn into yielding, then resenting the yield.",
  },
  {
    label: "What's only worth examining",
    body: "One possibility is that the money stands in for a quieter argument about who holds authority here. It's also allowed to be only about the money.",
  },
  {
    label: "The question it leaves with you",
    body: "When the number comes up, what are you each actually asking for?",
  },
];

// The relationship moat, made interactive: the same moment seen from each
// side, resolving into shared ground. Copy follows the human-first rule set —
// no jargon, no "the pattern", the output is an "answer", never a "read".
const PERSPECTIVE = {
  eyebrow: "Between two people",
  heading: "The same moment, from both sides.",
  deck: "When one person presses for an answer, the other often steps back to find one. Neither is wrong — and Sovereign holds both at once.",
  sides: {
    you: {
      tab: "What you might be feeling",
      text: "Urgency to resolve this now, so it stops feeling unsafe between us.",
    },
    them: {
      tab: "What they might be experiencing",
      text: "Feeling flooded, and needing a little space before they can think clearly.",
    },
  },
  commonLabel: "The common ground",
  commonText:
    "You both value the connection. You just regulate pressure at different speeds — and that difference is negotiable, not a verdict on either of you.",
  note: "An illustrative example — the shape of a real conversation, not a transcript.",
} as const;

/**
 * The product, drawn in CSS: the same surfaces and chrome the real chat
 * renders today — pill thread chips, an avatar-free glass bubble set in the
 * display serif, the composer pill — with an answer in the
 * authentic voice Sovereign actually produces: notice what keeps happening,
 * name what it costs, read the Baseline as a tendency, then leave one honest
 * question open.
 */
function ProductDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Stacked-window depth: two faint surfaces rotated behind the chat
          card — the "there's a whole product here" cue, without covering
          anything meaningful. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-4 bottom-[-18px] h-full rotate-[1.8deg] rounded-panel border border-border bg-surface-1/60"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-6 bottom-[-9px] h-full rotate-[-1.2deg] rounded-panel border border-border bg-surface-2/70"
      />
      <div className="relative">
      <div className="demo-backlight" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-panel border border-white/10 bg-gradient-to-b from-surface-3 to-surface-1 p-4 shadow-[inset_0_1px_0_rgba(251,247,239,0.14),inset_0_0_0_1px_rgba(251,247,239,0.02),0_30px_90px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex items-center">
          <Eyebrow>Sovereign OS</Eyebrow>
        </div>

        {/* The real thread strip: pill chips, the active one lit */}
        <div className="mb-4 flex items-center gap-1.5">
          <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Plus className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
            New thread
          </span>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-foreground/30 bg-white/[0.07] px-3 py-1 text-[11px] text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.1)]">
            Pulling away when it gets real
          </span>
        </div>

        <div className="mb-3 flex justify-end">
          <div className="max-w-[88%] rounded-panel rounded-br-sm bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:px-4 sm:py-3 sm:text-[14px]">
            Why do I keep pulling away once a relationship gets serious?
          </div>
        </div>

        {/* Sovereign's turn: a clean glass bubble in the display serif — no
            avatar, no emblem in the thread. The answer is the point. */}
        <div>
          <div className="glass-panel w-full rounded-panel rounded-tl-sm px-3.5 py-2.5 text-left font-display text-[14px] leading-[1.65] text-foreground sm:px-4 sm:py-3 sm:text-[15px]">
            <div className="space-y-2 sm:space-y-2.5">
              {DEMO_ANSWER.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <p className="border-t border-border/70 pt-2 italic text-foreground/90">
                {DEMO_REFLECTION}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <BaselineDrawer data={DEMO_BASELINE} overlay />
        </div>

        {/* The real composer: the pill, the placeholder, the round send */}
        <div className="composer-pill mt-3 flex items-center gap-2 py-1.5 pl-5 pr-1.5">
          <span className="flex h-11 flex-1 items-center text-[13px] text-muted-foreground">
            Ask Sovereign…
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Send</span>
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}

/** Pricing feature line with a quiet check marker — bare text lists read as
    unfinished next to premium pricing tables. */
function PlanFeature({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-foreground/60" strokeWidth={2.2} aria-hidden="true" />
      {children}
    </li>
  );
}

/**
 * The landing's section crown — the single place the warm-gold signature accent
 * lives. A short lit hairline, a gold-tinted eyebrow, the serif title, and an
 * optional deck. Routing every section header through this one component keeps
 * the accent restrained and identical wherever it appears; `align="left"` drives
 * the platform's one asymmetric section. Kept local to the landing on purpose:
 * inner routes use <PageHeader>, which stays quiet (no gold) so the marketing
 * surface holds the exclusive register.
 */
function SectionCrown({
  eyebrow,
  title,
  deck,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  deck?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const isCenter = align === "center";
  return (
    <div className={cn("mb-10 md:mb-12", isCenter ? "text-center" : "text-left", className)}>
      <span className={cn("crown-gold mb-4", isCenter && "mx-auto")} aria-hidden="true" />
      <Eyebrow accent className="mb-3">
        {eyebrow}
      </Eyebrow>
      <h2 className="font-display text-[1.75rem] font-normal tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {deck && (
        <p className={cn("mt-3 text-sm text-muted-foreground md:text-base", isCenter && "mx-auto max-w-2xl")}>
          {deck}
        </p>
      )}
    </div>
  );
}

/**
 * The relationship moat, made tangible: toggle to the other side of the same
 * moment, then land on common ground. Two states, one always-visible resolution
 * so the shared truth is never hidden behind a tab. Illustrative, labelled so.
 */
function PerspectiveSwitch() {
  const [side, setSide] = useState<"you" | "them">("you");
  const active = PERSPECTIVE.sides[side];
  const chip =
    "tap-line rounded-full border px-4 py-2 text-sm transition-colors";
  const on =
    "border-foreground/30 bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.1)]";
  const off = "border-border/50 bg-surface-1/50 text-muted-foreground hover:text-foreground";

  return (
    <div className="glass-panel rounded-panel p-6 md:p-9">
      <div
        className="flex flex-wrap justify-center gap-2"
        role="group"
        aria-label="Two sides of the same moment"
      >
        {(["you", "them"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSide(key)}
            aria-pressed={side === key}
            className={`${chip} ${side === key ? on : off}`}
          >
            {PERSPECTIVE.sides[key].tab}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-6 text-center">
        <p
          key={side}
          className="msg-in mx-auto max-w-xl font-display text-[15px] leading-[1.7] text-foreground/90 md:text-[16px]"
        >
          {active.text}
        </p>
      </div>

      <div className="mt-6 border-t border-border/70 pt-5 text-center">
        <Eyebrow scale="sm" className="mb-1.5">
          {PERSPECTIVE.commonLabel}
        </Eyebrow>
        <p className="mx-auto max-w-xl font-display text-[15px] leading-[1.7] text-foreground/90 md:text-[16px]">
          {PERSPECTIVE.commonText}
        </p>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground/70">{PERSPECTIVE.note}</p>
    </div>
  );
}

export function LandingClient() {
  return (
    <div className="relative min-h-screen bg-background font-sans text-foreground selection:bg-muted">
      <PageTexture />
      <Nav />

      <main id="main" className="relative z-10 overflow-x-hidden">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-16 lg:pb-28 lg:pt-20">
          <div className="hero-light" aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <Reveal>
              <div className="text-left">
                <h1 className="font-display text-[2rem] font-normal leading-[1.12] tracking-tight text-foreground sm:text-4xl md:text-[3rem] md:leading-[1.06] lg:text-[3.75rem] lg:leading-[1.04] xl:text-[4.125rem]">
                  Understand <span className="italic">who you are</span> — and why your relationships work the way they do.
                </h1>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base lg:text-lg lg:leading-8">
                  Sovereign is a private space to explore your life, make sense of the moments that keep
                  repeating, and find a clearer way forward. Grounded in your birth data, built for real life.
                </p>

                <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <Link href="/onboard?mode=signup" className="btn-focal px-7 py-3 text-sm font-semibold">
                    Start free
                  </Link>
                  <button
                    type="button"
                    onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="tap-line text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground"
                  >
                    See how it works →
                  </button>
                </div>

                <ul className="mt-7 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[13px] text-muted-foreground lg:text-sm">
                  {TRUST_NOTES.map((note, i) => (
                    <li key={note} className="flex items-center gap-3.5">
                      {i > 0 && <span className="h-1 w-1 rounded-full bg-muted-foreground/50" aria-hidden="true" />}
                      {note}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    href="/self"
                    className="rounded-full border border-border/70 bg-white/[0.03] px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Self
                  </Link>
                  <Link
                    href="/people"
                    className="rounded-full border border-border/70 bg-white/[0.03] px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    People
                  </Link>
                  <Link
                    href="/systems"
                    className="rounded-full border border-border/70 bg-white/[0.03] px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Systems
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120} className="w-full justify-self-center lg:justify-self-end">
              <ProductDemo />
            </Reveal>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section id="how" className="relative overflow-hidden scroll-mt-24 px-6 py-20 md:py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <SectionCrown
                eyebrow="How it works"
                title="Three steps. It starts with wherever you are."
              />
            </Reveal>

            <div className="grid gap-4 md:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <Reveal key={step.title} delay={i * 90}>
                  <div className="glass-panel card-lift flex h-full flex-col p-6 md:p-7">
                    <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/40 font-mono text-sm text-foreground/80">
                      {i + 1}
                    </span>
                    <h3 className="font-display text-xl font-normal text-foreground md:text-2xl">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-[15px]">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── What you can explore ─────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden bg-muted/30 px-6 py-20 md:py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <SectionCrown
                eyebrow="What you can look at"
                title="Yourself, your relationships, the rooms you move through."
                deck="Sovereign works wherever your life is actually happening."
              />
            </Reveal>

            <div className="grid gap-4 md:grid-cols-3">
              {EXPLORE.map((item, i) => (
                <Reveal key={item.title} delay={i * 90}>
                  <div className="glass-panel card-lift flex h-full flex-col p-6 md:p-7">
                    <Eyebrow as="h3" scale="sm" className="mb-3">{item.title}</Eyebrow>
                    <p className="mt-3 font-display text-xl font-normal leading-snug text-foreground md:text-[1.6rem]">{item.lead}</p>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground md:text-[15px]">{item.desc}</p>
                    <p className="mt-4 break-words rounded-lg border border-border bg-background/40 px-3.5 py-2.5 text-sm leading-relaxed text-foreground/90 md:mt-auto md:text-[15px]">
                      “{item.question}”
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* How an answer works — one quiet line + honest provenance, not a
                boxy process diagram. */}
            <Reveal delay={120} className="mt-12">
              <p className="mx-auto max-w-xl text-center font-display text-lg italic leading-relaxed text-foreground/85 md:text-xl">
                Every answer returns to your Baseline — and leaves the deciding to you.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 md:text-[11px]">
                {["NASA/JPL planetary data", "Ten natal bodies", "Human Design", "Gene Keys"].map((source, i) => (
                  <span key={source} className="flex items-center gap-5">
                    {i > 0 && <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden="true" />}
                    {source}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

{/* ── What an answer looks like ──────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden bg-muted/30 px-6 py-20 md:py-28">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <SectionCrown
                eyebrow="What an answer looks like"
                title="Not a verdict. A way of thinking back to you."
                deck={
                  <>
                    Every answer keeps three things apart — what happened, what your Baseline suggests,
                    and what&apos;s only worth examining — then hands the last word back to you.
                  </>
                }
              />
            </Reveal>

            <Reveal delay={100}>
              <div className="glass-panel rounded-panel p-6 md:p-9">
                <div className="mb-6 flex justify-end">
                  <div className="max-w-[85%] rounded-panel rounded-br-sm bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                    Why do we have the same fight every time money comes up?
                  </div>
                </div>
                <div className="space-y-5">
                  {ANSWER_ANATOMY.map((part) => (
                    <div key={part.label}>
                      <Eyebrow scale="sm" className="mb-1.5">{part.label}</Eyebrow>
                      <p className="font-display text-[15px] leading-[1.7] text-foreground/90 md:text-[16px]">{part.body}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 border-t border-border/70 pt-4 text-xs text-muted-foreground/70">
                  An illustrative example — the shape of a real answer, not a transcript of one.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Between two people ───────────────────────────── */}
        {/* The one asymmetric section: the platform's rhythm is centered, so
            breaking it here lands on the relationship moat — and the split
            layout *is* the message (two sides, held together). */}
        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden px-6 py-20 md:py-28">
          <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
            <Reveal>
              <SectionCrown
                align="left"
                className="mb-0"
                eyebrow={PERSPECTIVE.eyebrow}
                title={PERSPECTIVE.heading}
                deck={PERSPECTIVE.deck}
              />
            </Reveal>
            <Reveal delay={100}>
              <PerspectiveSwitch />
            </Reveal>
          </div>
        </section>


{/* ── Plans ────────────────────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden px-6 py-20 md:py-28">
          <Reveal className="mx-auto max-w-4xl">
            <span className="crown-gold mx-auto mb-4" aria-hidden="true" />
            <Eyebrow accent className="mb-3 text-center">Plans</Eyebrow>
            <h2 className="mb-3 text-center font-display text-[1.75rem] font-normal tracking-tight text-foreground md:text-4xl">
              Free to start. Keep going when it gets deep.
            </h2>
            <p className="mb-10 text-center text-sm text-muted-foreground md:text-base">
              Every plan includes your full Baseline and saves your conversations.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-panel card-lift flex flex-col p-7">
                <p className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Free
                </p>
                <p className="mb-5 font-display text-3xl font-normal">$0</p>
                <ul className="flex-1 space-y-2.5 text-sm text-muted-foreground">
                  <PlanFeature>Your full Baseline</PlanFeature>
                  <PlanFeature>5 AI messages a day</PlanFeature>
                  <PlanFeature>Your conversations stay with you</PlanFeature>
                </ul>
                <Link
                  href="/onboard?mode=signup"
                  className="btn-aurora mt-7 px-7 py-3 text-center text-sm font-medium"
                >
                  Start free
                </Link>
              </div>

              <div className="glass-panel card-lift relative flex flex-col p-7 border-foreground/30 shadow-[0_0_35px_-12px_rgba(244,239,228,0.12)]">
                <p className="mb-1 flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.16em] text-foreground font-semibold">
                  Sovereign+
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Best value</span>
                </p>
                <p className="mb-5 flex items-baseline gap-2 font-display text-3xl font-normal">
                  $99
                  <span className="font-sans text-sm text-muted-foreground">/yr · or $20/mo</span>
                </p>
                <ul className="flex-1 space-y-2.5 text-sm text-muted-foreground">
                  <PlanFeature>Unlimited AI messages — no daily cap</PlanFeature>
                  <PlanFeature>Invite people into your relationships</PlanFeature>
                  <PlanFeature>Your full Baseline, same private engine</PlanFeature>
                </ul>
                <Link
                  href="/onboard?mode=signup"
                  className="btn-focal mt-7 px-7 py-3 text-center text-sm font-semibold text-foreground"
                >
                  Start with Sovereign+
                </Link>
              </div>
            </div>

            <PricingTable />
          </Reveal>
        </section>

{/* ── Final CTA ────────────────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden px-6 py-24 text-center md:py-32">
          <div className="hero-light" aria-hidden="true" />
          <Reveal className="relative mx-auto max-w-2xl">
            {/* Lit emblem medallion — same focal treatment as the in-app empty
                states, so the closing beat books the page with the brand. */}
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-surface-2 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12),0_20px_50px_-24px_rgba(0,0,0,0.8)]">
              <Logo showWordmark={false} href="#" markClassName="h-8 w-auto" />
            </div>
            <Eyebrow accent className="mb-3">Begin</Eyebrow>
            <h2 className="mb-4 font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-[1.15]">
              Start with one honest question.
            </h2>
            <p className="mb-7 text-muted-foreground">
              It&apos;s free — you don&apos;t need to have anything figured out.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/onboard?mode=signup" className="btn-aurora w-full px-8 py-3.5 text-base font-medium sm:w-auto">
                Start free
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative bg-background px-6 pb-12 pt-14 text-sm text-muted-foreground">
        <div className="section-rule absolute inset-x-0 top-0" aria-hidden="true" />
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Logo href="#" />
            <p className="mt-2.5">Private by design. Grounded in data. Yours to decide.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/about" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              Philosophy
            </Link>
            <Link href="/self" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              Self
            </Link>
            <Link href="/people" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              People
            </Link>
            <Link href="/systems" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              Systems
            </Link>
            <Link href="/blog" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              Field Notes
            </Link>
            <Link href="/faq" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              FAQ
            </Link>
            <Link href="/terms" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              Privacy
            </Link>
            <Link href="/support" className="tap-line transition-colors duration-[240ms] hover:text-foreground">
              Support
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-1 border-t border-white/[0.06] pt-6 text-xs text-muted-foreground/75">
          <p>Sovereign OS™ — © 2026 Sovereign OS. All rights reserved.</p>
          <p>Sovereign OS is a trademark used as a common-law mark. The Service and its AI outputs are protected under the Terms of Service.</p>
        </div>
      </footer>
    </div>
  );
}