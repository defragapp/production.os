import Link from "next/link";

/**
 * Sovereign OS logomark + wordmark. The mark is the canonical Ace-of-Cups
 * emblem (assets/ace-of-cups.jpg -> scripts/build-brand-assets.mjs ->
 * public/brand/emblem-core-bold.png): a descending dove above the overflowing
 * chalice. It is the SAME artwork used as the web-tab icon, iOS home-screen
 * icon, and social card — never a separate/simplified logo.
 *
 * The "-bold" cut is the real engraving with its hairlines thickened (a
 * morphological dilate in the build — not a redraw) so the dove+chalice
 * silhouette actually reads at header size instead of collapsing into a smudge.
 * `markClassName` lets tight contexts (the hero chat mock) scale it down.
 */
export function Logo({
  href = "/",
  className,
  markClassName = "h-11 w-auto",
  showWordmark = true,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Sovereign OS home"
      className={`group inline-flex items-center gap-2.5 ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/emblem-core-bold.png"
        alt=""
        aria-hidden="true"
        className={`shrink-0 ${markClassName}`}
        style={{ imageRendering: "auto" }}
      />
      {showWordmark && (
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-foreground">
          Sovereign.OS
        </span>
      )}
    </Link>
  );
}
