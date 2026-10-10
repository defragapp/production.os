import type { Metadata } from "next";

/**
 * /account is a client component, so metadata lives in the layout. A signed-in
 * surface with nothing a crawler should index, so it carries its own noindex —
 * closing the small gap that /account wasn't listed in robots.ts' disallow set.
 * The root template appends " · Sovereign OS", so this carries only the name.
 */
export const metadata: Metadata = {
  title: "Account",
  description: "Your plan, profile, and account preferences.",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
