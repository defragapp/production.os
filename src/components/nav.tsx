"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function Nav() {
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d: { user?: unknown }) => setAuthed(!!d.user))
      .catch(() => setAuthed(false));
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-widest">
            Sovereign OS
          </span>
        </Link>

        {mounted && authed ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/chat">
              <Button variant="ghost" size="sm">Chat</Button>
            </Link>
            <Link href="/upgrade">
              <Button variant="ghost" size="sm">Upgrade</Button>
            </Link>
            <Link href="/account">
              <Button variant="ghost" size="sm">Account</Button>
            </Link>
            <Link href="/onboard">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await fetch("/api/auth", { method: "DELETE" });
                }}
              >
                Sign out
              </Button>
            </Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/onboard">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/onboard">
              <Button size="sm">Get Started</Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
