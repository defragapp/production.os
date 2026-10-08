"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { PageCrown } from "@/components/page-crown";
import { SiteFooter } from "@/components/site-footer";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

export type LensCard = {
  eyebrow?: string;
  title: string;
  body: string;
};

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
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("reveal", className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

export function LensPage({
  eyebrow,
  title,
  description,
  cards,
  cta,
  secondaryCta,
  children,
  note,
  isAuthed = false,
  hasBaseline = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: readonly LensCard[];
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string; stateAware?: boolean };
  children?: ReactNode;
  note?: string;
  // Resolved server-side by the page (see lib/lens-state) — the booleans are
  // identical in the RSC payload and the client tree, so reading them here
  // cannot cause a hydration mismatch or a post-paint CTA swap.
  isAuthed?: boolean;
  hasBaseline?: boolean;
}) {
  // The third lens card only restated the call to action beneath it, so the grid
  // now shows the two genuinely distinct cards and the third card's directional
  // headline folds into the CTA block — one fewer glass box, a tighter scroll,
  // and a clearer hierarchy between "what this is" and "what to do next."
  const gridCards = cards.slice(0, 2);
  const direction = cards.length > 2 ? cards[2] : undefined;
  // A state-aware secondary CTA must never tell a visitor to build the thing
  // they already built: with a Baseline on file, the lens itself is the way in.
  const secondary =
    secondaryCta?.stateAware && isAuthed && hasBaseline
      ? { label: "Enter your Lens", href: "/chat" }
      : secondaryCta;
  return (
    <>
    <PageShell center={false} wide="wide" rule className="space-y-10">
      <Reveal className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_25px_80px_-28px_rgba(0,0,0,0.85)]">
          <Logo showWordmark={false} markClassName="h-9 w-auto" />
        </div>
        <PageCrown eyebrow={eyebrow} title={title} deck={description} />
      </Reveal>

      {children && <Reveal className="mx-auto w-full max-w-3xl">{children}</Reveal>}

      {/* These two are prose, not interactive surfaces — so they carry no box.
          A top hairline + the brand's gold eyebrow give each column structure
          and rhythm without the "two identical glass cards" look. */}
      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        {gridCards.map((card, index) => (
          <Reveal key={card.title} delay={index * 80} className="h-full">
            <div className="flex h-full flex-col border-t border-border/60 pt-6">
              {card.eyebrow && (
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(38_45%_75%)]">
                  {card.eyebrow}
                </p>
              )}
              <h2 className="font-display text-xl font-normal leading-tight tracking-tight text-foreground md:text-2xl">
                {card.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-[15px]">{card.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mx-auto max-w-3xl text-center">
        {direction && (
          <p className="mx-auto mb-3 max-w-xl font-display text-lg leading-snug text-foreground md:text-xl">
            {direction.title}
          </p>
        )}
        {note && <p className="mb-6 text-sm leading-7 text-muted-foreground">{note}</p>}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={cta.href} className="btn-focal inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold">
            {cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {secondary && (
            <Link href={secondary.href} className="btn-glass tap-line px-5 py-3 text-sm font-medium text-foreground">
              {secondary.label}
            </Link>
          )}
        </div>
      </Reveal>
    </PageShell>
    <SiteFooter />
    </>
  );
}


