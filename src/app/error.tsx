"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Eyebrow } from "@/components/ui/eyebrow";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sovereign] route error:", error);
  }, [error]);

  return (
    <main
      id="main"
      className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-6 py-24"
    >
      <div className="hero-light" aria-hidden="true" />
      <div className="relative mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-surface-2 shadow-[inset_0_1px_0_hsla(38,18%,95%,0.12),0_20px_50px_-24px_rgba(0,0,0,0.8)]">
          <Logo showWordmark={false} href="#" markClassName="h-8 w-auto" />
        </div>
        <Eyebrow className="mb-3">Something went wrong</Eyebrow>
        <h1 className="mb-4 font-display text-4xl font-normal tracking-tight text-foreground md:text-5xl">
          This one&apos;s on us.
        </h1>
        <p className="mb-10 text-lg text-muted-foreground">
          Something didn&apos;t line up on our end. Give it another try, or{" "}
          <Link href="/support" className="text-foreground underline underline-offset-4">
            tell us
          </Link>{" "}
          and we&apos;ll dig in.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={reset} className="btn-aurora px-8 py-3 text-sm font-medium">
            Try again
          </button>
          <Link href="/" className="btn-glass px-8 py-3 text-center text-sm font-medium">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
