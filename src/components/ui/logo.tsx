import Link from "next/link";

/**
 * Sovereign OS logomark + wordmark.
 * A simple old-style chalice, overflowing — the same glyph used as the web tab
 * icon and home-screen icon (Ace of Cups: "my cup overflows"). The mark stands
 * on its own, without a box around it.
 */
export function Logo({
  href = "/",
  className,
  showWordmark = true,
}: {
  href?: string;
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Sovereign OS home"
      className={`group inline-flex items-center gap-2.5 ${className ?? ""}`}
    >
      <span className="relative inline-flex">
        <span className="logo-halo" aria-hidden="true" />
        <svg viewBox="0 0 64 64" className="relative h-6 w-6 text-foreground" fill="none" aria-hidden="true">
          {/* Descending Dove Silhouette (Solid, High-Contrast Fill) */}
          <path d="M32 14 C30.5 11.5 25 7 18 3 C22 6 27.5 8 31 7 C31.5 4 32 1 32 1 C32 1 32.5 4 33 7 C36.5 8 42 6 46 3 C39 7 33.5 11.5 32 14 Z" fill="currentColor" />

          {/* Cross & Wafer / Disk */}
          <circle cx="32" cy="18" r="4.2" stroke="currentColor" strokeWidth="2.4" />
          <path d="M32 15.5 V20.5 M29.5 18 H34.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />

          {/* Chalice Bowl */}
          <path d="M24 22 C23 29 25 35 30 39 Q32 40 34 39 C39 35 41 29 40 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 22 Q32 23.8 40 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

          {/* Bold S Details inside Chalice */}
          <path d="M34 26.2 C34 25.3 33.1 24.8 32 24.8 C30.8 24.8 29.8 25.5 29.8 26.8 C29.8 28.8 34.2 29.2 34.2 31.2 C34.2 33 33 33.8 32 33.8 C30.5 33.8 29.8 32.7 29.8 31.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

          {/* Stem & Knop Column */}
          <path d="M30 39 V48 M34 39 V48" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="48" r="2.5" fill="currentColor" />

          {/* Flared Foot / Base */}
          <path d="M30 48 C28 50 25.5 52.5 24 54 Q32 55.5 40 54 C38.5 52.5 36 50 34 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 54 Q32 55.5 40 54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />

          {/* High-Contrast Bold Flow Loops (Single Loop Per Side) */}
          <path d="M26.5 23 C26.5 15 21 15 21 21 V62" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M37.5 23 C37.5 15 43 15 43 21 V62" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

          {/* Bold Droplets */}
          <path d="M 15 30 Q 13.5 32.5 15 33.5 Q 16.5 32.5 15 30" fill="currentColor" />
          <path d="M 15 46 Q 13.5 48.5 15 49.5 Q 16.5 48.5 15 46" fill="currentColor" />
          <path d="M 49 30 Q 47.5 32.5 49 33.5 Q 50.5 32.5 49 30" fill="currentColor" />
          <path d="M 49 46 Q 47.5 48.5 49 49.5 Q 50.5 48.5 49 46" fill="currentColor" />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-foreground">
          Sovereign.OS
        </span>
      )}
    </Link>
  );
}