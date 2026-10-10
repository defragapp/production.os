"use client";

import { useState } from "react";
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

/**
 * The hero demo used to show one frozen exchange. It now offers a small rail of
 * the questions people actually arrive with — self, a decision, a relationship,
 * a family or team — so a visitor can see the product's breadth without the
 * landing turning into a feature grid. Every example is answerable from the one
 * fixture Baseline shown in the drawer beneath it, so nothing on screen claims
 * more than the demo data can support. Selecting a question updates the same
 * conversation; it does not open a second surface.
 */
interface DemoScenario {
  id: string;
  tab: string;
  chip: string;
  question: string;
  answer: string;
  evidenceLabel: string;
  evidence: string;
  close: string;
}

const SCENARIOS: DemoScenario[] = [
  {
    id: "self",
    tab: "Myself",
    chip: "Pulling away when close",
    question: "Why do I pull away whenever things get close?",
    answer: "When closeness deepens, pulling back can feel like protection.",
    evidenceLabel: "Moon in Cancer:",
    evidence: "a reflex to guard what you love before it can be hurt. A tendency, not a verdict.",
    close: "What would change if you stayed present for one more conversation?",
  },
  {
    id: "decision",
    tab: "A decision",
    chip: "Now or later",
    question: "Should I say something now, or wait?",
    answer:
      "The choice may not be between honesty and silence. It may be between speaking while the pressure is high and choosing a time when it can actually land.",
    evidenceLabel: "Splenic authority:",
    evidence: "your clearest knowing tends to arrive in an instant and cannot be forced. Pressure is what buries it.",
    close: "What would setting a time to return change about tonight?",
  },
  {
    id: "relationship",
    tab: "A relationship",
    chip: "Calm vs urgent",
    question: "Why does the same conversation feel calm to them and urgent to me?",
    answer:
      "You may need a defined next step before you can settle. They may need less pressure before they can answer clearly. What starts as a timing gap can harden into a values gap.",
    evidenceLabel: "Sun in Cancer:",
    evidence: "a pull to hold and protect what matters — which, to someone who settles more slowly, can land as pressure.",
    close: "What would letting them answer one step behind cost you?",
  },
  {
    id: "system",
    tab: "Family & team",
    chip: "Everything falls to me",
    question: "Why does everything fall to me when something goes wrong?",
    answer:
      "The room may lean on you to restore order because you have done it before. That does not mean the responsibility belongs to you now.",
    evidenceLabel: "Projector:",
    evidence: "you tend to see the shape of a group quickly, so others learn to wait for you to name it. A reflex they learned, not a duty you owe.",
    close: "What would happen if you named it and did not carry it?",
  },
];

export function ProductDemo() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const active = SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0];

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
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Sovereign OS</Eyebrow>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Personal Baseline
            </span>
          </div>

          {/* Question rail: the four questions a visitor can browse. Tapping one
              swaps the exchange below; the rail is the only new control added to
              the card, so the demo stays one stage rather than four. */}
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Example questions">
            {SCENARIOS.map((scenario) => {
              const on = scenario.id === activeId;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setActiveId(scenario.id)}
                  aria-pressed={on}
                  className={`tap-line rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                    on
                      ? "border-foreground/30 bg-surface-selected text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.1)]"
                      : "border-border/50 bg-surface-1/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {scenario.tab}
                </button>
              );
            })}
          </div>

          {/* Active Thread Chip */}
          <div className="mb-4 flex items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-1.5 rounded-chip border border-border bg-background/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Plus className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
              New thread
            </span>
            <span className="shrink-0 truncate rounded-full border border-foreground/30 bg-surface-3 px-3 py-1 text-[11px] text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.1)]">
              {active.chip}
            </span>
          </div>

          {/* User Prompt */}
          <div className="mb-3 flex justify-end">
            <div className="max-w-[90%] rounded-panel rounded-br-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:px-4 sm:py-2.5 sm:text-[14px]">
              {active.question}
            </div>
          </div>

          {/* Sovereign Answer */}
          <div
            aria-live="polite"
            className="glass-panel w-full rounded-panel rounded-tl-sm px-3.5 py-3 text-left font-display text-[14px] leading-[1.6] text-foreground sm:px-4 sm:text-[15px]"
          >
            <div className="space-y-2">
              <p>{active.answer}</p>
              <p className="text-muted-foreground">
                <span className="text-foreground">{active.evidenceLabel}</span> {active.evidence}
              </p>
              <p className="border-t border-border/70 pt-2 italic text-foreground/90">{active.close}</p>
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
