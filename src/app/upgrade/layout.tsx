import type { Metadata } from "next";

/**
 * /upgrade is a client component, so metadata lives in the layout. The page
 * itself is behind the sign-in paywall and is already disallowed in robots.ts,
 * so this is indexed out. The root template appends " · Sovereign OS", so this
 * carries only the page name.
 */
export const metadata: Metadata = {
  title: "Plans",
  description:
    "Compare the free tier with Sovereign+ — what each unlocks, and how to move up when you're ready.",
  robots: { index: false, follow: false },
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
