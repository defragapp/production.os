import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";

/**
 * Sovereign OS logomark + wordmark. The overflowing-cup glyph (see
 * `lib/brand-mark.ts`) on its own, without a box — the identical silhouette used
 * as the web tab icon and home-screen icon. There is exactly one mark; larger
 * or smaller is just a different size of the same artwork.
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
        <BrandMark className="relative h-6 w-6 text-foreground" />
      </span>
      {showWordmark && (
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-foreground">
          Sovereign.OS
        </span>
      )}
    </Link>
  );
}
