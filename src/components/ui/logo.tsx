import Link from "next/link";
import { StrippedIcon, Emblem } from "@/components/ui/brand-mark";

/**
 * Sovereign OS logomark + wordmark. The overflowing-cup glyph (see
 * `brand-mark.tsx`) on its own, without a box — the same silhouette used as
 * the web tab icon and home-screen icon.
 *
 * `variant="icon"` (default) is the stripped goblet, sized for nav/inline use.
 * `variant="emblem"` is the illustrated line mark for larger brand moments.
 */
export function Logo({
  href = "/",
  className,
  showWordmark = true,
  variant = "icon",
}: {
  href?: string;
  className?: string;
  showWordmark?: boolean;
  variant?: "icon" | "emblem";
}) {
  return (
    <Link
      href={href}
      aria-label="Sovereign OS home"
      className={`group inline-flex items-center gap-2.5 ${className ?? ""}`}
    >
      {variant === "emblem" ? (
        <Emblem className="h-9 w-9 text-foreground" />
      ) : (
        <StrippedIcon className="h-6 w-6 text-foreground" />
      )}
      {showWordmark && (
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-foreground">
          Sovereign.OS
        </span>
      )}
    </Link>
  );
}
