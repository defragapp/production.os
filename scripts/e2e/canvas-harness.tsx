/**
 * Deterministic browser harness for the JourneyCanvas / JourneyBar (Part 4
 * ratchet). Mounts the *committed* components with a fixed, deterministic
 * state so Playwright can assert (a) the SVG milestone nodes render and the
 * progress line reflects state, and (b) the touch targets meet the 44px floor.
 * No D1, no auth, no AI inference — pure render, so it is fast and stable.
 */
import { createRoot, type Root } from "react-dom/client";
import { JourneyBar } from "../../src/components/journey-canvas";
import { DEFAULT_JOURNEY_STEPS, type JourneyStep } from "../../src/lib/sovereign-journey";

function stepsWithDone(doneCount: number): JourneyStep[] {
  return DEFAULT_JOURNEY_STEPS.map((s, i) => ({
    ...s,
    status: i < doneCount ? ("done" as const) : i === doneCount ? ("current" as const) : ("locked" as const),
  }));
}

let mounted: Root | null = null;

const w = globalThis as unknown as {
  __mountJourney?: (el: HTMLElement, doneCount: number) => void;
};

w.__mountJourney = (el, doneCount) => {
  const steps = stepsWithDone(doneCount);
  if (!mounted) mounted = createRoot(el);
  mounted.render(
    <JourneyBar
      journey={{
        id: "local",
        goal: "Work through the tension with my partner",
        status: "active",
        steps,
        progress: doneCount / steps.length,
        newlyUnlocked: [],
        inquiryLevel: 3,
      }}
      onRename={() => {}}
      onPauseResume={() => {}}
      onDismiss={() => {}}
      onStepBack={() => {}}
    />,
  );
};
