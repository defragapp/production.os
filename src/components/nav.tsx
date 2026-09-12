"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function Nav() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleSignOut = async () => {
    setAuthed(false);
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

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-950/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-medium uppercase tracking-widest text-white">
          Sovereign OS
        </Link>
        {mounted && authed ? (
          <nav className="flex items-center gap-4">
            <Link href="/chat" className="text-sm text-neutral-300 transition-colors hover:text-white">
              Chat
            </Link>
            <Link href="/upgrade" className="text-sm text-neutral-300 transition-colors hover:text-white">
              Upgrade
            </Link>
            <Link href="/account" className="text-sm text-neutral-300 transition-colors hover:text-white">
              Account
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-neutral-300 transition-colors hover:text-white"
            >
              Sign out
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-4">
            <Link
              href="/onboard?mode=login"
              className="text-sm text-neutral-400 transition-colors hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/onboard?mode=signup"
              className="rounded-md bg-white/10 px-4 py-1.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-sm transition-all duration-[240ms] ease-spring hover:-translate-y-[2px] hover:bg-white/20"
            >
              Get Started
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}