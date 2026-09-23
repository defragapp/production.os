import Link from "next/link";

/**
 * Sovereign OS logomark + wordmark.
 * A single ring-and-dot glyph used on every surface so the platform
 * reads as one continuous brand.
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
            <path d="M3.5 7.5 H16.5 L10.5 15 Q10 15.8 9.5 15 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="text-foreground" />
            <circle cx="10" cy="2.6" r="1.1" fill="currentColor" className="text-foreground" />
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