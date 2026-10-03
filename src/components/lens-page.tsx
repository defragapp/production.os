"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/page-header";
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
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: readonly LensCard[];
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  children?: ReactNode;
  note?: string;
}) {
  return (
    <PageShell center={false} wide="wide" rule className="space-y-10">
      <Reveal className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_25px_80px_-28px_rgba(0,0,0,0.85)]">
          <Logo showWordmark={false} markClassName="h-9 w-auto" />
        </div>
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
      </Reveal>

      {children && <Reveal className="mx-auto w-full max-w-3xl">{children}</Reveal>}

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card, index) => (
          <Reveal key={card.title} delay={index * 80} className="h-full">
            <div className="glass-panel card-lift flex h-full flex-col rounded-panel p-6 md:p-7">
              {card.eyebrow && (
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {card.eyebrow}
                </p>
              )}
              <h2 className="font-display text-xl font-normal tracking-tight text-foreground md:text-[1.55rem]">
                {card.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-[15px]">{card.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mx-auto max-w-3xl text-center">
        {note && <p className="mb-5 text-sm leading-7 text-muted-foreground">{note}</p>}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={cta.href} className="btn-focal inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold">
            {cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {secondaryCta && (
            <Link href={secondaryCta.href} className="tap-line rounded-full border border-border/70 px-5 py-3 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground">
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </Reveal>
    </PageShell>
  );
}


