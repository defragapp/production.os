"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const navLink =
  "rounded-md px-3 py-2 text-sm text-neutral-300 transition-colors duration-[240ms] hover:text-white";
const navLinkActive = "text-white";

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
    <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-950/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {authed ? (
            <>
              <Link href="/chat" className={linkClass("/chat")}>
                Chat
              </Link>
              <Link href="/upgrade" className={linkClass("/upgrade")}>
                Upgrade
              </Link>
              <Link href="/account" className={linkClass("/account")}>
                Account
              </Link>
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
                className="ml-1 rounded-md bg-white/10 px-4 py-1.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-sm transition-all duration-[240ms] ease-spring hover:-translate-y-[2px] hover:bg-white/20"
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
          className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-300 transition-colors hover:text-white md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mounted && open && (
        <nav className="border-t border-white/5 bg-neutral-950/95 px-4 pb-4 pt-2 md:hidden">
          {authed ? (
            <div className="flex flex-col">
              <Link
                href="/chat"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-neutral-200 hover:bg-white/5"
              >
                Chat
              </Link>
              <Link
                href="/upgrade"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-neutral-200 hover:bg-white/5"
              >
                Upgrade
              </Link>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-neutral-200 hover:bg-white/5"
              >
                Account
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-md px-3 py-3 text-left text-sm text-neutral-300 hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <Link
                href="/onboard?mode=login"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-neutral-200 hover:bg-white/5"
              >
                Sign In
              </Link>
              <Link
                href="/onboard?mode=signup"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-md bg-white/10 px-3 py-3 text-center text-sm font-medium text-white hover:bg-white/20"
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