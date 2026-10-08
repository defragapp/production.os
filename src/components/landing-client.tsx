"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/ui/logo";
import { PageTexture } from "@/components/page-texture";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteFooter } from "@/components/site-footer";
import { ProductDemo } from "@/components/product-demo";

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    el.classList.add("js-ok", "reveal-from-up");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
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

const TRUST_NOTES = ["Private by design", "Built from your Baseline", "Free to start"];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Map your Baseline",
    desc: "Enter your birth details once. Sovereign creates an enduring reference for how you naturally process and react under pressure.",
  },
  {
    step: "02",
    title: "Bring a real situation",
    desc: "A tense conversation, an unspoken family dynamic, or a decision you keep turning over. Start wherever it is live.",
  },
  {
    step: "03",
    title: "Get clear perspective",
    desc: "See what each person is protecting, what your Baseline suggests, and the one question that unlocks the next move.",
  },
];

const LENSES = [
  {
    name: "Self",
    href: "/self",
    lead: "Who you are when the pressure is off.",
    desc: "Understand your natural tendencies and find your way back to balance.",
  },
  {
    name: "People",
    href: "/people",
    lead: "Both sides of the conversation.",
    desc: "Step out of repeating cycles and see what each person is really protecting.",
  },
  {
    name: "Family & Teams",
    href: "/systems",
    lead: "The dynamics of the whole room.",
    desc: "Unpack inherited roles in families or teams without blame or villains.",
  },
];

function PlanFeature({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-foreground/60" strokeWidth={2.2} aria-hidden="true" />
      {children}
    </li>
  );
}

function SectionCrown({
  eyebrow,
  title,
  deck,
}: {
  eyebrow: string;
  title: ReactNode;
  deck?: ReactNode;
}) {
  return (
    <div className="mb-10 text-center md:mb-12">
      <span className="crown-gold mx-auto mb-4" aria-hidden="true" />
      <Eyebrow accent className="mb-3">{eyebrow}</Eyebrow>
      <h2 className="font-display text-[1.75rem] font-normal tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {deck && (
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          {deck}
        </p>
      )}
    </div>
  );
}

