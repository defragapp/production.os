import Link from "next/link";

/**
 * Sovereign OS logomark + wordmark.
 * A simple old-style chalice, overflowing — the same glyph used as the web tab
 * icon, home-screen icon, and in-app nav (Ace of Cups: "my cup overflows").
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
      <span className="relative flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/15 bg-white/5 backdrop-blur-sm transition-colors duration-[240ms] group-hover:border-white/30">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M6.5 7 H13.5 L14.5 9 Q13.5 13.6 10 14 Q6.5 13.6 5.5 9 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M10 14 V17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M10 17 H7.5 M10 17 H12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M6.7 3.5 Q7.2 5.3 7.2 6.7 Q9 5.8 10.8 6.7 Q10.8 5.3 11.3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M6 5.4 Q4.5 6.3 3.5 7 Q3 7.6 2.4 7.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M14 5.4 Q15.5 6.3 16.5 7 Q17 7.6 17.6 7.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="2.1" cy="12.5" r="1" fill="currentColor" />
          <circle cx="10" cy="2.4" r="1" fill="currentColor" />
          <circle cx="17.9" cy="12.5" r="1" fill="currentColor" />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-display text-sm uppercase tracking-[0.18em] text-foreground">
          Sovereign
        </span>
      )}
    </Link>
  );
}