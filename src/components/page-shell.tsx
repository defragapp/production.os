"use client";

import { Nav } from "@/components/nav";
import { PageTexture } from "@/components/page-texture";
import { cn } from "@/lib/utils";

/**
 * The platform's single page shell. Every route composes its chrome — grain
 * texture, nav, ambient glow, vertical rhythm, container width — through this
 * one component, so the app reads as one product instead of a set of
 * individually-styled pages.
 *
 * Two modes:
 * • `center` (default) — the app-state shell (Account, Baseline, Invite,
 *   Upgrade): content is vertically centered in the viewport below the nav,
 *   capped at the `panel` width.
 * • `top` — reading and form pages (FAQ, legal, Support, Settings): a fixed
 *   pt-14 / pb-24 rhythm, left-aligned, width from `wide`.
 *
 * Width scale (the only three a page may choose from):
 * • `prose`  max-w-2xl  — legal text, single reading column
 * • `panel`  max-w-lg   — one card or form, centered states
 * • `wide`   max-w-3xl  — settings rows, support, multi-block pages
 */
export function PageShell({
  children,
  center = true,
  wide = "panel",
  glow = true,
  nav = true,
  rule = false,
  className,
}: {
  children: React.ReactNode;
  /** Vertically center the content in the viewport (app-state pages). */
  center?: boolean;
  /** Container width when `center` is false; centered pages are always `panel`. */
  wide?: "prose" | "panel" | "wide";
  /** Ambient warm light from the top edge. Static by design — see .app-glow. */
  glow?: boolean;
  /** Render the shared nav (off only for exotic full-bleed layouts). */
  nav?: boolean;
  /** Hairline lit edge under the nav — the legal/reading-page signal. */
  rule?: boolean;
  className?: string;
}) {
  return (
    <>
      <PageTexture />
      {nav && <Nav />}
      <main
        id="main"
        className={cn(
          "relative z-10 overflow-hidden",
          center
            ? "flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6"
            : cn("mx-auto px-6 pt-14 pb-24", {
                "max-w-2xl": wide === "prose",
                "max-w-lg": wide === "panel",
                "max-w-3xl": wide === "wide",
              }),
        )}
      >
        {glow && <div className="app-glow absolute inset-0 -z-10" aria-hidden="true" />}
        {rule && <div className="section-rule absolute inset-x-0 top-0" aria-hidden="true" />}
        <div className={cn("msg-in w-full", center && "max-w-lg", className)}>{children}</div>
      </main>
    </>
  );
}
