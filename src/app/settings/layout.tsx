import type { Metadata } from "next";

/**
 * /settings is a client component, so metadata lives in the layout. Like
 * /account, it is signed-in-only and was missing from robots.ts' disallow set,
 * so it carries its own noindex. The root template appends " · Sovereign OS",
 * so this carries only the page name.
 */
export const metadata: Metadata = {
  title: "Settings",
  description: "Your profile, connections, and privacy controls.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
