import { describe, it, expect } from "vitest";
import {
  keyboardPinHeight,
  KEYBOARD_MIN_INSET,
  MIN_PINNABLE_HEIGHT,
} from "./viewport";

/**
 * The keyboard arithmetic behind the chat shell's height. Nothing here needs a
 * browser: what matters is the numbers real engines hand us, and the decision
 * taken on them. A false negative is an untappable composer under the keys; a
 * false positive is the transcript silently losing rows to a toolbar that was
 * never there. Both are worth pinning down.
 */
describe("keyboardPinHeight — when to leave 100dvh behind", () => {
  it("leaves the shell alone when nothing is covering it", () => {
    // Desktop, and a phone whose keys are closed: the two viewports agree.
    expect(keyboardPinHeight(900, 900)).toBeNull();
    expect(keyboardPinHeight(844, 844)).toBeNull();
    // Sub-pixel disagreement between the two reports is noise, not a keyboard.
    expect(keyboardPinHeight(844, 843.5)).toBeNull();
  });

  it("leaves the shell alone for browser chrome smaller than the floor", () => {
    expect(keyboardPinHeight(844, 844 - KEYBOARD_MIN_INSET + 1)).toBeNull();
    expect(keyboardPinHeight(844, 800)).toBeNull();
  });

  it("pins to the visible height once a keyboard really is up", () => {
    // The case this exists for: iPhone 14 with the standard keys.
    expect(keyboardPinHeight(844, 480)).toBe(480);
    // A third-party keyboard with a suggestion bar above the keys.
    expect(keyboardPinHeight(844, 560.6)).toBe(561);
    // Android Chrome reports the shrink on both viewports, which is the same
    // answer either way: never taller than the layout viewport.
    expect(keyboardPinHeight(480, 480)).toBeNull();
    expect(keyboardPinHeight(844, 1000)).toBeNull();
  });

  it("refuses a height no app shell could live in", () => {
    // Mid-transition some engines report 0; honouring it would collapse the
    // whole page, composer and transcript included.
    expect(keyboardPinHeight(844, 0)).toBeNull();
    expect(keyboardPinHeight(844, 120)).toBeNull();
    expect(MIN_PINNABLE_HEIGHT).toBeGreaterThanOrEqual(240);
  });

  it("survives the nonsense values a listener can actually be handed", () => {
    expect(keyboardPinHeight(0, 0)).toBeNull();
    expect(keyboardPinHeight(Number.NaN, 480)).toBeNull();
    expect(keyboardPinHeight(844, Number.NaN)).toBeNull();
    expect(keyboardPinHeight(-844, 480)).toBeNull();
  });
});
