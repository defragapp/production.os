"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageSquare, Activity, Sparkles, User } from "lucide-react";

/**
 * Bottom tab bar for the installed (standalone) app shell only.
 *
 * Renders nothing in the browser — the top <Nav /> is the sole chrome there —
 * so the two never stack. Visibility is driven by the `.standalone-only`
 * utility (a `@media (display-mode: standalone)` rule in globals.css) plus a
 * `< sm` breakpoint, matching how native iOS apps swap a top nav for a bottom
 * tab bar once space is tight. Fixed to the bottom with home-indicator
 * clearance via `pb-safe`.
 */
const TABS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/baseline", label: "Baseline", icon: Activity },
  { href: "/upgrade", label: "Upgrade", icon: Sparkles },
  { href: "/account", label: "Account", icon: User },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const t = (d as { user?: { subscription_tier?: string | null } }).user
          ?.subscription_tier;
        setTier(t ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Sovereign+ members don't need the Upgrade tab — swap it for Account depth.
  const tabs = tier === "sovereign+" ? TABS.filter((t) => t.href !== "/upgrade") : TABS;

  return (
    <nav
      aria-label="Primary"
      className="standalone-only fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur-md pb-safe sm:hidden"
    >
      <ul
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-[240ms] ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
