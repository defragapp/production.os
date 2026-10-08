import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const FOOTER_LINKS = [
  { href: "/about", label: "Philosophy" },
  { href: "/self", label: "Self" },
  { href: "/people", label: "People" },
  { href: "/systems", label: "Systems" },
  { href: "/blog", label: "Field Notes" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Support" },
];

/**
 * The site footer, lifted from the landing page so every public surface ends
 * the same way: brand line, navigation, and the legal links (Terms / Privacy)
 * a stranger looks for before trusting an AI platform. Rendered on all
 * marketing/reading/legal pages and the 404; app-state and auth surfaces
 * stay chrome-free on purpose.
 */
export function SiteFooter() {
  return (
    <footer className="relative bg-background px-6 pb-12 pt-14 text-sm text-muted-foreground">
      <div className="section-rule absolute inset-x-0 top-0" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <Logo />
          <p className="mt-2.5">Private by design. Grounded in data. Yours to decide.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="tap-line transition-colors duration-[240ms] hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-1 border-t border-white/[0.06] pt-6 text-xs text-muted-foreground/75">
        <p>Sovereign OS™ — © 2026 Sovereign OS. All rights reserved.</p>
        <p>Sovereign OS is a trademark used as a common-law mark. The Service and its AI outputs are protected under the Terms of Service.</p>
      </div>
    </footer>
  );
}
