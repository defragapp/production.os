"use client";

import { Eyebrow } from "@/components/ui/eyebrow";

const ANATOMY_STEPS = [
  {
    label: "1. What you brought",
    body: "You both say the tension is about money. The signal is that it keeps returning to the exact same trigger.",
  },
  {
    label: "2. What your Baseline suggests · a tendency, not a verdict",
    body: "Your Baseline leans toward deciding through other people's angles. Over time that turns into yielding, then resenting the yield.",
  },
  {
    label: "3. What's only worth examining",
    body: "One possibility: the money stands in for who holds authority here. It is also allowed to be only about the money.",
  },
  {
    label: "4. The question it leaves with you",
    body: "When this number comes up, what are you each actually asking for?",
  },
];

export function AnswerAnatomy() {
  return (
    <div className="glass-panel rounded-panel p-6 text-left md:p-8">
      <div className="mb-5 flex justify-end">
        <div className="max-w-[85%] rounded-panel rounded-br-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed text-primary-foreground sm:px-4 sm:py-2.5 sm:text-[14px]">
          Why do we have the same argument every time money comes up?
        </div>
      </div>
      <div className="space-y-4">
        {ANATOMY_STEPS.map((part) => (
          <div key={part.label} className="border-l-2 border-border/80 pl-3.5">
            <Eyebrow scale="sm" className="mb-1">
              {part.label}
            </Eyebrow>
            <p className="font-display text-[14px] leading-relaxed text-foreground/90 md:text-[15px]">
              {part.body}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-border/70 pt-3 text-center text-xs text-muted-foreground/70">
        An illustrative example — the shape of an answer, not a transcript.
      </p>
    </div>
  );
}