export function LandingClient() {
  return (
    <div className="relative min-h-screen bg-background font-sans text-foreground selection:bg-muted">
      <PageTexture />
      <Nav />

      <main id="main" className="relative z-10 overflow-x-hidden">
        {/* ── 1. Hero ────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:pb-24 lg:pt-20">
          <div className="hero-light" aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <Reveal>
              <div className="text-left">
                <h1 className="font-display text-[2.1rem] font-normal leading-[1.12] tracking-tight text-foreground sm:text-4xl md:text-[3rem] md:leading-[1.06] lg:text-[3.75rem] lg:leading-[1.04]">
                  Understand <span className="italic">who you are</span> — and why your relationships work the way they do.
                </h1>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
                  Sovereign is a private space to make sense of what keeps happening, grounded in your Baseline and built for real life.
                </p>

                <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <Link href="/onboard?mode=signup" className="btn-focal px-7 py-3 text-sm font-semibold">
                    Start free
                  </Link>
                  <button
                    type="button"
                    onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
                    className="tap-line text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground"
                  >
                    See how it works →
                  </button>
                </div>

                <ul className="mt-7 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[13px] text-muted-foreground">
                  {TRUST_NOTES.map((note, i) => (
                    <li key={note} className="flex items-center gap-3.5">
                      {i > 0 && <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/50 sm:block" aria-hidden="true" />}
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={100} className="w-full justify-self-center lg:justify-self-end">
              <ProductDemo />
            </Reveal>
          </div>
        </section>

        {/* ── 2. How It Works ───────────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section id="how" className="relative overflow-hidden scroll-mt-24 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <SectionCrown
                eyebrow="How it works"
                title="Three steps. It starts wherever you are."
              />
            </Reveal>

            <div className="grid gap-4 md:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <Reveal key={step.title} delay={i * 80}>
                  <div className="glass-panel card-lift flex h-full flex-col p-6 md:p-7">
                    <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/40 font-mono text-xs text-foreground/80">
                      {step.step}
                    </span>
                    <h3 className="font-display text-xl font-normal text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. Three Lenses ───────────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden bg-muted/20 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <SectionCrown
                eyebrow="Three Lenses"
                title="Yourself, your people, the rooms you move through."
                deck="Choose the perspective that fits what you are facing right now."
              />
            </Reveal>

            <div className="grid gap-4 md:grid-cols-3">
              {LENSES.map((lens, i) => (
                <Reveal key={lens.name} delay={i * 80}>
                  <Link
                    href={lens.href}
                    className="glass-panel card-lift group flex h-full flex-col justify-between p-6 transition-colors hover:border-foreground/30 md:p-7"
                  >
                    <div>
                      <Eyebrow scale="sm" className="mb-3">{lens.name}</Eyebrow>
                      <h3 className="font-display text-xl font-normal text-foreground transition-colors group-hover:text-primary">
                        {lens.lead}
                      </h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                        {lens.desc}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-foreground/80 group-hover:text-foreground">
                      <span>Explore {lens.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>

            <Reveal delay={120} className="mt-12 text-center">
              <p className="mx-auto max-w-xl font-display text-base italic leading-relaxed text-foreground/85 md:text-lg">
                Every answer returns to your Baseline — and leaves the deciding to you.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                {["NASA/JPL planetary data", "Ten celestial bodies", "Human Design", "Gene Keys"].map((source, i) => (
                  <span key={source} className="flex items-center gap-5">
                    {i > 0 && <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden="true" />}
                    {source}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── 4. Plans ──────────────────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section id="plans" className="relative overflow-hidden px-6 py-16 md:py-24">
          <Reveal className="mx-auto max-w-3xl">
            <SectionCrown
              eyebrow="Plans"
              title="Free to start. Keep going when it gets deep."
              deck="Every plan includes your full Baseline, and your conversations stay with you."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-panel card-lift flex flex-col p-7">
                <p className="mb-1 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Free
                </p>
                <p className="mb-5 font-display text-3xl font-normal">$0</p>
                <ul className="flex-1 space-y-2.5 text-sm text-muted-foreground">
                  <PlanFeature>Your full Baseline</PlanFeature>
                  <PlanFeature>5 AI messages a day</PlanFeature>
                  <PlanFeature>Private, cross-device history</PlanFeature>
                </ul>
                <Link
                  href="/onboard?mode=signup"
                  className="btn-glass mt-7 px-7 py-3 text-center text-sm font-medium"
                >
                  Start free
                </Link>
              </div>

              <div className="glass-panel card-backlight card-lift relative flex flex-col border-foreground/30 p-7 shadow-[0_0_35px_-12px_rgba(244,239,228,0.12)]">
                <p className="mb-1 flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                  Sovereign+
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Best value</span>
                </p>
                <p className="mb-5 flex items-baseline gap-2 font-display text-3xl font-normal">
                  $99
                  <span className="font-sans text-sm text-muted-foreground">/yr · or $20/mo</span>
                </p>
                <ul className="flex-1 space-y-2.5 text-sm text-muted-foreground">
                  <PlanFeature>Up to 150 AI messages a day</PlanFeature>
                  <PlanFeature>Invite people into your relationships</PlanFeature>
                </ul>
                <Link
                  href="/onboard?mode=signup&next=%2Fupgrade"
                  className="btn-aurora mt-7 px-7 py-3 text-center text-sm font-medium"
                >
                  Start with Sovereign+
                </Link>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Need more details? Compare all plan specifications in our{" "}
              <Link href="/faq" className="underline hover:text-foreground">
                FAQ
              </Link>
              {" "}or view the{" "}
              <Link href="/upgrade" className="underline hover:text-foreground">
                full comparison
              </Link>
              .
            </p>
          </Reveal>
        </section>

        {/* ── 5. Final CTA ──────────────────────────────────── */}
        <div className="section-rule" aria-hidden="true" />
        <section className="relative overflow-hidden px-6 py-20 text-center md:py-28">
          <div className="hero-light" aria-hidden="true" />
          <Reveal className="relative mx-auto max-w-xl">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-surface-2 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12),0_20px_50px_-24px_rgba(0,0,0,0.8)]">
              <Logo showWordmark={false} href={null} markClassName="h-8 w-auto" />
            </div>
            <Eyebrow accent className="mb-3">Begin</Eyebrow>
            <h2 className="mb-4 font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
              Start with one honest question.
            </h2>
            <p className="mb-7 text-muted-foreground">
              It is free — you don&apos;t need to have anything figured out.
            </p>
            <div className="flex justify-center">
              <Link href="/onboard?mode=signup" className="btn-aurora w-full px-8 py-3.5 text-base font-medium sm:w-auto">
                Start free
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
