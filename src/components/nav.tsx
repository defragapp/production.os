"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const navLink =
  "rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-[240ms] hover:text-foreground";
const navLinkActive = "text-foreground";

const PLUS_BADGE =
  "ml-1 inline-flex items-center rounded-md border border-foreground/25 bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground";

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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {authed ? (
            <>
              <Link href="/chat" className={linkClass("/chat")}>Chat</Link>
              <Link href="/baseline" className={linkClass("/baseline")}>Baseline</Link>
              {tier === "sovereign+" ? (
                <span className={PLUS_BADGE} title="Your plan">Sovereign+</span>
              ) : (
                <Link href="/upgrade" className={linkClass("/upgrade")}>Upgrade</Link>
              )}
              <Link href="/account" className={linkClass("/account")}>Account</Link>
              <Link href="/settings" className={linkClass("/settings")}>Settings</Link>
              <button onClick={handleSignOut} className={navLink}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/about" className={linkClass("/about")}>Philosophy</Link>
              <Link href="/faq" className={linkClass("/faq")}>FAQ</Link>
              <Link href="/support" className={linkClass("/support")}>Support</Link>
              <Link href="/onboard?mode=login" className={linkClass("/onboard")}>
                Sign in
              </Link>
              <Link
                href="/onboard?mode=signup"
                className="btn-glass mt-1 rounded-md px-4 py-1.5 text-sm font-medium"
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
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mounted && (
        <nav
          className={`overflow-hidden border-border bg-background/95 backdrop-blur-md transition-all duration-200 ease-out md:hidden ${
            open ? "max-h-96 border-t opacity-100" : "max-h-0 opacity-0"
          }`}
          aria-hidden={!open}
        >
          {authed ? (
            <div className="flex flex-col">
              <Link
                href="/chat"
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-3 text-sm hover:bg-white/5 ${
                  pathname === "/chat" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Chat
              </Link>
              <Link
                href="/baseline"
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-3 text-sm hover:bg-white/5 ${
                  pathname === "/baseline" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Baseline
              </Link>
              {tier === "sovereign+" ? (
                <span className="px-3 py-3 text-sm font-medium text-foreground">Sovereign+</span>
              ) : (
                <Link
                  href="/upgrade"
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-3 text-sm hover:bg-white/5 ${
                    pathname === "/upgrade" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Upgrade
                </Link>
              )}
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-3 text-sm hover:bg-white/5 ${
                  pathname === "/account" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Account
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-3 text-sm hover:bg-white/5 ${
                  pathname === "/settings" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-md px-3 py-3 text-left text-sm text-muted-foreground hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-white/5"
              >
                Philosophy
              </Link>
              <Link
                href="/faq"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-white/5"
              >
                FAQ
              </Link>
              <Link
                href="/support"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-white/5"
              >
                Support
              </Link>
              <Link
                href="/onboard?mode=login"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-white/5"
              >
                Sign in
              </Link>
              <Link
                href="/onboard?mode=signup"
                onClick={() => setOpen(false)}
                className="btn-glass mt-1 rounded-md px-3 py-3 text-center text-sm font-medium"
              >
                Start free
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
