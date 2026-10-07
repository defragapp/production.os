"use client";

import { useState } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";

const PERSPECTIVE_DATA = {
  you: {
    tab: "What you might feel",
    text: "Urgency to resolve this now, so it stops feeling unsafe between us.",
  },
  them: {
    tab: "What they might experience",
    text: "Feeling flooded, and needing a little space before they can think clearly.",
  },
  commonText:
    "You both value the connection — you just regulate pressure at different speeds. That difference is negotiable.",
};

export function PerspectiveSwitch() {
  const [side, setSide] = useState<"you" | "them">("you");
  const active = PERSPECTIVE_DATA[side];

  return (
    <div className="glass-panel rounded-panel p-6 text-center md:p-8">
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Perspective selector">
        {(["you", "them"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSide(key)}
            aria-pressed={side === key}
            className={`tap-line rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              side === key
                ? "border-foreground/30 bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_hsla(38,18%,95%,0.1)]"
                : "border-border/50 bg-surface-1/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {PERSPECTIVE_DATA[key].tab}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-5 min-h-[50px] text-center">
        <p className="font-display text-[15px] leading-relaxed text-foreground/90 md:text-[16px]">
          {active.text}
        </p>
      </div>

      <div className="mt-5 border-t border-border/70 pt-4 text-center">
        <Eyebrow scale="sm" className="mb-1">The common ground</Eyebrow>
        <p className="font-display text-[14px] leading-relaxed text-foreground/85 md:text-[15px]">
          {PERSPECTIVE_DATA.commonText}
        </p>
      </div>
    </div>
  );
}
