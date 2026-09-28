/**
 * Deterministic browser harness for the JourneyCanvas / JourneyBar (Part 4
 * ratchet). Mounts the *committed* components with a fixed, deterministic
 * state so Playwright can assert (a) the SVG milestone nodes render and the
 * progress line reflects state, and (b) the touch targets meet the 44px floor.
 * No D1, no auth, no AI inference — pure render, so it is fast and stable.
 *
 * Gate 8 measures the committed VEIL contract (globals.css `.journey-veil`):
 * an absolutely-positioned overlay whose arrival only animates transform and
 * opacity — the two properties the Layout Instability API exempts. The naive
 * control (a discrete in-flow insert above the scroller) proves the detector
 * is not theatre: Chrome counts every in-flow height change as a shift,
 * animated or not, so "in flow" can never reach zero and this harness would
 * catch any regression that moves the transcript.
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
let revealRoot: Root | null = null;

// Live layout-shift accounting for the CLS fixture. Registered at module
// load, so it observes every shift the harness page produces from here on.
type ShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean };
const shifts: number[] = [];
new PerformanceObserver((list) => {
  for (const e of list.getEntries() as ShiftEntry[]) {
    if (!e.hadRecentInput) shifts.push(e.value);
  }
}).observe({ type: "layout-shift", buffered: true });

const w = globalThis as unknown as {
  __mountJourney?: (el: HTMLElement, doneCount: number) => void;
  __mountReveal?: (el: HTMLElement, doneCount: number) => void;
  __mountNaive?: (el: HTMLElement, doneCount: number) => void;
  __naiveClear?: () => void;
  __revealOpen?: (open: boolean) => void;
  __clsReset?: () => void;
  __clsRead?: () => { total: number; count: number };
  __appendRows?: (n: number) => void;
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

/** The CLS fixture: mirrors the committed chat shell — an opaque header strip,
 *  a relatively-positioned column that holds the absolutely-positioned
 *  `.journey-veil` (closed: clipped away at its own top edge) over a
 *  bottom-pinned transcript scroller, and a composer row below. Nothing here
 *  ever unmounts on open/close, exactly like the committed page. */
w.__mountReveal = (el, doneCount) => {
  el.innerHTML = `
    <div style="height:56px;flex-shrink:0;background:#111"></div>
    <div id="naive-slot"></div>
    <div id="shell" style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column">
      <div id="reveal-slot" class="journey-veil"><div style="padding:12px 16px"><div id="reveal-bar"></div></div></div>
      <div id="transcript" style="flex:1;min-height:0;overflow-y:auto;background:#0d0c0b">
        <div class="t-row" style="height:44px;margin:8px 12px;background:#1c1a18;border-radius:8px"></div>
        <div class="t-row" style="height:44px;margin:8px 12px;background:#1c1a18;border-radius:8px"></div>
        <div class="t-row" style="height:44px;margin:8px 12px;background:#1c1a18;border-radius:8px"></div>
      </div>
      <div style="height:56px;flex-shrink:0;background:#000"></div>
    </div>`;
  const bar = el.querySelector("#reveal-bar") as HTMLElement;
  // innerHTML was just rewritten, so any previous container is detached and
  // its root is gone with it — every fixture build gets a root on the new bar.
  revealRoot = createRoot(bar);
  revealRoot.render(
    <JourneyBar
      journey={{
        id: "local",
        goal: "Work through the tension with my partner",
        status: "active",
        steps: stepsWithDone(doneCount),
        progress: doneCount / 5,
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

/** The negative control: the same JourneyBar appearing the wrong way — a
 *  discrete in-flow insert at the transcript's top edge, with visible content
 *  below it that must move. If this reads zero, the observer is blind. */
let naiveRoot: Root | null = null;
w.__mountNaive = (el, doneCount) => {
  const slot = el.querySelector("#naive-slot") as HTMLElement;
  // A React root may never be re-created on the same container after an
  // unmount, so each mount gets a fresh wrapper element inside the slot.
  const host = document.createElement("div");
  slot.appendChild(host);
  naiveRoot = createRoot(host);
  naiveRoot.render(
    <div style={{ padding: "12px 16px" }}>
      <JourneyBar
        journey={{
          id: "local",
          goal: "Work through the tension with my partner",
          status: "active",
          steps: stepsWithDone(doneCount),
          progress: doneCount / 5,
          newlyUnlocked: [],
          inquiryLevel: 3,
        }}
        onRename={() => {}}
        onPauseResume={() => {}}
        onDismiss={() => {}}
        onStepBack={() => {}}
      />
    </div>,
  );
};

w.__naiveClear = () => {
  naiveRoot?.unmount();
  naiveRoot = null;
};

w.__revealOpen = (open) => {
  const slot = document.querySelector("#reveal-slot");
  if (slot) slot.classList.toggle("journey-veil-open", open);
};

w.__clsReset = () => { shifts.length = 0; };

w.__clsRead = () => ({ total: shifts.reduce((a, b) => a + b, 0), count: shifts.length });

/** Message insertion, the way an early thread grows: rows appear below the
 *  last one while everything still fits — no scroll adjustment is needed, so
 *  no already-visible pixel moves. A bottom-pinned scroller must never
 *  auto-jump its viewport on an append, or the thread flies away under the
 *  reader's thumb (and the shift counter ticks). */
w.__appendRows = (n) => {
  const t = document.querySelector("#transcript");
  if (!t) return;
  for (let i = 0; i < n; i += 1) {
    const row = document.createElement("div");
    row.className = "t-row";
    row.setAttribute("style", "height:44px;margin:8px 12px;background:#1c1a18;border-radius:8px");
    t.appendChild(row);
  }
};
