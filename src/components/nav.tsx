"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { NavMenu } from "@/components/nav-menu";

// `nav-link` is a hook, not a style: it carries no declaration on desktop, and
// the coarse-pointer block in globals.css raises it to the 44px tap floor on
// touch. Same for `tap-line` on the drawer's rows.
const navLink =
  "nav-link rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-[200ms] hover:text-foreground hover:bg-white/[0.06]";
const navLinkActive =
  "text-foreground bg-white/[0.09] shadow-[inset_0_0_0_1px_hsla(38,18%,95%,0.12)]";

const PLUS_BADGE =
  "ml-1 inline-flex items-center rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-medium text-foreground/85";

// A quiet mono label that groups the drawer's rows the same way the desktop
// row groups its links (lenses first, then the folded help/about tier).
const DRAWER_LABEL =
  "px-3.5 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60";
const PUBLIC_LINK =
  "tap-line rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors";

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  // `null` means "session not known yet". The two variants have different
  // widths, and swapping one for the other inside a justify-between row slides
  // every already-visible link (measured: 0.0069 × 2 at tablet width on every
  // authenticated page). Mounting only once the answer arrives means the nav
  // appears at the trailing edge of the row — new content, nothing moved.
  const [authed, setAuthed] = useState<boolean | null>(null);
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
    const load = () =>
      fetch("/api/auth")
        .then((r) => r.json())
        .then((d) => {
          const data = d as { user?: { subscription_tier?: string | null } | null };
          setAuthed(!!data.user);
          setTier(data.user?.subscription_tier === "sovereign+" ? "sovereign+" : data.user?.subscription_tier === "free" ? "free" : null);
        })
        .catch(() => setAuthed(false));
    void load();
    // Auth is client-side (fetch + cookie), so a soft navigation after login
    // never remounts this persistent layout component. Any sign-in/passkey
    // success dispatches `sovereign:auth` to pull the chrome in sync
    // immediately — otherwise the header keeps showing logged-out links
    // while the user is already inside the app.
    window.addEventListener("sovereign:auth", load);
    return () => window.removeEventListener("sovereign:auth", load);
  }, []);

  const linkClass = (href: string) =>
    `${navLink} ${pathname === href ? navLinkActive : ""}`;
  // WCAG 4.1.2: expose "this is the current page" to assistive tech, not just
  // the visual highlight.
  const ariaCurrent = (href: string) =>
    pathname === href ? ("page" as const) : undefined;

  return (
    <header className="site-header pt-safe sticky top-0 z-50 bg-background/80 backdrop-blur-xl transition-all border-b border-border/40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* Desktop nav (see the `authed` note above: revealed, never swapped).
            The logged-out row leads with the three lenses — the actual value
            prop — and folds the philosophy/help/support tier into a single
            "More" menu, so it reads as one clean group instead of eight peer
            links. Still gated to `lg`: below that the drawer carries the same
            grouping. */}
        {authed !== null && (
        <nav className="nav-fade hidden items-center gap-1.5 lg:flex">
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
              <span className="mx-1.5 h-5 w-px bg-border/70" aria-hidden="true" />
              <button onClick={handleSignOut} className={navLink}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/self" className={linkClass("/self")} aria-current={ariaCurrent("/self")}>Self</Link>
              <Link href="/people" className={linkClass("/people")} aria-current={ariaCurrent("/people")}>People</Link>
              <Link href="/systems" className={linkClass("/systems")} aria-current={ariaCurrent("/systems")}>Family & Teams</Link>
              <NavMenu
                label="More"
                items={[
                  { href: "/about", label: "Philosophy" },
                  { href: "/faq", label: "FAQ" },
                  { href: "/support", label: "Support" },
                ]}
              />
              <span className="mx-1.5 h-5 w-px bg-border/70" aria-hidden="true" />
              <Link href="/onboard?mode=login" className={linkClass("/onboard")}>Sign in</Link>
              <Link
                href="/onboard?mode=signup"
                className="btn-focal ml-1 px-4 py-2 text-sm font-medium"
              >
                Start free
              </Link>
            </>
          )}
        </nav>
        )}

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:text-foreground hover:bg-white/[0.04] lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {/* Mobile menu drawer */}
      {mounted && (
        <nav
          className={`overflow-hidden bg-surface-1/95 backdrop-blur-2xl transition-all duration-200 ease-out lg:hidden border-b border-border/50 ${
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
                className={`tap-line rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/chat" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                Chat
              </Link>
              <Link
                href="/baseline"
                onClick={() => setOpen(false)}
                aria-current={ariaCurrent("/baseline")}
                className={`tap-line rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
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
                  className={`tap-line rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
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
                className={`tap-line rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/account" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                Account
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                aria-current={ariaCurrent("/settings")}
                className={`tap-line rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/settings" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                Settings
              </Link>
              <div className="pt-2 mt-2 border-t border-border/50">
                <button
                  onClick={handleSignOut}
                  className="tap-line w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col space-y-1">
              <p className={DRAWER_LABEL}>Lenses</p>
              <Link href="/self" onClick={() => setOpen(false)} aria-current={ariaCurrent("/self")} className={PUBLIC_LINK}>
                Self
              </Link>
              <Link href="/people" onClick={() => setOpen(false)} aria-current={ariaCurrent("/people")} className={PUBLIC_LINK}>
                People
              </Link>
              <Link href="/systems" onClick={() => setOpen(false)} aria-current={ariaCurrent("/systems")} className={PUBLIC_LINK}>
                Family & Teams
              </Link>
              <p className={DRAWER_LABEL}>More</p>
              <Link href="/about" onClick={() => setOpen(false)} aria-current={ariaCurrent("/about")} className={PUBLIC_LINK}>
                Philosophy
              </Link>
              <Link href="/faq" onClick={() => setOpen(false)} aria-current={ariaCurrent("/faq")} className={PUBLIC_LINK}>
                FAQ
              </Link>
              <Link href="/support" onClick={() => setOpen(false)} aria-current={ariaCurrent("/support")} className={PUBLIC_LINK}>
                Support
              </Link>
              <div className="mt-3 border-t border-border/50 pt-3">
                <Link href="/onboard?mode=login" onClick={() => setOpen(false)} className={PUBLIC_LINK}>
                  Sign in
                </Link>
                <Link
                  href="/onboard?mode=signup"
                  onClick={() => setOpen(false)}
                  className="btn-focal mt-1 w-full px-4 py-2.5 text-sm font-medium text-center"
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
