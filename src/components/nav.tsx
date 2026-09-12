"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const navLink =
  "rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-[240ms] hover:text-foreground";
const navLinkActive = "text-foreground";

const AUTHED_LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/baseline", label: "Baseline" },
  { href: "/upgrade", label: "Upgrade" },
  { href: "/account", label: "Account" },
];

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    setAuthed(false);
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
        const data = d as { user?: unknown };
        setAuthed(!!data.user);
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
              {AUTHED_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
              <button onClick={handleSignOut} className={navLink}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/onboard?mode=login" className={linkClass("/onboard")}>
                Sign In
              </Link>
              <Link
                href="/onboard?mode=signup"
                className="ml-1 rounded-md bg-white/10 px-4 py-1.5 text-sm font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-sm transition-all duration-[240ms] ease-spring hover:-translate-y-[2px] hover:bg-white/20"
              >
                Get Started
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
              {AUTHED_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-3 text-sm hover:bg-white/5 ${
                    pathname === l.href ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
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
                href="/onboard?mode=login"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-white/5"
              >
                Sign In
              </Link>
              <Link
                href="/onboard?mode=signup"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-md bg-white/10 px-3 py-3 text-center text-sm font-medium text-foreground hover:bg-white/20"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
