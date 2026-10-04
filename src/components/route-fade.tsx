"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Route-level crossfade. The root layout persists across client-side
 * navigations, so the only thing that changes is `children`. Re-keying the
 * wrapper on the pathname remounts it, which replays the short `.route-fade`
 * opacity animation — a ~180ms fade that makes moving between marketing routes
 * read as one continuous surface instead of a hard cut.
 *
 * Opacity-only, so it is exempt from the Layout Instability API (no CLS) and
 * does not create a containing block for the page's fixed overlays. The
 * keyframe is gated behind `prefers-reduced-motion` in globals.css; with JS off
 * or the animation unsupported, content simply renders at full opacity.
 */
export function RouteFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-fade">
      {children}
    </div>
  );
}
