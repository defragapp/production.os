/**
 * The software keyboard and the height it steals.
 *
 * `100dvh` is the right unit for browser chrome (the URL bar collapsing on
 * scroll) and the wrong unit for the keyboard. On iOS Safari — and in a
 * standalone PWA, which is how this app is installed on a phone — opening the
 * keys does not change the layout viewport at all: only `visualViewport`
 * reports the smaller region a person can actually see and tap. A shell pinned
 * to `100dvh` therefore keeps its composer exactly where the keyboard is, i.e.
 * underneath it, untappable, while the person types into a field they can't see.
 *
 * The fix is to stop trusting `dvh` while the keys are up and hand the shell the
 * visual viewport's own height, which the flex column then distributes: the
 * transcript gives back the space, the composer stays above the keys.
 *
 * This module is the arithmetic only — no DOM, no listener — so the decision
 * the page makes can be tested directly against the numbers real engines report.
 */

/** Below this many pixels, a lost height is browser chrome (a toolbar, a
 *  rounded-corner inset, a sub-pixel difference), not a keyboard. Pinned on a
 *  false positive the app would shrink for no reason and the transcript would
 *  lose rows it never needed to give up. */
export const KEYBOARD_MIN_INSET = 80;

/** A shell shorter than this cannot hold a header, a band, a message and a
 *  composer at all — some engines report a momentary zero-height visual
 *  viewport mid-transition, and honouring it would collapse the page. */
export const MIN_PINNABLE_HEIGHT = 240;

/**
 * The height the app shell should be pinned to, or `null` to leave it on its
 * own `100dvh`. `visualHeight` comes from `window.visualViewport.height`, which
 * excludes the keyboard; `innerHeight` is the layout viewport, which does not.
 */
export function keyboardPinHeight(innerHeight: number, visualHeight: number): number | null {
  if (!(innerHeight > 0) || !(visualHeight > 0)) return null;
  const inset = innerHeight - visualHeight;
  if (inset < KEYBOARD_MIN_INSET) return null;
  if (visualHeight < MIN_PINNABLE_HEIGHT) return null;
  return Math.round(Math.min(visualHeight, innerHeight));
}
