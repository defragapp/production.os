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
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M12 3 L20 18 H4 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-foreground" />
            <path d="M12 21 L4 6 H20 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-foreground" />
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