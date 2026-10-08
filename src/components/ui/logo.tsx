import Link from "next/link";

/**
 * Sovereign OS logomark + wordmark. The mark is the canonical Ace-of-Cups
 * emblem (assets/ace-of-cups.jpg -> scripts/build-brand-assets.mjs ->
 * public/brand/emblem-core-bold.png): a descending dove above the overflowing
 * chalice. It is the SAME artwork used as the web-tab icon, iOS home-screen
 * icon, and social card — never a separate/simplified logo.
 *
 * The "-bold" cut is the real engraving downscaled to a working size and given
 * thickened hairlines (a morphological dilate in the build — not a redraw) so
 * the dove+chalice silhouette reads at header size instead of collapsing into a
 * smudge. `markClassName` lets tight contexts (the hero chat mock) scale it down.
 */
export function Logo({
  href = "/",
  className,
  markClassName = "h-12 w-auto",
  showWordmark = true,
}: {
  /**
   * `null` renders the medallion as inert art. Decorative placements (a
   * loading skeleton, the emblem inside a hero mock) must not hand keyboard
   * users a focusable link that goes nowhere.
   */
  href?: string | null;
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  const mark = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/emblem-core-bold.png"
        alt=""
        aria-hidden="true"
        className={`shrink-0 ${markClassName}`}
        style={{ imageRendering: "auto", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.45))" }}
      />
      {showWordmark && (
        <span className="font-sans text-[13px] font-semibold uppercase leading-none tracking-[0.2em] text-foreground">
          Sovereign<span className="text-muted-foreground">.OS</span>
        </span>
      )}
    </>
  );
  const box = `inline-flex items-center gap-2.5 ${className ?? ""}`;
  if (href === null) return <span className={box}>{mark}</span>;
  return (
    <Link
      href={href}
      aria-label="Sovereign OS home"
      // `nav-brand` is a hook: flat on desktop, raised to the 44px tap floor on
      // coarse pointers by globals.css (the bare emblem is only 22px wide). It
      // belongs to the link only — inert art is never a tap target.
      className={`nav-brand group ${box}`}
    >
      {mark}
    </Link>
  );
}
