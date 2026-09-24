import Link from "next/link";

/**
 * Sovereign OS logomark + wordmark.
 * A single ornate overflowing-chalice glyph (Ace of Cups: bowl, knop stem,
 * flared foot, liquid spilling over both rims, droplets breaking off) used on
 * every surface — favicon, home-screen icon, and in-app nav — so the platform
 * reads as one continuous brand: "my cup overflows."
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
          <path d="M5 6.5 H15 L15.4 9 Q16 15 10 16 Q4 14 4.6 9 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6.8 5.9 Q9.6 12.5 8.7 6.6 Q8.6 9 10 9.3 Q11.4 9 11.3 6.6 Q10.4 12.5 13.2 5.9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M10 6.2 V9.4 Q10 13.4 10 14.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M10 14.6 H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M10 14.6 H3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="6.6" cy="3.4" r="1.1" fill="currentColor" />
          <circle cx="9.4" cy="2.2" r="0.9" fill="currentColor" />
          <circle cx="12.6" cy="3.2" r="1.1" fill="currentColor" />
          <path d="M5.9 2.2 Q5.2 1.4 4.6 0.6 M5.1 2.9 Q4.4 3.6 3.8 4.3 M4.6 3.ajo Q3.9 4.4 3.3 5.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M14.1 2.2 Q14.8 1.4 15.4 0.6 M14.9 2.9 Q15.6 3.6 16.2 4.3 M15.4 3.6 Q16.1 4.4 16.7 5.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8.5 4.3 Q7.4 5.2 6.5 5.9 M8 5.4 Q7.2 6.4 6.9 7.1 M7.5 6.2 Q6.8 6.9 6.6 7.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M11.5 4.3 Q12.6 5.2 13.5 5.9 M12 5.4 Q12.8 6.4 13.1 7.1 M12.5 6.2 Q13.2 6.9 13.4 7.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M附 1.6 Q2.2 2 1.7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M17.9 1.6 Q17.8 2 18.3 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
