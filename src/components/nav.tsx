"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const navLink =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all duration-[200ms] hover:text-foreground hover:bg-white/[0.04]";
const navLinkActive = "text-foreground font-medium bg-white/[0.06] shadow-sm";

const PLUS_BADGE =
  "ml-1 inline-flex items-center rounded-md border border-foreground/25 bg-foreground/[0.08] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground";

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [tier, setTier] = useState<"free" | "sovereign+" | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    setAuthed(false);
    setTier(null);
    setOpen(false);
    await fetch("/api/auth", { method: "DELETE" });
    router.refresh();
    router.push("/");
  };

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        const data = d as { user?: { subscription_tier?: string | null } | null };
        setAuthed(!!data.user);
        setTier(data.user?.subscription_tier === "sovereign+" ? "sovereign+" : data.user?.subscription_tier === "free" ? "free" : null);
      })
      .catch(() => setAuthed(false));
  }, []);

  const linkClass = (href: string) =>
    `${navLink} ${pathname === href ? navLinkActive : ""}`;
  // WCAG 4.1.2: expose "this is the current page" to assistive tech, not just
  // the visual highlight.
  const ariaCurrent = (href: string) =>
    pathname === href ? ("page" as const) : undefined;

  return (
    <header className="pt-safe relative sticky top-0 z-50 bg-background/80 backdrop-blur-xl transition-all border-b border-border/40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {authed ? (
            <>
              <Link href="/chat" className={linkClass("/chat")} aria-current={ariaCurrent("/chat")}>Chat</Link>
              <Link href="/baseline" className={linkClass("/baseline")} aria-current={ariaCurrent("/baseline")}>Baseline</Link>
              {tier === "sovereign+" ? (
                <span className={PLUS_BADGE} title="Your plan">Sovereign+</span>
              ) : (
                <Link href="/upgrade" className={linkClass("/upgrade")} aria-current={ariaCurrent("/upgrade")}>Upgrade</Link>
              )}
              <Link href="/account" className={linkClass("/account")} aria-current={ariaCurrent("/account")}>Account</Link>
              <Link href="/settings" className={linkClass("/settings")} aria-current={ariaCurrent("/settings")}>Settings</Link>
              <button onClick={handleSignOut} className={navLink}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/about" className={linkClass("/about")} aria-current={ariaCurrent("/about")}>Philosophy</Link>
              <Link href="/faq" className={linkClass("/faq")} aria-current={ariaCurrent("/faq")}>FAQ</Link>
              <Link href="/support" className={linkClass("/support")} aria-current={ariaCurrent("/support")}>Support</Link>
              <Link href="/onboard?mode=login" className={linkClass("/onboard")}>Sign in</Link>
              <Link
                href="/onboard?mode=signup"
                className="btn-focal ml-2 px-4 py-2 text-sm font-medium"
              >
                Start free
              </Link>
            </>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:text-foreground hover:bg-white/[0.04] md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {/* Mobile menu drawer */}
      {mounted && (
        <nav
          className={`overflow-hidden bg-surface-1/95 backdrop-blur-2xl transition-all duration-200 ease-out md:hidden border-b border-border/50 ${
            open
              ? "visible max-h-[32rem] opacity-100 py-3 px-4 shadow-2xl"
              : "invisible max-h-0 pointer-events-none opacity-0 py-0 px-4"
          }`}
          aria-hidden={!open}
        >
          {authed ? (
            <div className="flex flex-col space-y-1">
              <Link
                href="/chat"
                onClick={() => setOpen(false)}
                aria-current={ariaCurrent("/chat")}
                className={`rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/chat" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                Chat
              </Link>
              <Link
                href="/baseline"
                onClick={() => setOpen(false)}
                aria-current={ariaCurrent("/baseline")}
                className={`rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/baseline" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                Baseline
              </Link>
              {tier === "sovereign+" ? (
                <div className="px-3.5 py-2 flex items-center justify-between text-sm font-medium text-foreground">
                  <span>Current tier</span>
                  <span className={PLUS_BADGE}>Sovereign+</span>
                </div>
              ) : (
                <Link
                  href="/upgrade"
                  onClick={() => setOpen(false)}
                  aria-current={ariaCurrent("/upgrade")}
                  className={`rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    pathname === "/upgrade" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  }`}
                >
                  Upgrade
                </Link>
              )}
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                aria-current={ariaCurrent("/account")}
                className={`rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/account" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                Account
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                aria-current={ariaCurrent("/settings")}
                className={`rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/settings" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                Settings
              </Link>
              <div className="pt-2 mt-2 border-t border-border/50">
                <button
                  onClick={handleSignOut}
                  className="w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col space-y-1">
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              >
                Philosophy
              </Link>
              <Link
                href="/faq"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              >
                FAQ
              </Link>
              <Link
                href="/support"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              >
                Support
              </Link>
              <Link
                href="/onboard?mode=login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              >
                Sign in
              </Link>
              <div className="pt-2">
                <Link
                  href="/onboard?mode=signup"
                  onClick={() => setOpen(false)}
                  className="btn-focal w-full px-4 py-2.5 text-sm font-medium text-center"
                >
                  Start free
                </Link>
              </div>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
