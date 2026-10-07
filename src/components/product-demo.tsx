"use client";

import { ArrowUp, Plus } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { BaselineDrawer } from "@/components/baseline-drawer";
import type { BaselineData } from "@/lib/types";

const HERO_BASELINE: BaselineData = {
  astrology: {
    sunSign: "Cancer",
    moonSign: "Cancer",
    risingSign: "Pisces",
    planets: {
      sun: { sign: "Cancer", theme: "Holding and protecting what matters" },
      moon: { sign: "Cancer", theme: "Reflex to guard what it loves" },
    },
  },
  humanDesign: {
    type: "Projector",
    strategy: "Wait for the Invitation",
    authority: "Splenic",
  },
};

export function ProductDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Layered backdrop plates for subtle elevation. Borderless on purpose:
          a visible hairline peeking past the main card's bottom edge reads as
          a stray outline, not depth. The tint step plus a soft drop shadow is
          what makes the stack feel like stacked glass plates. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-4 bottom-[-14px] h-full rotate-[1.8deg] rounded-panel bg-surface-1/70 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-6 bottom-[-7px] h-full rotate-[-1.2deg] rounded-panel bg-surface-2/80 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)]"
      />

      <div className="relative">
        <div className="demo-backlight" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-panel border border-white/10 bg-gradient-to-b from-surface-3 to-surface-1 p-4 shadow-[inset_0_1px_0_rgba(251,247,239,0.14),inset_0_0_0_1px_rgba(251,247,239,0.02),0_30px_90px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <Eyebrow>Sovereign OS</Eyebrow>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Personal Baseline
            </span>
          </div>

          {/* Active Thread Chip */}
          <div className="mb-4 flex items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Plus className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
              New thread
            </span>
            <span className="shrink-0 truncate rounded-full border border-foreground/30 bg-white/[0.07] px-3 py-1 text-[11px] text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.1)]">
              Pulling away when close
            </span>
          </div>

          {/* User Prompt */}
          <div className="mb-3 flex justify-end">
            <div className="max-w-[90%] rounded-panel rounded-br-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:px-4 sm:py-2.5 sm:text-[14px]">
              Why do I pull away whenever things get close?
            </div>
          </div>

          {/* Sovereign Answer */}
          <div className="glass-panel w-full rounded-panel rounded-tl-sm px-3.5 py-3 text-left font-display text-[14px] leading-[1.6] text-foreground sm:px-4 sm:text-[15px]">
            <div className="space-y-2">
              <p>
                When closeness deepens, pulling back feels like protection.
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground">Moon in Cancer:</span> a reflex to guard what you love before it can be hurt. A tendency, not a verdict.
              </p>
              <p className="border-t border-border/70 pt-2 italic text-foreground/90">
                What would change if you stayed present for one more conversation?
              </p>
            </div>
          </div>

          {/* Baseline Context Trigger */}
          <div className="mt-3">
            <BaselineDrawer data={HERO_BASELINE} overlay />
          </div>

          {/* Composer */}
          <div className="composer-pill mt-3 flex items-center gap-2 py-1.5 pl-4 pr-1.5">
            <span className="flex h-9 flex-1 items-center text-[13px] text-muted-foreground">
              Ask Sovereign…
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Send</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
