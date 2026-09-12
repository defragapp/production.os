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
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-sm transition-colors duration-[240ms] group-hover:border-white/30">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.4" className="text-white" />
          <circle cx="12" cy="12" r="3" fill="currentColor" className="text-white" />
          <line x1="6" y1="12" x2="2" y2="12" stroke="currentColor" strokeWidth="1.4" opacity="0.5" className="text-white" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-sm font-medium uppercase tracking-[0.2em] text-white">
          Sovereign
        </span>
      )}
    </Link>
  );
}