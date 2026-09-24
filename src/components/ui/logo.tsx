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
      <svg viewBox="0 0 20 20" className="h-6 w-6 text-foreground" fill="none" aria-hidden="true">
        <path d="M5.9 6.9 H14.1 L14.7 8.8 Q14.7 12.5 10 13.6 Q5.3 12.5 5.3 8.8 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7.5 6.6 Q8.1 4.7 10 4.4 Q11.9 4.7 12.5 6.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M10 13.6 V15.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M10 15.9 H7.5 M10 15.9 H12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="15.6" cy="4.7" r="0.9" fill="currentColor" />
      </svg>
      {showWordmark && (
        <span className="font-display text-sm uppercase tracking-[0.18em] text-foreground">
          Sovereign.OS
        </span>
      )}
    </Link>
  );
}