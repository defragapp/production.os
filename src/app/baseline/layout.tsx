import type { Metadata } from "next";

/**
 * /baseline is a client component, so metadata lives in the layout. This is a
 * signed-in surface — kept out of the index (and out of the sitemap) alongside
 * the rest of the session-only routes robots.ts already disallows. The root
 * layout's title template ("%s · Sovereign OS") appends the brand suffix, so
 * this carries only the page name.
 */
export const metadata: Metadata = {
  title: "Your Baseline",
  description:
    "The personal starting point computed from NASA/JPL planetary data, and the birth information it came from.",
  robots: { index: false, follow: false },
};

export default function BaselineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
